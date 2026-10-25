import { describe, it, expect } from "vitest";
import { RateChangeRTIndicator } from "$helpers/RateChangeRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("RateChangeRTIndicator", () => {
  it("testUpdate", () => {
    const roc = new RateChangeRTIndicator(new ValueRTIndicator());
    expect(roc.getValue()).toBe(0);
    roc.update(10);
    expect(roc.getValue()).toBe(0);
    roc.update(10);
    expect(roc.getValue()).toBe(0);
    roc.update(20);
    expect(roc.getValue()).toBe(1);
    roc.update(10);
    expect(roc.getValue()).toBe(-0.5);
    roc.update(9);
    expect(roc.getValue()).toBeCloseTo(-0.1, 10);
    roc.update(-5);
    expect(roc.getValue()).toBeCloseTo(-1.55, 1);
  });

  it("testUpdateWithNullIndicator", () => {
    const roc = new RateChangeRTIndicator(null);
    expect(roc.update(0)).toBe(0);
    expect(roc.update(0)).toBe(0);
    expect(roc.update(1)).toBe(0);
    expect(roc.update(2)).toBe(1);
    expect(roc.update(3)).toBeCloseTo(0.5, 10);
    expect(roc.update(2)).toBeCloseTo(-1 / 3, 10);
  });

  it("testNegativeValues", () => {
    const roc = new RateChangeRTIndicator(null);
    expect(roc.update(0)).toBe(0);
    expect(roc.update(-1)).toBe(0);
    expect(roc.update(-2)).toBe(-1);
    expect(roc.update(-3)).toBeCloseTo(-0.5, 10);
    expect(roc.update(-2)).toBeCloseTo(1 / 3, 10);
  });

  it("testReset", () => {
    const roc = new RateChangeRTIndicator(new ValueRTIndicator());
    const values = [10, 20];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(roc.update(v));
    }
    roc.reset();
    expect(roc.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(roc.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
