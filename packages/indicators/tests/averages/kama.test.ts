import { describe, it, expect } from "vitest";
import { KamaRTIndicator } from "$averages/KamaRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("KamaRTIndicator", () => {
  it("testFirstValueIsInput", () => {
    const kama = new KamaRTIndicator();
    expect(kama.update(100.0)).toBe(100.0);
  });

  it("testKnownValuesTrending", () => {
    const kama = new KamaRTIndicator(10, 2, 30);
    for (let i = 1; i <= 15; i++) {
      kama.update(100.0 + i);
    }
    expect(Math.abs(kama.getValue() - 115.0)).toBeLessThan(2.0);
  });

  it("testKnownValuesChoppy", () => {
    const kama = new KamaRTIndicator(10, 2, 30);
    for (let i = 0; i < 30; i++) {
      kama.update(i % 2 === 0 ? 100.0 : 101.0);
    }
    expect(kama.getValue()).toBeCloseTo(100.5, 0);
  });

  it("testConstantInput", () => {
    const kama = new KamaRTIndicator(10);
    for (let i = 0; i < 30; i++) {
      kama.update(50.0);
    }
    expect(kama.getValue()).toBeCloseTo(50.0, 4);
  });

  it("testResetReproducibility", () => {
    const kama = new KamaRTIndicator();
    const results: number[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(kama.update(CLOSE_PRICES_LIST[i]));
    }

    kama.reset();
    for (let i = 0; i < 20; i++) {
      expect(kama.update(CLOSE_PRICES_LIST[i])).toBe(results[i]);
    }
  });

  it("testFromFixturesClosingPrices", () => {
    const kama = new KamaRTIndicator();
    for (const price of CLOSE_PRICES_LIST) {
      kama.update(price);
    }
    expect(kama.getValue()).toBeGreaterThan(42.0);
    expect(kama.getValue()).toBeLessThan(47.0);
  });
});
