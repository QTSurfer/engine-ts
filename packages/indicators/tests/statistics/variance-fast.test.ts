import { describe, it, expect } from "vitest";
import { VarianceRTIndicator } from "$statistics/VarianceRTIndicator";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { exactPopulationVariance, quietPrices } from "../exact-variance";

/**
 * "fast" precision: O(1) per tick, within one part in a thousand million of the exact variance wherever
 * the mean is, against the exact mode and against the variance worked out in integers.
 */

/** The guard keeps the rounding below 1e-9 of the variance; the rest is how the prices are held. */
const TOLERANCE = 1e-8;

const fast = (periods: number) => new VarianceRTIndicator(periods).withAverageSample(false).withPrecision("fast");
const exact = (periods: number) => new VarianceRTIndicator(periods).withAverageSample(false);

function expectClose(got: number, want: number, message: string): void {
  const allowed = TOLERANCE * Math.max(want, 1e-6);
  if (!(Math.abs(got - want) <= allowed)) {
    throw new Error(`${message}: fast ${got}, exact ${want}`);
  }
}

describe("VarianceRTIndicator precision fast", () => {
  it("exact is the default", () => {
    expect(new VarianceRTIndicator(20).precision).toBe("exact");
    expect(new StandardDeviationRTIndicator(20).precision).toBe("exact");
    expect(new BollingerBandsRTIndicator(20, 2).precision).toBe("exact");
    expect(new VarianceRTIndicator(20).withPrecision("fast").precision).toBe("fast");
  });

  it("matches the variance worked out in integers for every window of a quiet market", () => {
    const prices = quietPrices(5000);
    for (const periods of [20, 50, 200]) {
      const variance = fast(periods);
      prices.forEach((price, i) => {
        const got = variance.update(price);
        if (i < periods - 1) return;
        expectClose(got, exactPopulationVariance(prices.slice(i - periods + 1, i + 1)), `${periods} periods, tick ${i}`);
      });
    }
  });

  it("mean huge next to the deviation", () => {
    const variance = fast(4);
    for (const v of [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16]) variance.update(v);
    expect(variance.getValue()).toBeCloseTo(22.5, 9);
  });

  it("a quiet window right after a wild one is not lost", () => {
    const quiet = quietPrices(500);
    const f = fast(20);
    const e = exact(20);
    for (let i = 0; i < 20; i++) {
      const wild = 60000 + (i % 2) * 9000 + i;
      f.update(wild);
      e.update(wild);
    }
    quiet.forEach((price, i) => expectClose(f.update(price), e.update(price), `tick ${i} after the wild window`));
    expect(f.fastRecalculations).toBeGreaterThan(0);
  });

  it("a trending market", () => {
    const f = fast(50);
    const e = exact(50);
    const noise = quietPrices(20_000, 0);
    noise.forEach((n, i) => {
      const price = 68000 + i * 0.37 + n; // 0.37 a tick: the mean leaves its reference all the time
      expectClose(f.update(price), e.update(price), `tick ${i}`);
    });
  });

  it("a long run keeps accuracy with few recalculations", () => {
    const prices = quietPrices(300_000);
    const f = fast(20);
    for (const price of prices) f.update(price);
    expectClose(f.getValue(), exactPopulationVariance(prices.slice(-20)), "after 300,000 updates");
    expect(f.fastRecalculations).toBeLessThan(3_000);
  });

  it("agrees with the exact mode on random markets", () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const periods of [2, 3, 5, 20, 50, 200]) {
        const f = fast(periods);
        const e = exact(periods);
        let state = seed * 7919;
        const level = seed % 2 === 0 ? 68_000 : 3.5;
        let price = level;
        for (let i = 0; i < 4000; i++) {
          state = Math.imul(state, 1103515245) + 12345;
          // volatility changes by regime so that quiet runs follow wild ones
          const regime = Math.floor(i / 400) % 3;
          const scale = ((regime === 0 ? 0.0002 : regime === 1 ? 0.01 : 1.5) * level) / 100;
          price += (((state >>> 16) % 2001) - 1000) / 1000 * scale;
          const got = f.update(price);
          const want = e.update(price);
          if (i < periods) continue;
          expectClose(got, want, `seed ${seed}, ${periods} periods, tick ${i}`);
        }
      }
    }
  });

  it("a flat window has no variance", () => {
    const variance = fast(20);
    for (let i = 0; i < 20; i++) variance.update(60000 + (i % 2) * 9000 + i);
    for (let i = 0; i < 40; i++) variance.update(68705.81);
    expect(variance.getValue()).toBeLessThan(1e-12);
  });

  it("a NaN leaves with its window and the variance comes back", () => {
    const f = fast(20);
    const e = exact(20);
    const prices = quietPrices(200);
    prices.forEach((p, i) => {
      const price = i === 50 ? NaN : p;
      const got = f.update(price);
      const want = e.update(price);
      if (i >= 50 + 20) expectClose(got, want, `tick ${i} after the NaN left`);
    });
  });

  it("reset starts again from nothing", () => {
    const prices = quietPrices(200);
    const used = fast(20);
    for (const price of prices) used.update(price);
    used.reset();
    const fresh = fast(20);
    for (let i = 0; i < 60; i++) expect(used.update(prices[i])).toBe(fresh.update(prices[i]));
  });

  it("switching precision in the middle starts from the window", () => {
    const prices = quietPrices(400);
    const variance = exact(20);
    for (let i = 0; i < 200; i++) variance.update(prices[i]);
    variance.withPrecision("fast");
    for (let i = 200; i < 300; i++) {
      expectClose(variance.update(prices[i]), exactPopulationVariance(prices.slice(i - 19, i + 1)), `fast, tick ${i}`);
    }
    variance.withPrecision("exact");
    for (let i = 300; i < 400; i++) {
      expectClose(variance.update(prices[i]), exactPopulationVariance(prices.slice(i - 19, i + 1)), `back to exact, tick ${i}`);
    }
  });

  it("the sample variance has Bessel's correction", () => {
    const prices = quietPrices(200);
    const variance = new VarianceRTIndicator(20).withPrecision("fast");
    let got = 0;
    for (const price of prices) got = variance.update(price);
    expect(got / (exactPopulationVariance(prices.slice(-20)) * (20 / 19))).toBeCloseTo(1, 8);
  });

  it("the standard deviation and the Bollinger bands take the precision along", () => {
    const prices = quietPrices(5000);
    const deviation = new StandardDeviationRTIndicator(20).withAverageSample(false).withPrecision("fast");
    const bands = new BollingerBandsRTIndicator(20, 2).withAverageSample(false).withPrecision("fast");
    expect(deviation.precision).toBe("fast");
    expect(bands.precision).toBe("fast");
    let worst = 0;
    prices.forEach((price, i) => {
      const sd = deviation.update(price);
      bands.update(price);
      if (i < 19) return;
      const exactDeviation = Math.sqrt(exactPopulationVariance(prices.slice(i - 19, i + 1)));
      expect(Math.abs(sd - exactDeviation)).toBeLessThanOrEqual(TOLERANCE * Math.max(exactDeviation, 1e-3));
      const halfWidth = (bands.getUpper().getValue() - bands.getLower().getValue()) / 2;
      worst = Math.max(worst, Math.abs(halfWidth - 2 * exactDeviation));
    });
    // the half-width is the difference of two numbers near 68,700: compare it to the price's own precision
    expect(worst).toBeLessThan(1e-9);
  });

  it("gives the same digits as the Java engine", () => {
    // The same series and the same pinned values as the Java engine's fast-precision tests
    const sample = new VarianceRTIndicator(20).withPrecision("fast");
    const population = fast(50);
    const bands = new BollingerBandsRTIndicator(20, 2).withPrecision("fast");
    for (const price of quietPrices(100_000)) {
      sample.update(price);
      population.update(price);
      bands.update(price);
    }
    expect(sample.getValue()).toBe(3.5026315792602e-4);
    expect(population.getValue()).toBe(3.0095999999226966e-4);
    expect(bands.getUpper().getValue()).toBe(68706.25893063736);
    expect(bands.getLower().getValue()).toBe(68706.18406936215);
    expect(sample.fastRecalculations).toBe(55);
  });
});
