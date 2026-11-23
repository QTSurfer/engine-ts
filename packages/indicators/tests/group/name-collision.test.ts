import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

// A name reads one indicator, the last one registered under it. The two change builders used to
// default to the same name, so the second one silently replaced the first and a strategy read one
// believing it read the other; they have names of their own now, and registering a name that is
// already in use says so.

const INSTRUMENT = "BTC/USDT";

function tick(price: number): Ticker {
  return {
    instrument: INSTRUMENT,
    open: price,
    high: price,
    low: price,
    last: price,
    bid: price,
    bidSize: 1,
    ask: price,
    askSize: 1,
    volume: 5,
    quoteVolume: 0,
    vwap: price,
    percentageChange: 0,
    timestamp: 0,
  };
}

const group = () => new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();

describe("a name that is registered twice", () => {
  let warn: MockInstance;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("rateChange and percentChange keep their own default names", () => {
    const g = group().rateChange("price").percentChange("price");

    const names: string[] = [];
    g.indicators.forEachPublicable((name) => names.push(name));
    expect(names).toContain("chgprice");
    expect(names).toContain("pchgprice");
    expect(InstrumentGroupRTIndicator.PREFIX_RATE_CHANGE).toBe("chg");
    expect(InstrumentGroupRTIndicator.PREFIX_PERCENT_CHANGE).toBe("pchg");

    g.indicators.updateFrom(tick(100));
    g.indicators.updateFrom(tick(110));
    expect(g.getIndicatorValue("chgprice"), "a fraction").toBeCloseTo(0.1, 9);
    expect(g.getIndicatorValue("pchgprice"), "a percentage").toBeCloseTo(10, 9);
    expect(warn).not.toHaveBeenCalled();
  });

  it("the order they are registered in no longer matters", () => {
    const g = group().percentChange("price").rateChange("price");

    g.indicators.updateFrom(tick(100));
    g.indicators.updateFrom(tick(110));

    expect(g.getIndicatorValue("chgprice")).toBeCloseTo(0.1, 9);
    expect(g.getIndicatorValue("pchgprice")).toBeCloseTo(10, 9);
  });

  it("says so when another indicator takes the name, and the last one is the one read", () => {
    const g = group().sma("avg", 3);

    g.ema("avg", 3);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toBe("The name 'avg' now reads a different indicator: ema replaced sma");
    expect(g.getExisting("avg").getId!()).toBe("ema");
  });

  it("says nothing for a name used for the first time or the same indicator again", () => {
    const g = group();
    const same = ValueRTIndicator.of(1);

    g.sma("avg", 3);
    g.indicators.add("fixed", same);
    g.indicators.add("fixed", same);

    expect(warn).not.toHaveBeenCalled();
  });
});
