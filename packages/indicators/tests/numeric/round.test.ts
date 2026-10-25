import { describe, it, expect } from "vitest";
import { RoundRTIndicator } from "$numeric/RoundRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("RoundRTIndicator", () => {
  it("testUpdate", () => {
    const indicator = ValueRTIndicator.of(0);
    const round = new RoundRTIndicator(indicator, 2);
    expect(indicator.getValue()).toBe(0);
    expect(round.update(Math.PI)).toBe(3.14);
    expect(indicator.getValue()).toBe(Math.PI);
  });

  it("testReset", () => {
    const indicator = ValueRTIndicator.of(0);
    const round = new RoundRTIndicator(indicator, 2);
    const values = [3.14159, 2.71828, 1.41421];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(round.update(v));
    }
    round.reset();
    expect(round.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(round.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
