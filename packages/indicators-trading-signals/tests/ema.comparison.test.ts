import { describe, it, expect } from "vitest";
import { EMA } from "trading-signals";
import { EmaRTIndicator } from "@qtsurfer/indicators";
import { TradingSignalsAdapter } from "../src/TradingSignalsAdapter";
import { prices, SIZE } from "../src/BenchmarkPriceData";

const PERIOD = 20;
const WARMUP = 3 * PERIOD;

describe("EMA: RT vs trading-signals", () => {
  it("converges after warmup", () => {
    const rt = new EmaRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new EMA(PERIOD));
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);
    }

    expect(ts.isReady()).toBe(true);
    expect(rt.isReady()).toBe(true);

    const diff = Math.abs(rt.getValue() - ts.getValue());
    expect(diff).toBeLessThan(0.02);
  });

  it("values stay within price range", () => {
    const rt = new EmaRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new EMA(PERIOD));
    const data = prices();

    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < SIZE; i++) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
      rt.update(data[i]);
      ts.update(data[i]);
    }

    expect(rt.getValue()).toBeGreaterThanOrEqual(min);
    expect(rt.getValue()).toBeLessThanOrEqual(max);
    expect(ts.getValue()).toBeGreaterThanOrEqual(min);
    expect(ts.getValue()).toBeLessThanOrEqual(max);
  });

  it("values highly correlated after warmup", () => {
    const rt = new EmaRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new EMA(PERIOD));
    const data = prices();

    const rtValues: number[] = [];
    const tsValues: number[] = [];

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);
      if (i > WARMUP && ts.isReady()) {
        rtValues.push(rt.getValue());
        tsValues.push(ts.getValue());
      }
    }

    // Pearson correlation
    const n = rtValues.length;
    const meanRt = rtValues.reduce((a, b) => a + b, 0) / n;
    const meanTs = tsValues.reduce((a, b) => a + b, 0) / n;
    let num = 0, denRt = 0, denTs = 0;
    for (let i = 0; i < n; i++) {
      const dr = rtValues[i] - meanRt;
      const dt = tsValues[i] - meanTs;
      num += dr * dt;
      denRt += dr * dr;
      denTs += dt * dt;
    }
    const correlation = num / Math.sqrt(denRt * denTs);
    expect(correlation).toBeGreaterThan(0.99);
  });

  it("reset produces identical results", () => {
    const ts = new TradingSignalsAdapter(() => new EMA(PERIOD));
    const data = prices();

    for (let i = 0; i < 100; i++) ts.update(data[i]);
    const valueBefore = ts.getValue();

    ts.reset();
    for (let i = 0; i < 100; i++) ts.update(data[i]);

    expect(ts.getValue()).toBe(valueBefore);
  });
});
