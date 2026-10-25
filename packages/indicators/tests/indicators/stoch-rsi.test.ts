import { describe, it, expect } from "vitest";
import { StochasticRsiRTIndicator } from "$indicators/StochasticRsiRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("StochasticRsiRTIndicator", () => {
  it("testThatRsiValueIsAPercentage", () => {
    const stochRsi = new StochasticRsiRTIndicator(14);
    for (const price of CLOSE_PRICES_LIST) {
      const result = stochRsi.update(price);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("testBasicCalculation", () => {
    const stochRsi = new StochasticRsiRTIndicator(3);
    const values = [10, 12, 11, 13, 14, 12, 15, 16, 14, 17];
    for (const v of values) {
      const result = stochRsi.update(v);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("testFromFixturesFirst14Periods", () => {
    const stochRsi = new StochasticRsiRTIndicator(14);
    for (let i = 0; i < 14; i++) {
      stochRsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(stochRsi.getValue()).toBeGreaterThanOrEqual(0);
    expect(stochRsi.getValue()).toBeLessThanOrEqual(100);

    for (let i = 14; i < 28; i++) {
      stochRsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(stochRsi.getValue()).toBeGreaterThanOrEqual(0);
    expect(stochRsi.getValue()).toBeLessThanOrEqual(100);
    expect(stochRsi.periodCycles).toBe(2);
  });

  it("testWithSMASmoothing", () => {
    const stochRsi = new StochasticRsiRTIndicator(14, null, true);
    for (let i = 0; i < 14; i++) {
      stochRsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(stochRsi.getValue()).toBeGreaterThanOrEqual(0);
    expect(stochRsi.getValue()).toBeLessThanOrEqual(100);
  });

  it("testWithMMASmoothing", () => {
    const stochRsi = new StochasticRsiRTIndicator(14, null, false);
    for (let i = 0; i < 14; i++) {
      stochRsi.update(CLOSE_PRICES_LIST[i]);
    }
    expect(stochRsi.getValue()).toBeGreaterThanOrEqual(0);
    expect(stochRsi.getValue()).toBeLessThanOrEqual(100);
  });

  it("testReset", () => {
    const stochRsi = new StochasticRsiRTIndicator(14);
    const results: number[] = [];
    for (let i = 0; i < 14; i++) {
      results.push(stochRsi.update(CLOSE_PRICES_LIST[i]));
    }
    const valueBefore = stochRsi.getValue();

    stochRsi.reset();
    expect(stochRsi.getValue()).toBe(0.0);
    expect(stochRsi.periodCycles).toBe(0);

    for (let i = 0; i < 14; i++) {
      expect(stochRsi.update(CLOSE_PRICES_LIST[i])).toBe(results[i]);
    }
    expect(stochRsi.getValue()).toBe(valueBefore);
  });

  it("computes values that vary and are not stuck at zero", () => {
    const stochRsi = new StochasticRsiRTIndicator(14);
    const values = CLOSE_PRICES_LIST.map((price) => stochRsi.update(price));
    expect(Math.max(...values)).toBeGreaterThan(50);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(10);
  });

  it("is the position of the RSI inside the RSI range of the last periods", () => {
    // Cutler RSI(3) over 10, 12, 11, 13, 14, 13. It moves at the end of each period (ticks 3 and 6)
    // and the averages are held in between.
    //   tick 3: avg gain (0 + 2 + 0) / 3 = 2/3, avg loss (0 + 0 + 1) / 3 = 1/3, RS 2, RSI 100 - 100/3
    //   tick 6: avg gain (2 + 1 + 0) / 3 = 1,   avg loss (0 + 0 + 1) / 3 = 1/3, RS 3, RSI 75
    // RSI by tick: 0, 0, 66.67, 66.67, 66.67, 75. StochRSI is 100 * (rsi - min) / (max - min) over
    // the last 3 RSI values:
    //   tick 1: [0]                  num 0 -> 0
    //   tick 2: [0, 0]               num 0 -> 0
    //   tick 3: [0, 0, 66.67]        100 * 66.67 / 66.67 = 100
    //   tick 4: [0, 66.67, 66.67]    100 * 66.67 / 66.67 = 100
    //   tick 5: [66.67 x3]           num 0 -> 0
    //   tick 6: [66.67, 66.67, 75]   100 * 8.33 / 8.33 = 100
    const stochRsi = new StochasticRsiRTIndicator(3);
    expect([10, 12, 11, 13, 14, 13].map((price) => stochRsi.update(price))).toEqual([0, 0, 100, 100, 0, 100]);
  });
});
