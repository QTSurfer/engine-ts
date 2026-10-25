import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { StateStore } from "@qtsurfer/core";
import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { Duration } from "$core/Duration";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapTickerSourceRTIndicator } from "$group/InstrumentMapTickerSourceRTIndicator";
import { WindowTimeRTIndicatorBuilder } from "$group/WindowTimeRTIndicatorBuilder";
import type { OnChangeListener } from "$helpers/OnChangeRTIndicator";
import {
  JAVA_WINDOW_TIMES,
  WindowTime,
  WindowTimeRTIndicator,
  type WindowPeriod,
} from "$helpers/WindowTimeRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";

const INSTRUMENT = "BTC/USDT";
const START = 1_700_000_000_000;

function tick(price: number, timestamp: number): Ticker {
  return {
    instrument: INSTRUMENT, open: null, high: null, low: null, last: price, bid: price, bidSize: null,
    ask: price, askSize: null, volume: null, quoteVolume: null, vwap: null, percentageChange: null, timestamp,
  };
}

function priceGroup() {
  const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
  const group = new InstrumentGroupRTIndicator(map).addPrice();
  map.setBacktestEnabled(true);
  return { map, group };
}

function feed(map: InstrumentMapTickerSourceRTIndicator, every: number, count: number): void {
  for (let i = 0; i < count; i++) {
    map.updateFrom(tick(10 * (i + 1), START + i * every));
  }
}

type Close = [prev: number | null, curr: number | null];

/** The [prev, curr] instants each close of a `period` window reports, over `count` ticks `every` ms apart. */
function closes(period: WindowPeriod, every: number, count: number): Close[] {
  const { map, group } = priceGroup();
  const seen: Close[] = [];
  group.window("price", period, (_store, _prev, _actual, window) => {
    seen.push([window.getPrevInstant(), window.getCurrInstant()]);
  });
  feed(map, every, count);
  return seen;
}

class CountingRTIndicator extends AbstractRTIndicator {
  updates = 0;

  override update(newValue: number): number {
    this.updates++;
    return super.update(newValue);
  }
}

