import { describe, it, expect } from "vitest";
import type { Ticker } from "../src/Ticker";
import { TickerValueSource, getTickerValue } from "../src/TickerValueSource";

const TEST_TICKER: Ticker = {
  instrument: "BTC/USDT",
  open: 100,
  high: 110,
  low: 90,
  last: 105,
  bid: 104,
  bidSize: 1.5,
  ask: 106,
  askSize: 2.0,
  volume: 5000,
  quoteVolume: 500000,
  vwap: 103,
  percentageChange: 5.0,
  timestamp: 1700000000000,
};

describe("getTickerValue", () => {
  it("returns bid", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Bid)).toBe(104);
  });

  it("returns bidSize", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.BidSize)).toBe(1.5);
  });

  it("returns ask", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Ask)).toBe(106);
  });

  it("returns askSize", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.AskSize)).toBe(2.0);
  });

  it("returns open", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Open)).toBe(100);
  });

  it("returns high", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.High)).toBe(110);
  });

  it("returns low", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Low)).toBe(90);
  });

  it("returns close (last)", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Close)).toBe(105);
  });

  it("returns vwap", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Vwap)).toBe(103);
  });

  it("returns volume", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.Volume)).toBe(5000);
  });

  it("returns volumeQuote", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.VolumeQuote)).toBe(
      500000,
    );
  });

  it("returns percentChange", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.PercentChange)).toBe(
      5.0,
    );
  });

  it("AutoAskClose returns last when available", () => {
    expect(getTickerValue(TEST_TICKER, TickerValueSource.AutoAskClose)).toBe(
      105,
    );
  });

  it("AutoAskClose falls back to ask when last is null", () => {
    const ticker: Ticker = { ...TEST_TICKER, last: null };
    expect(getTickerValue(ticker, TickerValueSource.AutoAskClose)).toBe(106);
  });

  it("AutoAskClose falls back to ask when last is NaN, as the Java engine does", () => {
    const ticker: Ticker = { ...TEST_TICKER, last: NaN };
    expect(getTickerValue(ticker, TickerValueSource.AutoAskClose)).toBe(106);
  });

  it("AutoAskClose returns null when both last and ask are null", () => {
    const ticker: Ticker = { ...TEST_TICKER, last: null, ask: null };
    expect(getTickerValue(ticker, TickerValueSource.AutoAskClose)).toBeNull();
  });

  it("returns null for null fields", () => {
    const ticker: Ticker = { ...TEST_TICKER, bid: null };
    expect(getTickerValue(ticker, TickerValueSource.Bid)).toBeNull();
  });
});
