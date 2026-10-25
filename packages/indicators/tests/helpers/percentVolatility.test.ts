import { describe, it, expect } from "vitest";
import { PercentVolatilityRTIndicator } from "$helpers/PercentVolatilityRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";

// Port of the Java engine's PercentVolatilityRTIndicatorTest, same values

function walk(instance: PercentVolatilityRTIndicator, values: number[], expected: number[], tolerance?: number): void {
  values.forEach((value, i) => {
    instance.update(value);
    if (tolerance === undefined) {
      expect(instance.getValue(), `update ${i}`).toBe(expected[i]);
    } else {
      // Java's withPrecision(0.01): at most 0.01 apart
      expect(Math.abs(instance.getValue() - expected[i]), `update ${i}`).toBeLessThanOrEqual(tolerance);
    }
  });
}

describe("PercentVolatilityRTIndicator", () => {
  it("is 0 while the value does not change", () => {
    walk(new PercentVolatilityRTIndicator(), [1, 1, 1], [0, 0, 0]);
  });

  it("averages the absolute percent change", () => {
    walk(new PercentVolatilityRTIndicator(), [1, 2, 2, 2, 2, 3], [0, 100, 50, 25, 12.5, 31.25]);
  });

  it("averages through the indicator it is given", () => {
    walk(new PercentVolatilityRTIndicator(new EmaRTIndicator(2)), [1, 2, 2, 2, 2, 3], [0, 100, 33.33, 11.11, 3.7, 34.56], 0.01);
  });

  it("averages the exact percent changes of small moves", () => {
    walk(new PercentVolatilityRTIndicator(), [1, 1.01, 0.98, 0.99, 1.033, 1.029], [0, 1, 1.99, 1.5, 2.92, 1.66], 0.01);
  });

  it("averages small moves through an EMA", () => {
    walk(
      new PercentVolatilityRTIndicator(new EmaRTIndicator(2)),
      [1, 1.01, 0.98, 0.981, 0.99, 1.033, 1.029],
      [0, 1, 2.31, 0.84, 0.89, 3.19, 1.32],
      0.01,
    );
  });

  it("amplifies each change", () => {
    walk(
      new PercentVolatilityRTIndicator(new EmaRTIndicator(2)).amplify(10),
      [1, 1.01, 0.98, 0.99, 1.033, 1.029],
      [0, 10, 23.14, 14.51, 33.79, 13.85],
      0.01,
    );
  });

  it("takes the same values after a reset", () => {
    const values = [1, 2, 2, 3];
    const fresh = new PercentVolatilityRTIndicator();
    const firstRun = values.map((v) => fresh.update(v));
    const vol = new PercentVolatilityRTIndicator();
    values.forEach((v) => vol.update(v));
    vol.reset();
    expect(vol.getValue()).toBe(0);
    expect(values.map((v) => vol.update(v))).toEqual(firstRun);
  });

  it("is ready when the average it feeds is", () => {
    const smoother = new EmaRTIndicator(3);
    const instance = new PercentVolatilityRTIndicator(smoother);
    for (let tick = 1; tick <= 8; tick++) {
      instance.update(100 + tick);
      expect(instance.isReady(), `tick ${tick}`).toBe(smoother.isReady());
      expect(instance.isReady(), `tick ${tick}`).toBe(tick >= 4);
    }
  });
});
