import { describe, it, expect } from "vitest";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";

describe("StandardDeviationRTIndicator", () => {
  it("testWithAverageSample", () => {
    const stdDev = new StandardDeviationRTIndicator(6);
    const data = [4, 1, 11, 13, 2, 7];
    for (const v of data) {
      stdDev.update(v);
    }
    expect(stdDev.sma.getValue()).toBeCloseTo(6.33, 1);
    expect(stdDev.variance.getValue()).toBeCloseTo(23.87, 1);
    expect(stdDev.getValue()).toBeCloseTo(4.88, 1);
  });

  it("testWithoutAverageSample", () => {
    const stdDev = new StandardDeviationRTIndicator(6).withAverageSample(false);
    const data = [4, 1, 11, 13, 2, 7];
    for (const v of data) {
      stdDev.update(v);
    }
    expect(stdDev.sma.getValue()).toBeCloseTo(6.33, 1);
    expect(stdDev.variance.getValue()).toBeCloseTo(19.89, 1);
    expect(stdDev.getValue()).toBeCloseTo(4.46, 1);
  });
});
