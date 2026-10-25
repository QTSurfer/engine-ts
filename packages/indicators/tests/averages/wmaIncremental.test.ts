import { describe, it, expect } from "vitest";
import { WmaIncrementalRTIndicator } from "$averages/WmaIncrementalRTIndicator";
import { WmaRTIndicator } from "$averages/WmaRTIndicator";

describe("WmaIncrementalRTIndicator", () => {
  it("testKnownValues", () => {
    const wma = new WmaIncrementalRTIndicator(3);
    expect(wma.update(10)).toBe(10.0);
    expect(wma.update(20)).toBeCloseTo(50 / 3, 3);
    expect(wma.update(30)).toBeCloseTo(140 / 6, 3);
    expect(wma.update(40)).toBeCloseTo(200 / 6, 3);
  });

  it("testConstantInput", () => {
    const wma = new WmaIncrementalRTIndicator(5);
    for (let i = 0; i < 20; i++) {
      wma.update(42.0);
    }
    expect(wma.getValue()).toBeCloseTo(42.0, 4);
  });

  it("testResetReproducibility", () => {
    const wma = new WmaIncrementalRTIndicator(3);
    const prices = [10, 20, 30, 40, 50];
    for (const p of prices) wma.update(p);
    const valueBeforeReset = wma.getValue();

    wma.reset();
    expect(wma.getValue()).toBe(0);

    for (const p of prices) wma.update(p);
    expect(wma.getValue()).toBe(valueBeforeReset);
  });

  it("testSinglePeriod", () => {
    const wma = new WmaIncrementalRTIndicator(1);
    expect(wma.update(42.0)).toBe(42.0);
    expect(wma.update(99.0)).toBe(99.0);
  });

  it("testMatchesBaseWma", () => {
    const periods = 14;
    const base = new WmaRTIndicator(periods);
    const pro = new WmaIncrementalRTIndicator(periods);

    const prices = [
      44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03,
      46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78,
      45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13,
    ];

    for (const price of prices) {
      const baseValue = base.update(price);
      const proValue = pro.update(price);
      expect(proValue).toBeCloseTo(baseValue, 10);
    }
  });

  it("testMatchesBaseAfterReset", () => {
    const periods = 5;
    const base = new WmaRTIndicator(periods);
    const pro = new WmaIncrementalRTIndicator(periods);

    const firstRun = [10, 20, 30, 40, 50, 60, 70];
    for (const p of firstRun) {
      base.update(p);
      pro.update(p);
    }

    base.reset();
    pro.reset();

    const secondRun = [100, 90, 80, 70, 60, 50, 40, 30];
    for (const p of secondRun) {
      const baseValue = base.update(p);
      const proValue = pro.update(p);
      expect(proValue).toBeCloseTo(baseValue, 10);
    }
  });

  it("testLargeSeries", () => {
    const periods = 50;
    const base = new WmaRTIndicator(periods);
    const pro = new WmaIncrementalRTIndicator(periods);

    for (let i = 0; i < 10_000; i++) {
      const price = 100 + Math.sin(i * 0.1) * 20;
      const baseValue = base.update(price);
      const proValue = pro.update(price);
      expect(proValue).toBeCloseTo(baseValue, 8);
    }
  });
});
