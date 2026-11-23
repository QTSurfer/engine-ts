import { describe, expect, it } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";

// min, max and sum of another indicator take what it gives once it is ready. An RSI says 0 while it
// warms up, so a minimum that took that 0 would stay at 0 for the whole run and a sum would carry it
// for ever.

const INSTRUMENT = "BTC/USDT";
const CLOSES = [100, 110, 110, 99, 101, 104, 103, 80, 120, 120];

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

const group = () =>
  new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().rsi(3).min("minr", "rsi3").max("maxr", "rsi3").sum("sumr", "rsi3");

describe("min, max and sum of an indicator that warms up", () => {
  it("start at its first ready value", () => {
    const g = group();
    const ready: number[] = [];

    for (const close of CLOSES) {
      g.indicators.updateFrom(tick(close));
      if (g.getExisting("rsi3").isReady()) {
        ready.push(g.getIndicatorValue("rsi3"));
        expect(g.getIndicatorValue("minr"), `min after ${ready.length} ready values`).toBeCloseTo(Math.min(...ready), 9);
        expect(g.getIndicatorValue("maxr"), `max after ${ready.length} ready values`).toBeCloseTo(Math.max(...ready), 9);
        expect(g.getIndicatorValue("sumr"), `sum after ${ready.length} ready values`).toBeCloseTo(
          ready.reduce((total, value) => total + value, 0),
          9,
        );
      }
    }

    expect(ready.length).toBeGreaterThan(0);
    expect(g.getIndicatorValue("minr"), "not the 0 the RSI starts with").toBeGreaterThan(0);
  });

  it("accumulate nothing while the source warms up", () => {
    const g = group();

    g.indicators.updateFrom(tick(100));
    g.indicators.updateFrom(tick(110));

    expect(g.getExisting("rsi3").isReady()).toBe(false);
    for (const name of ["minr", "maxr", "sumr"]) {
      expect(g.getExisting(name).isReady(), name).toBe(false);
      expect(g.getIndicatorValue(name), `${name} holds its start`).toBe(0);
    }
  });

  it("leave a source that is ready from the first value untouched", () => {
    const g = new InstrumentGroupRTIndicator(INSTRUMENT)
      .addPrice()
      .min("minp", "price")
      .max("maxp", "price")
      .sum("sump", "price");

    for (const close of CLOSES) {
      g.indicators.updateFrom(tick(close));
    }

    expect(g.getIndicatorValue("minp")).toBe(80);
    expect(g.getIndicatorValue("maxp")).toBe(120);
    expect(g.getIndicatorValue("sump")).toBe(CLOSES.reduce((total, value) => total + value, 0));
  });
  it("leave out the partial values of an average that is still filling", () => {
    // The average of 3 says 200 and 195 before it is ready, and 163.3 then 126.7 and so on once it
    // is: only the ready values count, so the maximum is 163.3 and not the 200 it said at first.
    const falling = new InstrumentGroupRTIndicator(INSTRUMENT)
      .addPrice()
      .sma("avg", 3)
      .max("maxa", "avg")
      .sum("suma", "avg");
    const readyValues: number[] = [];
    for (const close of [200, 190, 100, 90, 80, 70]) {
      falling.indicators.updateFrom(tick(close));
      if (falling.getExisting("avg").isReady()) {
        readyValues.push(falling.getIndicatorValue("avg"));
      }
    }
    expect(readyValues).toHaveLength(4);
    expect(falling.getIndicatorValue("maxa")).toBeCloseTo(Math.max(...readyValues), 9);
    expect(falling.getIndicatorValue("suma")).toBeCloseTo(
      readyValues.reduce((total, value) => total + value, 0),
      9,
    );

    // The same the other way round: the partial values are the lowest, and the minimum ignores them.
    const rising = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().sma("avg", 3).min("mina", "avg");
    const risingReady: number[] = [];
    for (const close of [10, 20, 100, 110, 120, 130]) {
      rising.indicators.updateFrom(tick(close));
      if (rising.getExisting("avg").isReady()) {
        risingReady.push(rising.getIndicatorValue("avg"));
      }
    }
    expect(rising.getIndicatorValue("mina")).toBeCloseTo(Math.min(...risingReady), 9);
  });
});
