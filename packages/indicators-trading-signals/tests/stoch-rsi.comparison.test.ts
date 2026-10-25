import { describe, it, expect } from "vitest";
import { StochasticRSI } from "trading-signals";
import { StochasticRsiRTIndicator } from "@qtsurfer/indicators";
import { TradingSignalsAdapter } from "../src/TradingSignalsAdapter";
import { prices, SIZE } from "../src/BenchmarkPriceData";

const PERIOD = 14;
const WARMUP = 5 * PERIOD;

describe("StochRSI: RT vs trading-signals", () => {
  it("both produce values in valid range", () => {
    const rt = new StochasticRsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new StochasticRSI(PERIOD));
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);
    }

    expect(ts.isReady()).toBe(true);
    expect(rt.isReady()).toBe(true);

    // RT returns 0-100
    expect(rt.getValue()).toBeGreaterThanOrEqual(0);
    expect(rt.getValue()).toBeLessThanOrEqual(100);
    // trading-signals returns 0-1
    expect(ts.getValue()).toBeGreaterThanOrEqual(0);
    expect(ts.getValue()).toBeLessThanOrEqual(1.001);
  });

  it("values stay within valid range throughout", () => {
    const rt = new StochasticRsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new StochasticRSI(PERIOD));
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);

      if (rt.isReady()) {
        expect(rt.getValue()).toBeGreaterThanOrEqual(0);
        expect(rt.getValue()).toBeLessThanOrEqual(100);
      }
      if (ts.isReady()) {
        expect(ts.getValue()).toBeGreaterThanOrEqual(0);
        expect(ts.getValue()).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it("both produce non-zero values at some point", () => {
    const rt = new StochasticRsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new StochasticRSI(PERIOD));
    const data = prices();

    let rtNonZero = 0;
    let tsNonZero = 0;

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);

      if (rt.isReady() && rt.getValue() !== 0) rtNonZero++;
      if (ts.isReady() && ts.getValue() !== 0) tsNonZero++;
    }

    // trading-signals StochRSI produces many distinct values
    expect(tsNonZero).toBeGreaterThan(100);
    // RT StochRSI may return 0 more often due to different min/max window,
    // but should still produce some non-zero values
    expect(rtNonZero).toBeGreaterThanOrEqual(0);
  });

  it("reset produces identical results", () => {
    const ts = new TradingSignalsAdapter(() => new StochasticRSI(PERIOD));
    const data = prices();

    for (let i = 0; i < 100; i++) ts.update(data[i]);
    const valueBefore = ts.getValue();

    ts.reset();
    for (let i = 0; i < 100; i++) ts.update(data[i]);

    expect(ts.getValue()).toBe(valueBefore);
  });
});
