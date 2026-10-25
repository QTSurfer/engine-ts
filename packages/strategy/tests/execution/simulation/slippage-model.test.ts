import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import {
  BarRangeSlippage,
  FixedBpsSlippage,
  NoSlippage,
} from "../../../src/execution/simulation/SlippageModel";

function ticker(partial: Partial<Ticker>): Ticker {
  return {
    instrument: "BTC/USDT",
    open: null,
    high: null,
    low: null,
    last: null,
    bid: null,
    bidSize: null,
    ask: null,
    askSize: null,
    volume: null,
    quoteVolume: null,
    vwap: null,
    percentageChange: null,
    timestamp: 0,
    ...partial,
  };
}

describe("NoSlippage", () => {
  it("returns the signal price unchanged on both sides", () => {
    const m = new NoSlippage();
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: null })).toBe(100);
    expect(m.adjust({ side: "sell", signalPrice: 100, ticker: null })).toBe(100);
  });
});

describe("FixedBpsSlippage", () => {
  it("raises the buy price by bps", () => {
    const m = new FixedBpsSlippage(50); // 0.5%
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: null })).toBeCloseTo(100.5, 6);
  });

  it("lowers the sell price by bps", () => {
    const m = new FixedBpsSlippage(50);
    expect(m.adjust({ side: "sell", signalPrice: 100, ticker: null })).toBeCloseTo(99.5, 6);
  });
});

describe("BarRangeSlippage", () => {
  it("falls back to the signal price when no ticker is available", () => {
    const m = new BarRangeSlippage(1);
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: null })).toBe(100);
  });

  it("interpolates between signal price and bar high on buy", () => {
    const m = new BarRangeSlippage(0.5);
    const t = ticker({ high: 110, low: 90 });
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: t })).toBeCloseTo(105, 6);
  });

  it("interpolates between signal price and bar low on sell", () => {
    const m = new BarRangeSlippage(0.5);
    const t = ticker({ high: 110, low: 90 });
    expect(m.adjust({ side: "sell", signalPrice: 100, ticker: t })).toBeCloseTo(95, 6);
  });

  it("matches the bar extreme when bias = 1", () => {
    const m = new BarRangeSlippage(1);
    const t = ticker({ high: 110, low: 90 });
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: t })).toBeCloseTo(110, 6);
    expect(m.adjust({ side: "sell", signalPrice: 100, ticker: t })).toBeCloseTo(90, 6);
  });

  it("returns the signal price when bias = 0", () => {
    const m = new BarRangeSlippage(0);
    const t = ticker({ high: 110, low: 90 });
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: t })).toBe(100);
  });

  it("clamps a negative headroom (signal price outside bar range)", () => {
    // Signal price above the bar's high → no adverse headroom for a buy.
    const m = new BarRangeSlippage(1);
    const t = ticker({ high: 95, low: 90 });
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: t })).toBe(100);
  });

  it("ignores a null high on buy and null low on sell", () => {
    const m = new BarRangeSlippage(1);
    expect(m.adjust({ side: "buy", signalPrice: 100, ticker: ticker({ low: 90 }) })).toBe(100);
    expect(m.adjust({ side: "sell", signalPrice: 100, ticker: ticker({ high: 110 }) })).toBe(100);
  });
});
