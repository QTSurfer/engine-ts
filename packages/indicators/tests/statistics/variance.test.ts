import { describe, it, expect } from "vitest";
import { VarianceRTIndicator } from "$statistics/VarianceRTIndicator";
import { exactPopulationVariance, quietPrices } from "../exact-variance";

describe("VarianceRTIndicator", () => {
  it("testWithAverageSample", () => {
    const variance = new VarianceRTIndicator(8);
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    for (const v of data) {
      variance.update(v);
    }
    expect(variance.sma.getValue()).toBeCloseTo(5.0, 1);
    expect(variance.getValue()).toBeCloseTo(4.57, 1);
  });

  it("testWithoutAverageSample", () => {
    const variance = new VarianceRTIndicator(8).withAverageSample(false);
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    for (const v of data) {
      variance.update(v);
    }
    expect(variance.sma.getValue()).toBeCloseTo(5.0, 1);
    expect(variance.getValue()).toBeCloseTo(4.0, 1);
  });

  it("testPrecision", () => {
    const variance = new VarianceRTIndicator(20);
    const repeatedValue = Math.pow(1234, -63);
    for (let i = 0; i < 4000; i++) {
      variance.update(repeatedValue);
    }
    expect(variance.sma.getValue()).toBeCloseTo(repeatedValue, 3);
    expect(variance.getValue()).toBeCloseTo(0.0, 7);
  });

  describe("exactness", () => {
    it("is the variance of the window when the mean is huge next to the deviation", () => {
      // mean 1e9 + 10, deviations -6 -3 3 6: 90 / 4. A sum of squares of 1e18 has no room left for the 22.5
      const variance = new VarianceRTIndicator(4).withAverageSample(false);
      for (const v of [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16]) variance.update(v);
      expect(variance.getValue()).toBe(22.5);
    });

    it("matches the exact variance of every window of a quiet market at a high price", () => {
      const prices = quietPrices(5000);
      for (const periods of [20, 50]) {
        const variance = new VarianceRTIndicator(periods).withAverageSample(false);
        let worst = 0;
        prices.forEach((price, i) => {
          const got = variance.update(price);
          if (i < periods - 1) return;
          const exact = exactPopulationVariance(prices.slice(i - periods + 1, i + 1));
          // 0 when the window is flat; otherwise a relative error
          const error = exact === 0 ? Math.abs(got) : Math.abs(got - exact) / exact;
          worst = Math.max(worst, error);
        });
        expect(worst).toBeLessThan(1e-9);
      }
    });

    it("is the sample variance of the window, with Bessel's correction", () => {
      const prices = quietPrices(200);
      const variance = new VarianceRTIndicator(20); // sample by default
      let got = 0;
      prices.forEach((price) => (got = variance.update(price)));
      expect(got / (exactPopulationVariance(prices.slice(-20)) * (20 / 19))).toBeCloseTo(1, 9);
    });

    it("does not depend on what came before the window: no drift", () => {
      const prices = quietPrices(300_000);
      const long = new VarianceRTIndicator(20);
      for (const price of prices) long.update(price);
      const fresh = new VarianceRTIndicator(20);
      for (const price of prices.slice(-20)) fresh.update(price);
      expect(long.getValue()).toBe(fresh.getValue());
    });

    it("is zero, not a rounding residue, for a flat window after a wild one", () => {
      const variance = new VarianceRTIndicator(20);
      for (let i = 0; i < 20; i++) variance.update(60000 + (i % 2) * 9000);
      for (let i = 0; i < 20; i++) variance.update(68705.81);
      expect(variance.getValue()).toBeLessThan(1e-15);
    });

    it("gives the same digits as the Java engine, which adds in the same order", () => {
      // The same series and the same pinned values as the Java engine's VarianceRTIndicatorTest
      const sample = new VarianceRTIndicator(20);
      const population = new VarianceRTIndicator(50).withAverageSample(false);
      for (const price of quietPrices(100_000)) {
        sample.update(price);
        population.update(price);
      }
      expect(sample.getValue()).toBe(3.502631579260158e-4);
      expect(population.getValue()).toBe(3.009599999922421e-4);
    });

    it("starts again from nothing after a reset", () => {
      const prices = quietPrices(100);
      const variance = new VarianceRTIndicator(20);
      for (const price of prices) variance.update(price);
      variance.reset();
      const fresh = new VarianceRTIndicator(20);
      for (const price of prices.slice(0, 40)) {
        expect(variance.update(price)).toBe(fresh.update(price));
      }
    });
  });
});
