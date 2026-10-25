import { describe, it, expect } from "vitest";
import { WmaRTIndicator } from "$averages/WmaRTIndicator";

describe("WmaRTIndicator", () => {
  it("testKnownValues", () => {
    const wma = new WmaRTIndicator(3);
    expect(wma.update(10)).toBe(10.0);
    expect(wma.update(20)).toBeCloseTo(50 / 3, 3);
    expect(wma.update(30)).toBeCloseTo(140 / 6, 3);
    expect(wma.update(40)).toBeCloseTo(200 / 6, 3);
  });

  it("testConstantInput", () => {
    const wma = new WmaRTIndicator(5);
    for (let i = 0; i < 20; i++) {
      wma.update(42.0);
    }
    expect(wma.getValue()).toBeCloseTo(42.0, 4);
  });

  it("testResetReproducibility", () => {
    const wma = new WmaRTIndicator(3);
    const prices = [10, 20, 30, 40, 50];
    const results: number[] = [];
    for (const p of prices) {
      results.push(wma.update(p));
    }

    wma.reset();
    for (let i = 0; i < prices.length; i++) {
      expect(wma.update(prices[i])).toBe(results[i]);
    }
  });

  it("testTrendingInput", () => {
    const wma = new WmaRTIndicator(5);
    for (let i = 1; i <= 10; i++) {
      wma.update(i * 10);
    }
    expect(wma.getValue()).toBeGreaterThan(70.0);
    expect(wma.getValue()).toBeLessThan(100.0);
  });

  it("testSinglePeriod", () => {
    const wma = new WmaRTIndicator(1);
    expect(wma.update(42.0)).toBe(42.0);
    expect(wma.update(99.0)).toBe(99.0);
  });
});
