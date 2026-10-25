import { describe, it, expect } from "vitest";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";
import { WmaRTIndicator } from "$averages/WmaRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("HmaRTIndicator", () => {
  it("testFirstValueIsInput", () => {
    const hma = new HmaRTIndicator(9);
    expect(hma.update(100.0)).toBe(100.0);
  });

  it("testKnownValues", () => {
    const hma = new HmaRTIndicator(9);
    for (let i = 0; i < 14; i++) {
      hma.update(CLOSE_PRICES_LIST[i]);
    }
    expect(hma.getValue()).toBeCloseTo(CLOSE_PRICES_LIST[13], 0);
  });

  it("testConstantInput", () => {
    const hma = new HmaRTIndicator(9);
    for (let i = 0; i < 30; i++) {
      hma.update(42.0);
    }
    expect(hma.getValue()).toBeCloseTo(42.0, 4);
  });

  it("testResetReproducibility", () => {
    const hma = new HmaRTIndicator(9);
    const results: number[] = [];
    for (let i = 0; i < 14; i++) {
      results.push(hma.update(CLOSE_PRICES_LIST[i]));
    }

    hma.reset();
    for (let i = 0; i < 14; i++) {
      expect(hma.update(CLOSE_PRICES_LIST[i])).toBe(results[i]);
    }
  });

  it("testTrendingInputLessLagThanWma", () => {
    const hma = new HmaRTIndicator(9);
    const wma = new WmaRTIndicator(9);
    for (let i = 1; i <= 20; i++) {
      hma.update(i * 10);
      wma.update(i * 10);
    }
    expect(Math.abs(200 - hma.getValue())).toBeLessThan(Math.abs(200 - wma.getValue()));
  });

  it("testSmallPeriod", () => {
    const hma = new HmaRTIndicator(4);
    const values = [10, 20, 30, 40];
    for (const v of values) {
      hma.update(v);
    }
    expect(hma.getValue()).toBeGreaterThan(20.0);
  });
});
