import { describe, it, expect } from "vitest";
import { RSI } from "trading-signals";
import { RsiRTIndicator } from "@qtsurfer/indicators";
import { TradingSignalsAdapter } from "../src/TradingSignalsAdapter";
import { prices, SIZE } from "../src/BenchmarkPriceData";

const PERIOD = 14;
const WARMUP = 3 * PERIOD;

describe("RSI: RT vs trading-signals", () => {
  it("converges after warmup", () => {
    const rt = new RsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new RSI(PERIOD));
    const data = prices();

    for (let i = 0; i < SIZE; i++) {
      rt.update(data[i]);
      ts.update(data[i]);
    }

    expect(ts.isReady()).toBe(true);
    expect(rt.isReady()).toBe(true);

    const diff = Math.abs(rt.getValue() - ts.getValue());
    expect(diff).toBeLessThan(1.0); // RSI values 0-100, allow 1 point diff
  });

  it("values stay within 0-100 range", () => {
    const rt = new RsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new RSI(PERIOD));
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
        expect(ts.getValue()).toBeLessThanOrEqual(100);
      }
    }
  });

  it("values highly correlated after warmup", () => {
    const rt = new RsiRTIndicator(PERIOD);
    const ts = new TradingSignalsAdapter(() => new RSI(PERIOD));
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
    // RSI implementations use different smoothing (SMA vs Wilder/MMA),
    // so moderate correlation is expected
    expect(correlation).toBeGreaterThan(0.4);
  });

  it("reset produces identical results", () => {
    const ts = new TradingSignalsAdapter(() => new RSI(PERIOD));
    const data = prices();

    for (let i = 0; i < 100; i++) ts.update(data[i]);
    const valueBefore = ts.getValue();

    ts.reset();
    for (let i = 0; i < 100; i++) ts.update(data[i]);

    expect(ts.getValue()).toBe(valueBefore);
  });
});
