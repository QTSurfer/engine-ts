import { describe, it, expect } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import { KlineValueSource } from "@qtsurfer/core";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "$group/InstrumentMapKlineSourceRTIndicator";

/**
 * A value that is not finite (NaN, ±Infinity) never reaches an accumulator: an incremental indicator
 * holds its value and its tick count, the maps' scalar path skips it, and a kline map holds the
 * indicators that read the whole bar when one of its prices is not finite. The expected values are
 * the Java engine's on the same input.
 */

const INSTRUMENT = "BTC/USDT";

function tick(last: number): Ticker {
  return {
    instrument: INSTRUMENT,
    open: last,
    high: last,
    low: last,
    last,
    bid: last,
    bidSize: 1,
    ask: last,
    askSize: 1,
    volume: 5,
    quoteVolume: 0,
    vwap: last,
    percentageChange: 0,
    timestamp: 0,
  };
}

function bar(open: number, high: number, low: number, close: number): Kline {
  return { instrument: INSTRUMENT, open, high, low, close, volume: 1, quoteVolume: close, numberOfTrades: 1, timestamp: 0 };
}

describe("an incremental indicator", () => {
  it("holds its value through NaN and ±Infinity", () => {
    const ema = new EmaRTIndicator(3);
    expect([10, NaN, Infinity, 11].map((v) => ema.update(v))).toEqual([10, 10, 10, 10.5]);
    expect(ema.isReady()).toBe(false);
  });

  it("does not count a value it leaves out as a tick, so later periods do not shift", () => {
    const sma = new SmaRTIndicator(3);
    expect([1, 2, 3, NaN, 4, 5, 6, 7, 8, 9].map((v) => sma.update(v))).toEqual([1, 1, 2, 2, 2, 2, 5, 5, 5, 8]);
    expect(sma.isReady()).toBe(true);
  });
});

describe("a ticker map", () => {
  it("skips a price that is not finite on its scalar path", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).ema(3);
    group.indicators.updateFrom(tick(10));
    group.indicators.updateFrom({ ...tick(Infinity), ask: Infinity });
    group.indicators.updateFrom(tick(11));
    expect(group.getIndicatorValue("ema3")).toBe(10.5);
  });
});

describe("a kline map", () => {
  it("holds the indicators that read the whole bar on a bar with a price that is not finite", () => {
    const map = new InstrumentMapKlineSourceRTIndicator(INSTRUMENT);
    const group = new InstrumentGroupRTIndicator(map).add("close", KlineValueSource.Close).ema(1);
    map.updateFrom(bar(2, 2, 2, 2));
    map.updateFrom(bar(1, NaN, 1, 1));
    // The close reader reads the whole bar and is held; the EMA takes the close through the scalar path
    expect(group.getIndicatorValue("close")).toBe(2);
    expect(group.getIndicatorValue("ema1")).toBe(1);
  });

  it("skips a close that is not finite on its scalar path", () => {
    const map = new InstrumentMapKlineSourceRTIndicator(INSTRUMENT);
    const group = new InstrumentGroupRTIndicator(map).ema(1);
    map.updateFrom(bar(2, 2, 2, 2));
    map.updateFrom(bar(2, 2, 2, NaN));
    expect(group.getIndicatorValue("ema1")).toBe(2);
  });
});
