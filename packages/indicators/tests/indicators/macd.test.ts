import { describe, it, expect } from "vitest";
import { MacdRTIndicator } from "$indicators/MacdRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("MacdRTIndicator", () => {
  it("testDefaultPeriods", () => {
    const macd = new MacdRTIndicator();
    expect(macd.update(100)).toBe(0.0);
  });

  it("testCustomPeriods", () => {
    const macd = new MacdRTIndicator(null, 3, 5);
    expect(macd.update(10)).toBe(0.0);
    expect(macd.update(20)).toBeGreaterThan(0.0);
  });

  it("testMacdSignConvergence", () => {
    const macd = new MacdRTIndicator(null, 3, 5);
    for (let i = 1; i <= 10; i++) {
      macd.update(i * 10);
    }
    expect(macd.getValue()).toBeGreaterThan(0.0);
  });

  it("testMacdNegativeOnDecline", () => {
    const macd = new MacdRTIndicator(null, 3, 5);
    for (let i = 0; i < 5; i++) {
      macd.update(100);
    }
    for (let i = 0; i < 10; i++) {
      macd.update(50);
    }
    expect(macd.getValue()).toBeLessThanOrEqual(0.0);
  });

  it("testWithDecoratedIndicator", () => {
    const macd = new MacdRTIndicator(new SmaRTIndicator(), 3, 5);
    for (let i = 1; i <= 10; i++) {
      const result = macd.update(i * 10);
      expect(result).not.toBeNaN();
    }
  });

  it("testReset", () => {
    const macd = new MacdRTIndicator(null, 3, 5);
    const values = [10, 20, 30];
    const results: number[] = [];
    for (const v of values) {
      results.push(macd.update(v));
    }

    macd.reset();
    expect(macd.getValue()).toBe(0.0);

    for (let i = 0; i < values.length; i++) {
      expect(macd.update(values[i])).toBe(results[i]);
    }
  });


  describe("readiness", () => {
    it("is ready when the slower EMA is", () => {
      const macd = new MacdRTIndicator(null, 3, 5);

      for (let tick = 1; tick <= 8; tick++) {
        macd.update(10 * tick);
        expect(macd.isReady(), `tick ${tick}`).toBe(tick >= 5);
      }
    });

    it("the default MACD is ready after the long period", () => {
      const macd = new MacdRTIndicator();

      for (let tick = 1; tick <= 30; tick++) {
        macd.update(100 + tick);
        expect(macd.isReady(), `tick ${tick}`).toBe(tick >= 26);
      }
    });

    it("is not ready again after a reset", () => {
      const macd = new MacdRTIndicator(null, 3, 5);
      for (let tick = 1; tick <= 8; tick++) macd.update(10 * tick);
      expect(macd.isReady()).toBe(true);

      macd.reset();

      expect(macd.isReady()).toBe(false);
      for (let tick = 1; tick <= 4; tick++) {
        macd.update(10 * tick);
        expect(macd.isReady(), `tick ${tick} after reset`).toBe(false);
      }
      macd.update(50);
      expect(macd.isReady()).toBe(true);
    });
  });
});
