import { describe, it, expect } from "vitest";
import { SumRTIndicator } from "$numeric/SumRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("SumRTIndicator", () => {
  it("testSingle", () => {
    const sum = new SumRTIndicator(ValueRTIndicator.of(0));
    expect(sum.getValue()).toBe(0);
    sum.update(1);
    sum.update(2);
    sum.update(3);
    expect(sum.getValue()).toBe(6);
  });

  it("testSMA", () => {
    const sum = new SumRTIndicator(new SmaRTIndicator());
    expect(sum.getValue()).toBe(0);
    sum.update(1);
    sum.update(2);
    sum.update(3);
    expect(sum.getValue()).toBe(4.75);
  });

  it("testReset", () => {
    const sum = new SumRTIndicator(ValueRTIndicator.of(0));
    const values = [1, 2, 3];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(sum.update(v));
    }
    sum.reset();
    expect(sum.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(sum.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
