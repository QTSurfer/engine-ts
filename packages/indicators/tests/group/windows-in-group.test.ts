import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { StateStore } from "@qtsurfer/core";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapTickerSourceRTIndicator } from "$group/InstrumentMapTickerSourceRTIndicator";
import { WindowTimeRTIndicator } from "$helpers/WindowTimeRTIndicator";

const INSTRUMENT = "BTC/USDT";
const START = 1_700_000_000_000;

function tick(price: number, timestamp: number): Ticker {
  return {
    instrument: INSTRUMENT, open: null, high: null, low: null, last: price, bid: price, bidSize: null,
    ask: price, askSize: null, volume: null, quoteVolume: null, vwap: null, percentageChange: null, timestamp,
  };
}

function groupWithWindow(listener: (store: StateStore, prev: number, actual: number) => void) {
  const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
  const group = new InstrumentGroupRTIndicator(map);
  group.addPrice().ema("ema", 3).window("ema", "s5", listener);
  return { map, group };
}

// Prices 10, 20, 30, ... one second apart; ema(3) has alpha 0.5 and starts at the first price:
//   ema_0 = 10, ema_i = 0.5 * ema_(i-1) + 0.5 * price_i
//   10, 15, 22.5, 31.25, 40.625, 50.3125, 60.15625, 70.078125, 80.0390625, 90.01953125, 100.009765625
const EMA = [10, 15, 22.5, 31.25, 40.625, 50.3125, 60.15625, 70.078125, 80.0390625, 90.01953125, 100.009765625];

describe("a window in a group, in a backtest", () => {
  it("closes after the time of the data, not the time of the machine", () => {
    const fires: { prev: number; actual: number }[] = [];
    const { map } = groupWithWindow((_store, prev, actual) => fires.push({ prev, actual }));
    map.setBacktestEnabled(true);

    // Eleven ticks in a few milliseconds of real time, but ten seconds of data time
    for (let i = 0; i <= 10; i++) {
      map.updateFrom(tick(10 * (i + 1), START + i * 1000));
    }

    // A window batches: it holds the value it had when it opened (the first value, then the
    // value at the last close) and reports it as prev when the next five seconds are over
    expect(fires).toEqual([
      { prev: EMA[0], actual: EMA[5] },
      { prev: EMA[5], actual: EMA[10] },
    ]);
  });

  it("reports the boundaries of the window it closes by the timestamps of the data", () => {
    const { map } = groupWithWindow(() => {});
    map.setBacktestEnabled(true);
    for (let i = 0; i < 6; i++) {
      map.updateFrom(tick(10 * (i + 1), START + i * 1000));
    }

    const window = map.get("_win1") as WindowTimeRTIndicator;
    expect(window.getPrevInstant()).toBe(START);
    expect(window.getCurrInstant()).toBe(START + 5000);
  });

  it("never closes in a short run when it is not a backtest: it reads the clock of the machine", () => {
    const fires: number[] = [];
    const { map } = groupWithWindow((_store, _prev, actual) => fires.push(actual));

    for (let i = 0; i < 6; i++) {
      map.updateFrom(tick(10 * (i + 1), START + i * 1000));
    }

    expect(fires).toEqual([]);
  });

  it("leaves the source indicator under its own name, updated on every tick", () => {
    const { map, group } = groupWithWindow(() => {});
    map.setBacktestEnabled(true);
    for (let i = 0; i < 4; i++) {
      map.updateFrom(tick(10 * (i + 1), START + i * 1000));
    }

    expect(group.get("ema")).not.toBeInstanceOf(WindowTimeRTIndicator);
    expect(map.getIndicatorValue("ema")).toBe(EMA[3]);
    expect(map.get("_win1")).toBeInstanceOf(WindowTimeRTIndicator);
  });

  it("keeps the window out of the public indicators", () => {
    const { map } = groupWithWindow(() => {});
    const names: string[] = [];
    map.forEachPublicable((name) => names.push(name));
    expect(names).toContain("ema");
    expect(names.some((name) => name.startsWith("_"))).toBe(false);
  });

  it("hands every window of the group the group's state store", () => {
    const stores: StateStore[] = [];
    const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
    const group = new InstrumentGroupRTIndicator(map);
    const shared = new StateStore();
    group.setStateStoreSupplier(() => shared);
    group
      .addPrice()
      .ema("ema", 3)
      .window("ema", "s1", (store) => stores.push(store))
      .window("price", "s1", (store) => stores.push(store));
    map.setBacktestEnabled(true);

    map.updateFrom(tick(10, START));
    map.updateFrom(tick(20, START + 1000));

    expect(stores).toHaveLength(2);
    expect(stores[0]).toBe(shared);
    expect(stores[1]).toBe(shared);
  });

  it("gives the group a store of its own when nothing supplies one", () => {
    const stores = new Set<StateStore>();
    const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
    const group = new InstrumentGroupRTIndicator(map);
    group
      .addPrice()
      .window("price", "s1", (store) => stores.add(store))
      .window("price", "s1", (store) => stores.add(store));
    map.setBacktestEnabled(true);
    map.updateFrom(tick(10, START));
    map.updateFrom(tick(20, START + 1000));

    expect(stores.size).toBe(1);
    expect([...stores][0]).toBe(group.getStateStore());
  });
});
