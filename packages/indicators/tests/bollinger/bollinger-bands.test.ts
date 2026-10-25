import { describe, it, expect } from "vitest";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { exactPopulationVariance, quietPrices } from "../exact-variance";

describe("BollingerBandsRTIndicator", () => {
  it("testBasic", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    bb.update(1);
    bb.update(3);
    bb.update(5);
    bb.update(7);
    bb.update(9);
    expect(bb.getValue()).toBe(5);
    expect(bb.getUpper().getValue()).toBeGreaterThan(5);
    expect(bb.getLower().getValue()).toBeLessThan(5);
  });

  it("testWithStdDev", () => {
    const bb = new BollingerBandsRTIndicator(20, 2);
    for (let i = 1; i <= 20; i++) {
      bb.update(i);
    }
    const middle = bb.getValue();
    const upper = bb.getUpper().getValue();
    const lower = bb.getLower().getValue();
    expect(upper).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(lower);
    expect(bb.getBandWidth().getValue()).toBeGreaterThan(0);
  });

  it("testDecorated", () => {
    const bb = new BollingerBandsRTIndicator(new EmaRTIndicator(5), 3, 2);
    for (let i = 1; i <= 10; i++) {
      bb.update(i * 10);
    }
    expect(bb.getValue()).not.toBeNaN();
    expect(bb.getUpper().getValue()).not.toBeNaN();
    expect(bb.getLower().getValue()).not.toBeNaN();
  });

  it("testBandWidth", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    for (let i = 1; i <= 10; i++) {
      bb.update(i * 10);
    }
    const bw = bb.getBandWidth().getValue();
    expect(bw).toBeGreaterThan(0);

    const middle = bb.getValue();
    const upper = bb.getUpper().getValue();
    const lower = bb.getLower().getValue();
    expect(bw).toBeCloseTo(100 * (upper - lower) / middle, 5);
  });

  it("testWithAverageSample", () => {
    const bb = new BollingerBandsRTIndicator(5, 2).withAverageSample(true);
    for (let i = 1; i <= 10; i++) {
      bb.update(i * 10);
    }
    const middle = bb.getValue();
    expect(bb.getUpper().getValue()).toBeGreaterThan(middle);
    expect(bb.getLower().getValue()).toBeLessThan(middle);
  });

  it("testCustomK", () => {
    const bb1 = new BollingerBandsRTIndicator(5, 1);
    const bb3 = new BollingerBandsRTIndicator(5, 3);
    for (let i = 1; i <= 10; i++) {
      bb1.update(i * 10);
      bb3.update(i * 10);
    }
    const width1 = bb1.getUpper().getValue() - bb1.getLower().getValue();
    const width3 = bb3.getUpper().getValue() - bb3.getLower().getValue();
    expect(width3).toBeGreaterThan(width1);
  });

  it("testDefaultConstructor", () => {
    const bb = new BollingerBandsRTIndicator();
    for (let i = 1; i <= 20; i++) {
      bb.update(i);
    }
    const middle = bb.getValue();
    expect(bb.getUpper().getValue()).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(bb.getLower().getValue());
    expect(bb.getBandWidth().getValue()).toBeGreaterThan(0);
  });

  it("testReset", () => {
    const bb = new BollingerBandsRTIndicator(5, 2);
    bb.update(1);
    bb.update(3);
    bb.update(5);
    bb.update(7);
    bb.update(9);
    const middle = bb.getValue();
    const upper = bb.getUpper().getValue();
    const lower = bb.getLower().getValue();
    expect(middle).toBe(5);
    expect(upper).toBeGreaterThan(5);
    expect(lower).toBeLessThan(5);

    bb.reset();
    expect(bb.getValue()).toBe(0);
    expect(bb.getUpper().getValue()).toBe(0);
    expect(bb.getLower().getValue()).toBe(0);

    bb.update(1);
    bb.update(3);
    bb.update(5);
    bb.update(7);
    bb.update(9);
    expect(bb.getValue()).toBe(middle);
    expect(bb.getUpper().getValue()).toBe(upper);
    expect(bb.getLower().getValue()).toBe(lower);
  });


  describe("readiness of the bands", () => {
    it("the upper and lower bands are ready when the parent is", () => {
      const bb = new BollingerBandsRTIndicator(5, 2);
      const upper = bb.getUpper();
      const lower = bb.getLower();
      const stdDev = bb.getStdDev();
      const width = bb.getBandWidth();

      for (let tick = 1; tick <= 8; tick++) {
        bb.update(10 * tick);

        const expected = tick >= 5;
        expect(bb.isReady(), `middle at tick ${tick}`).toBe(expected);
        expect(upper.isReady(), `upper at tick ${tick}`).toBe(expected);
        expect(lower.isReady(), `lower at tick ${tick}`).toBe(expected);
        expect(stdDev.isReady(), `stdDev at tick ${tick}`).toBe(expected);
        expect(width.isReady(), `width at tick ${tick}`).toBe(expected);
      }
    });

    it("the bands hold the values they always did during warm-up", () => {
      const bb = new BollingerBandsRTIndicator(5, 2);

      bb.update(1);
      bb.update(3);

      expect(bb.getUpper().isReady()).toBe(false);
      // Until the first full period the standard deviation is 0, so the bands sit on the middle
      expect(bb.getUpper().getValue()).toBe(bb.getValue());
      expect(bb.getLower().getValue()).toBe(bb.getValue());
    });

    it("bands over a source wait for the source too", () => {
      const bb = new BollingerBandsRTIndicator(new SmaRTIndicator(4), 2, 2);

      for (let tick = 1; tick <= 6; tick++) {
        bb.update(10 * tick);
        expect(bb.getUpper().isReady(), `upper at tick ${tick}`).toBe(tick >= 4);
        expect(bb.getLower().isReady(), `lower at tick ${tick}`).toBe(tick >= 4);
      }
    });

    it("a reset makes the bands not ready again", () => {
      const bb = new BollingerBandsRTIndicator(5, 2);
      const upper = bb.getUpper();
      const lower = bb.getLower();
      for (let tick = 1; tick <= 8; tick++) bb.update(10 * tick);
      expect(upper.isReady()).toBe(true);

      bb.reset();

      expect(bb.isReady()).toBe(false);
      expect(upper.isReady()).toBe(false);
      expect(lower.isReady()).toBe(false);
      for (let tick = 1; tick <= 4; tick++) {
        bb.update(10 * tick);
        expect(upper.isReady(), `upper at tick ${tick} after reset`).toBe(false);
      }
      bb.update(50);
      expect(upper.isReady()).toBe(true);
      expect(lower.isReady()).toBe(true);
    });

    it("the bands keep their metadata", () => {
      const bb = new BollingerBandsRTIndicator(5, 2);

      expect(bb.getUpper().getId?.()).toBe("bollinger");
      expect(bb.getUpper().getMeta?.().get("band")).toBe("upper");
      expect(bb.getLower().getId?.()).toBe("bollinger");
      expect(bb.getLower().getMeta?.().get("band")).toBe("lower");
    });
  });

  it("keeps the width of its bands in a quiet market at a high price", () => {
    const periods = 20;
    const k = 2;
    const prices = quietPrices(5000);
    const bb = new BollingerBandsRTIndicator(periods, k).withAverageSample(false);
    let worst = 0;
    prices.forEach((price, i) => {
      bb.update(price);
      if (i < periods - 1) return;
      const exactHalfWidth = k * Math.sqrt(exactPopulationVariance(prices.slice(i - periods + 1, i + 1)));
      const halfWidth = (bb.getUpper().getValue() - bb.getLower().getValue()) / 2;
      // The half-width is the difference of two numbers near 68,700: compare it to the price's own precision
      worst = Math.max(worst, Math.abs(halfWidth - exactHalfWidth));
    });
    expect(worst).toBeLessThan(1e-9);
  });

  it("gives the same digits as the Java engine, which adds in the same order", () => {
    // The same series and the same pinned values as the Java engine's BollingerBandsRTIndicatorTest
    const bb = new BollingerBandsRTIndicator(20, 2);
    for (const price of quietPrices(100_000)) bb.update(price);
    expect(bb.getUpper().getValue()).toBe(68706.25893063736);
    expect(bb.getLower().getValue()).toBe(68706.18406936215);
  });
});
