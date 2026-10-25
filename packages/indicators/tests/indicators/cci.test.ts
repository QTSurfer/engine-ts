import { describe, it, expect } from "vitest";
import { CciRTIndicator } from "$indicators/CciRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("CciRTIndicator", () => {
  it("testConstantInputIsZero", () => {
    const cci = new CciRTIndicator(14);
    for (let i = 0; i < 20; i++) {
      cci.update(100.0);
    }
    expect(cci.getValue()).toBe(0.0);
  });

  it("testKnownValues", () => {
    const cci = new CciRTIndicator(14);
    for (const price of CLOSE_PRICES_LIST) {
      cci.update(price);
    }
    expect(cci.getValue()).toBeGreaterThan(-300.0);
    expect(cci.getValue()).toBeLessThan(300.0);
  });

  it("testOverboughtSignal", () => {
    const cci = new CciRTIndicator(5);
    for (let i = 0; i < 5; i++) {
      cci.update(100.0);
    }
    cci.update(120.0);
    expect(cci.getValue()).toBeGreaterThan(100.0);
  });

  it("testOversoldSignal", () => {
    const cci = new CciRTIndicator(5);
    for (let i = 0; i < 5; i++) {
      cci.update(100.0);
    }
    cci.update(80.0);
    expect(cci.getValue()).toBeLessThan(-100.0);
  });

  it("testResetReproducibility", () => {
    const cci = new CciRTIndicator(14);
    const results: number[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(cci.update(CLOSE_PRICES_LIST[i]));
    }

    cci.reset();
    for (let i = 0; i < 20; i++) {
      expect(cci.update(CLOSE_PRICES_LIST[i])).toBe(results[i]);
    }
  });

  it("testFirstValueIsZero", () => {
    const cci = new CciRTIndicator(14);
    cci.update(100.0);
    expect(cci.getValue()).toBe(0.0);
  });
});
