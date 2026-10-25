import { describe, it, expect } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import { AtrRTIndicator } from "$indicators/AtrRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "$group/InstrumentMapKlineSourceRTIndicator";

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

describe("AtrRTIndicator", () => {
  it("testKnownValues_wilder14", () => {
    const ohlc = [
      [48.70, 47.79, 48.16],
      [48.72, 48.14, 48.61],
      [48.90, 48.39, 48.75],
      [48.87, 48.37, 48.63],
      [48.82, 48.24, 48.74],
      [49.05, 48.64, 49.03],
      [49.20, 48.94, 49.07],
      [49.35, 48.86, 49.32],
      [49.92, 49.50, 49.91],
      [50.19, 49.87, 50.13],
      [50.12, 49.20, 49.53],
      [49.66, 48.90, 49.50],
      [49.88, 49.43, 49.75],
      [50.19, 49.73, 50.03],
    ];

    const atr = new AtrRTIndicator(14);
    for (const bar of ohlc) {
      atr.updateOhlc(bar[0], bar[1], bar[2]);
    }

    // Compute expected TRs manually
    const trs: number[] = new Array(14);
    trs[0] = ohlc[0][0] - ohlc[0][1];
    for (let i = 1; i < 14; i++) {
      const [high, low] = ohlc[i];
      const prevClose = ohlc[i - 1][2];
      trs[i] = Math.max(high - low, Math.max(Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    let expectedFirstATR = 0;
    for (const tr of trs) expectedFirstATR += tr;
    expectedFirstATR /= 14;

    expect(atr.getValue()).toBeCloseTo(expectedFirstATR, 10);
  });

  it("testWilderSmoothing", () => {
    const atr = new AtrRTIndicator(3);
    atr.updateOhlc(10, 8, 9);   // TR = 2
    atr.updateOhlc(11, 9, 10);  // TR = max(2, |11-9|, |9-9|) = 2
    atr.updateOhlc(12, 10, 11); // TR = max(2, |12-10|, |10-10|) = 2
    expect(atr.getValue()).toBeCloseTo(2.0, 10);

    atr.updateOhlc(13, 9, 12); // TR = max(4, |13-11|, |9-11|) = 4
    expect(atr.getValue()).toBeCloseTo(2.0 + (4.0 - 2.0) / 3, 10);
  });

  it("testConstantInput_convergesZero", () => {
    const atr = new AtrRTIndicator(5);
    for (let i = 0; i < 100; i++) {
      atr.updateOhlc(42, 42, 42);
    }
    expect(atr.getValue()).toBeCloseTo(0.0, 10);
  });

  it("testResetReproducibility", () => {
    const atr = new AtrRTIndicator(3);
    const bars = [
      [10, 8, 9], [11, 9, 10], [12, 10, 11], [13, 9, 12], [14, 11, 13],
    ];
    for (const bar of bars) atr.updateOhlc(bar[0], bar[1], bar[2]);
    const valueBeforeReset = atr.getValue();

    atr.reset();
    expect(atr.getValue()).toBe(0);

    for (const bar of bars) atr.updateOhlc(bar[0], bar[1], bar[2]);
    expect(atr.getValue()).toBeCloseTo(valueBeforeReset, 10);
  });

  it("testLargeSeries", () => {
    const atr = new AtrRTIndicator(14);
    let close = 100;
    for (let i = 0; i < 10_000; i++) {
      const volatility = 1.0 + Math.sin(i * 0.01) * 0.5;
      const high = close + volatility;
      const low = close - volatility;
      close = (high + low) / 2 + Math.sin(i * 0.1) * 0.2;
      atr.updateOhlc(high, low, close);
    }
    expect(atr.getValue()).toBeGreaterThan(0);
    expect(atr.getValue()).toBeLessThan(Infinity);
  });

  it("testUpdateWithPrecomputedTR", () => {
    const atr = new AtrRTIndicator(3);
    atr.update(2.0);
    atr.update(2.0);
    atr.update(2.0);
    expect(atr.getValue()).toBeCloseTo(2.0, 10);

    atr.update(4.0);
    expect(atr.getValue()).toBeCloseTo(2.0 + (4.0 - 2.0) / 3, 10);
  });

  it("testFirstBarTrIsHighMinusLow", () => {
    const atr = new AtrRTIndicator(1);
    atr.updateOhlc(50, 40, 45);
    expect(atr.getValue()).toBeCloseTo(10.0, 10);
  });

  it("testGapUp", () => {
    const atr = new AtrRTIndicator(2);
    atr.updateOhlc(50, 40, 45); // TR = 10
    atr.updateOhlc(55, 50, 52); // TR = max(5, 10, 5) = 10
    expect(atr.getValue()).toBeCloseTo(10.0, 10);
  });

  it("testGapDown", () => {
    const atr = new AtrRTIndicator(2);
    atr.updateOhlc(50, 40, 45); // TR = 10
    atr.updateOhlc(38, 30, 35); // TR = max(8, 7, 15) = 15
    expect(atr.getValue()).toBeCloseTo(12.5, 10);
  });

  it("leaves out a bar with a value that is not finite, as the Java engine does", () => {
    const atr = new AtrRTIndicator(2);
    atr.updateOhlc(50, 40, 45); // TR = 10
    atr.updateOhlc(NaN, 40, 45);
    atr.updateOhlc(50, Infinity, 45);
    expect(atr.getValue()).toBe(10);
    expect(atr.isReady()).toBe(false);
    atr.updateOhlc(38, 30, 35); // TR = 15, the second bar
    expect(atr.getValue()).toBeCloseTo(12.5, 10);
  });

  it("updates from a bar as from its high, low and close", () => {
    const bars = [
      [50, 40, 45],
      [55, 50, 52],
      [38, 30, 35],
    ];
    const fromBars = new AtrRTIndicator(2);
    const fromValues = new AtrRTIndicator(2);
    for (const [high, low, close] of bars) {
      fromBars.updateFrom({ instrument: "X", open: close, high, low, close, volume: 0, quoteVolume: 0, numberOfTrades: 0, timestamp: 0 });
      fromValues.updateOhlc(high, low, close);
      expect(fromBars.getValue()).toBe(fromValues.getValue());
    }
  });
});

describe("an ATR registered in a group", () => {
  function bar(high: number, low: number, close: number): Kline {
    return {
      instrument: INSTRUMENT,
      open: close,
      high,
      low,
      close,
      volume: 1,
      quoteVolume: close,
      numberOfTrades: 1,
      timestamp: 0,
    };
  }

  /** Bars of (high, low, close). True ranges 2, 3, 4: ATR(2) is 2, then (2 + 3) / 2, then Wilder's 2.5 + (4 - 2.5) / 2. */
  const BARS: [number, number, number][] = [
    [10, 8, 9],
    [12, 9, 11],
    [11, 7, 8],
  ];
  const ATR2 = [2, 2.5, 3.25];

  function klineGroup(): InstrumentGroupRTIndicator {
    return new InstrumentGroupRTIndicator(new InstrumentMapKlineSourceRTIndicator(INSTRUMENT));
  }

  it("reads each bar's high, low and close on a kline group, not the close alone", () => {
    const group = klineGroup().add("atr2", new AtrRTIndicator(2));
    const values = BARS.map(([high, low, close]) => {
      group.indicators.updateFrom(bar(high, low, close));
      return group.getIndicatorValue("atr2");
    });
    expect(values).toEqual(ATR2);
  });

  it("reads a ticker's high, low and last price on a ticker group", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).add("atr2", new AtrRTIndicator(2));
    const values = BARS.map(([high, low, last]) => {
      group.indicators.updateFrom({ ...tick(last), high, low });
      return group.getIndicatorValue("atr2");
    });
    expect(values).toEqual(ATR2);
  });

  it("leaves a ticker without a high or a low out, as if it had not arrived", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).add("atr2", new AtrRTIndicator(2));
    const [first, second] = BARS;
    group.indicators.updateFrom({ ...tick(first[2]), high: first[0], low: first[1] });
    group.indicators.updateFrom({ ...tick(50), high: null });
    expect(group.getIndicatorValue("atr2")).toBe(ATR2[0]);
    group.indicators.updateFrom({ ...tick(second[2]), high: second[0], low: second[1] });
    expect(group.getIndicatorValue("atr2")).toBe(ATR2[1]);
  });
});