describe("the period of a window", () => {
  it("is a number of whole seconds: 900 closes after 15 minutes of data time", () => {
    // A tick a minute for half an hour
    expect(closes(900, 60_000, 31)).toEqual([
      [START, START + 900_000],
      [START + 900_000, START + 1_800_000],
    ]);
  });

  it("is the same window whether it is a key, seconds, a Duration or a WindowTime member", () => {
    const expected = closes("m15", 60_000, 31);
    expect(expected).toHaveLength(2);
    const forms: WindowPeriod[] = [
      900,
      Duration.ofSeconds(900),
      Duration.ofMinutes(15),
      Duration.ofMillis(900_000),
      WindowTime.m15,
      WindowTime.m15.getDuration(),
    ];
    forms.forEach((form, i) => {
      expect(closes(form, 60_000, 31), `form ${i}`).toEqual(expected);
    });
  });

  it.each(JAVA_WINDOW_TIMES)("closes on the %s of the Java WindowTime in every form QTScript writes", (key) => {
    const length = WindowTime[key].getDuration().toMillis();
    const expected = [
      [START, START + length],
      [START + length, START + 2 * length],
    ];
    // A tick every half window: the window closes on every second tick, at exactly its length
    expect(closes(key, length / 2, 5)).toEqual(expected);
    expect(closes(WindowTime[key].getDuration(), length / 2, 5)).toEqual(expected);
    expect(closes(length / 1000, length / 2, 5)).toEqual(expected);
  });

  it("may be shorter than a second through a Duration", () => {
    expect(closes(Duration.ofMillis(1500), 500, 7)).toEqual([
      [START, START + 1500],
      [START + 1500, START + 3000],
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %s seconds, and registers nothing",
    (seconds) => {
      const { map, group } = priceGroup();
      const size = map.size();
      expect(() => group.window("price", seconds, () => {})).toThrow(/whole number of at least 1/);
      expect(() => group.window().of("price").duration(seconds)).toThrow(/whole number of at least 1/);
      expect(map.size()).toBe(size);
    },
  );

  it("refuses an empty Duration, a fractional one and a key it does not know", () => {
    const { group } = priceGroup();
    expect(() => group.window("price", Duration.ofMillis(0), () => {})).toThrow(/at least 1 ms/);
    expect(() => group.window("price", Duration.ofSeconds(-3), () => {})).toThrow(/at least 1 ms/);
    expect(() => Duration.ofSeconds(1.5)).toThrow(/whole number/);
    expect(() => group.window("price", "m7" as never, () => {})).toThrow(/Unknown window time "m7"/);
    expect(() => group.window("price", "constructor" as never, () => {})).toThrow(/Unknown window time/);
    expect(() => group.window("price", null as never, () => {})).toThrow(/WindowTime key/);
  });

  it("is still checked for a source that is not registered, as before", () => {
    const { group } = priceGroup();
    expect(() => group.window("missing", "s1", () => {})).toThrow(/Indicator not found: missing/);
  });

  it("keeps the delayUpdates form working with every period form", () => {
    for (const period of ["s5", 5, Duration.ofSeconds(5)] as WindowPeriod[]) {
      const { map, group } = priceGroup();
      const seen: Close[] = [];
      group.window("price", period, true, (_store, _prev, _actual, window) => {
        seen.push([window.getPrevInstant(), window.getCurrInstant()]);
      });
      feed(map, 1000, 11);
      expect(seen).toEqual([
        [START, START + 5000],
        [START + 5000, START + 10_000],
      ]);
    }
  });

  it("needs a listener", () => {
    const { group } = priceGroup();
    expect(() => group.window("price", "s1", undefined as never)).toThrow(/needs a listener/);
  });
});

describe("the window builder", () => {
  it("is what window() and window(period) return, with one second as the default length", () => {
    const { group } = priceGroup();
    expect(group.window()).toBeInstanceOf(WindowTimeRTIndicatorBuilder);
    expect(group.window("m1")).toBeInstanceOf(WindowTimeRTIndicatorBuilder);
    expect(group.window().of("price").build().getWindowTimeDuration()).toBe(1000);
    expect(group.window("m1").of("price").build().getWindowTimeDuration()).toBe(60_000);
    expect(group.window(900).of("price").build().getWindowTimeDuration()).toBe(900_000);
    expect(group.window(Duration.ofSeconds(90)).of("price").build().getWindowTimeDuration()).toBe(90_000);
    expect(() => group.window("price" as never)).toThrow(/Unknown window time "price"/);
  });

  it("registers the window under the name it is given", () => {
    const { map, group } = priceGroup();
    const window = group.window().of("price").duration("s5").name("w5").build();
    expect(group.get("w5")).toBe(window);
    expect(map.get("_win1")).toBeUndefined();
    const publicNames: string[] = [];
    map.forEachPublicable((name) => publicNames.push(name));
    expect(publicNames).toContain("w5");
  });

  it("registers an unnamed window under _win1, _win2...; a named one does not use a number", () => {
    const { map, group } = priceGroup();
    const named = group.window().of("price").name("first").build();
    const a = group.window().of("price").build();
    const b = group.window().of("price").build();
    group.window("price", "s1", () => {});
    expect(map.get("first")).toBe(named);
    expect(map.get("_win1")).toBe(a);
    expect(map.get("_win2")).toBe(b);
    expect(map.get("_win3")).toBeInstanceOf(WindowTimeRTIndicator);
    expect(map.get("_win4")).toBeUndefined();
    expect(map.get("_win1")!.isHidden!()).toBe(true);
    expect(InstrumentGroupRTIndicator.PREFIX_WINDOW).toBe("_win");
  });

  it("registers a window handed to addWindow under the next hidden name", () => {
    const { map, group } = priceGroup();
    const window = new WindowTimeRTIndicator("s1", group.getReadOnlyExisting("price"));
    expect(group.addWindow(window)).toBe(group);
    expect(map.get("_win1")).toBe(window);
  });

  it("closes the window it builds, with the listener it is given, on the time of the data", () => {
    const { map, group } = priceGroup();
    const fires: number[] = [];
    group.window().of("price").duration(Duration.ofSeconds(5)).onChangeListener((_s, _p, actual) => fires.push(actual)).build();
    feed(map, 1000, 11);
    expect(fires).toEqual([60, 110]);
  });

  it("hands the listener the store of the group, or the one it is given", () => {
    const { map, group } = priceGroup();
    const own = new StateStore();
    const stores: StateStore[] = [];
    group.window().of("price").duration("s1").onChangeListener((store) => stores.push(store)).build();
    group.window().of("price").duration("s1").stateStoreSupplier(() => own).onChangeListener((store) => stores.push(store)).build();
    feed(map, 1000, 2);
    expect(stores).toHaveLength(2);
    expect(stores[0]).toBe(group.getStateStore());
    expect(stores[1]).toBe(own);
  });

  it("delays the updates of its source to the closes when asked to", () => {
    const delayed = new CountingRTIndicator();
    const eager = new CountingRTIndicator();
    const { map, group } = priceGroup();
    group.window().of(delayed).duration("s5").delayUpdates().build();
    group.window().of(eager).duration("s5").delayUpdates(false).build();
    feed(map, 1000, 6);
    // The first update opens the window, the close at the fifth second updates once more
    expect(delayed.updates).toBe(2);
    expect(eager.updates).toBe(6);
  });

  it("watches the source through a read-only view unless asked for the source itself", () => {
    const { group } = priceGroup();
    const view = group.window().of("price").build();
    const direct = group.window().of("price", false).build();
    expect(view.getIndicator()).toBeInstanceOf(ReadOnlyRTIndicator);
    expect(direct.getIndicator()).toBe(group.get("price"));
  });

  it("fails to build without a source, and for a source that is not registered", () => {
    const { map, group } = priceGroup();
    const size = map.size();
    expect(() => group.window().build()).toThrow(/indicator not set/);
    expect(() => group.window().of("missing")).toThrow(/Indicator not found: missing/);
    expect(() => group.window().of("missing", false)).toThrow(/Indicator not found: missing/);
    expect(map.size()).toBe(size);
  });

  it("builds the same window as the window(source, period, listener) form", () => {
    const viaBuilder: number[] = [];
    const viaForm: number[] = [];
    const a = priceGroup();
    a.group.window().of("price").duration(5).onChangeListener((_s, prev, actual) => viaBuilder.push(prev, actual)).build();
    const b = priceGroup();
    b.group.window("price", 5, (_s, prev, actual) => viaForm.push(prev, actual));
    feed(a.map, 1000, 11);
    feed(b.map, 1000, 11);
    expect(viaBuilder).toEqual(viaForm);
    expect(viaBuilder.length).toBeGreaterThan(0);
  });
});

describe("what a listener gets of its window", () => {
  it("is the window as a fourth argument: its instants are the timestamps the window opened and closed on", () => {
    const { map, group } = priceGroup();
    const seen: Close[] = [];
    group.window("price", "s5", (_store, _prev, _actual, window) => {
      seen.push([window.getPrevInstant(), window.getCurrInstant()]);
    });
    feed(map, 1000, 16);
    expect(seen).toEqual([
      [START, START + 5000],
      [START + 5000, START + 10_000],
      [START + 10_000, START + 15_000],
    ]);
  });

  it("is the window that was built, which moves on at its next close", () => {
    const { map, group } = priceGroup();
    const calls: { window: unknown; prev: number | null }[] = [];
    const built = group
      .window()
      .of("price")
      .duration("s5")
      .onChangeListener((_s, _p, _a, window) => calls.push({ window, prev: window.getPrevInstant() }))
      .build();
    feed(map, 1000, 11);
    expect(calls.map((call) => call.window)).toEqual([built, built]);
    expect(calls[0].window).toBe(built);
    expect(calls.map((call) => call.prev)).toEqual([START, START + 5000]);
    expect(built.getPrevInstant()).toBe(START + 5000);
  });

  it("leaves a listener that takes three arguments, or fewer, as it was", () => {
    const { map, group } = priceGroup();
    const three: [number, number][] = [];
    const four: [number, number][] = [];
    let one = 0;
    const threeArgs: OnChangeListener = (_store, prev, actual) => three.push([prev, actual]);
    group.window("price", "s5", threeArgs);
    group.window("price", "s5", (store) => {
      expect(store).toBe(group.getStateStore());
      one++;
    });
    group.window("price", "s5", (_store, prev, actual, window) => {
      expect(window.getCurrInstant()).not.toBeNull();
      four.push([prev, actual]);
    });
    feed(map, 1000, 11);
    expect(three).toEqual([[10, 60], [60, 110]]);
    expect(four).toEqual(three);
    expect(one).toBe(2);
  });

  it("is one listener serving two windows, each reporting its own instants", () => {
    const { map, group } = priceGroup();
    const seen: Close[] = [];
    const shared: OnChangeListener = (_s, _p, _a, window) => seen.push([window.getPrevInstant(), window.getCurrInstant()]);
    group.window("price", "s2", shared);
    group.window("price", "s5", shared);
    feed(map, 1000, 6);
    // s2 closes at 2s and 4s, s5 at 5s: each window its own boundaries
    expect(seen).toEqual([
      [START, START + 2000],
      [START + 2000, START + 4000],
      [START, START + 5000],
    ]);
  });
});

describe("the Java vocabulary of windows", () => {
  // The Java InstrumentGroupRTIndicator offers window() / window(WindowTime) / window(Duration) for
  // the builder, window(name, int | WindowTime | Duration, listener) for the group, and addWindow
  const JAVA_GROUP_METHODS = ["window", "addWindow", "getStateStore"];
  // The public methods of the Java WindowTimeRTIndicatorBuilder: of(name), of(name, readOnly) and
  // of(indicator) are one method here
  const JAVA_BUILDER_METHODS = [
    "duration",
    "durationMinutes",
    "durationSeconds",
    "durationMillis",
    "onChangeListener",
    "stateStoreSupplier",
    "name",
    "of",
    "build",
  ];

  it.each(JAVA_GROUP_METHODS)("offers %s on the group", (method) => {
    expect(typeof (priceGroup().group as unknown as Record<string, unknown>)[method]).toBe("function");
  });

  it.each(JAVA_BUILDER_METHODS)("offers %s on the builder", (method) => {
    expect(typeof (priceGroup().group.window() as unknown as Record<string, unknown>)[method]).toBe("function");
  });

  it("offers delayUpdates on the builder, which Java only has on the window", () => {
    expect(typeof priceGroup().group.window().delayUpdates).toBe("function");
  });

  it("returns the builder from every chained call, as the Java builder does", () => {
    const builder = priceGroup().group.window();
    expect(builder.duration("m1")).toBe(builder);
    expect(builder.durationMinutes(2)).toBe(builder);
    expect(builder.durationSeconds(30)).toBe(builder);
    expect(builder.durationMillis(1500)).toBe(builder);
    expect(builder.onChangeListener(() => {})).toBe(builder);
    expect(builder.stateStoreSupplier(() => new StateStore())).toBe(builder);
    expect(builder.name("w")).toBe(builder);
    expect(builder.of("price")).toBe(builder);
  });

  it("builds the length the minute, second and millisecond methods say", () => {
    const { group } = priceGroup();
    const length = (build: (builder: WindowTimeRTIndicatorBuilder) => WindowTimeRTIndicatorBuilder) =>
      build(group.window().of("price")).build().getWindowTimeDuration();
    expect(length((b) => b.durationMinutes(2))).toBe(120_000);
    expect(length((b) => b.durationSeconds(30))).toBe(30_000);
    expect(length((b) => b.durationMillis(1500))).toBe(1500);
    expect(() => group.window().durationSeconds(0)).toThrow(/at least 1 ms/);
  });
});
