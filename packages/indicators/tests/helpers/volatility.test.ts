import { describe, it, expect } from "vitest";
import { VolatilityRTIndicator } from "$helpers/VolatilityRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";

// Port of the Java engine's VolatilityRTIndicatorTest, same values

describe("VolatilityRTIndicator", () => {
  it("is 0 while the value does not change", () => {
    const instance = new VolatilityRTIndicator();
    for (let i = 0; i < 3; i++) {
      instance.update(1);
      expect(instance.getValue()).toBe(0);
    }
  });

  it("averages whether each value changed, as a percentage", () => {
    const instance = new VolatilityRTIndicator();
    const expected = [0, 100, 50, 25, 12.5, 56.25];
    [1, 2, 2, 2, 2, 3].forEach((value, i) => {
      instance.update(value);
      expect(instance.getValue(), `update ${i}`).toBe(expected[i]);
    });
  });

  it("reads 0 through the clamp period", () => {
    const instance = new VolatilityRTIndicator().clampUpdates(2);
    const expected = [0, 0, 50, 25, 12.5, 56.25];
    [1, 2, 2, 2, 2, 3].forEach((value, i) => {
      instance.update(value);
      expect(instance.getValue(), `update ${i}`).toBe(expected[i]);
    });
  });

  it("takes the same values after a reset", () => {
    const values = [1, 2, 2, 3];
    const fresh = new VolatilityRTIndicator();
    const firstRun = values.map((v) => fresh.update(v));
    const vol = new VolatilityRTIndicator();
    values.forEach((v) => vol.update(v));
    vol.reset();
    expect(vol.getValue()).toBe(0);
    expect(values.map((v) => vol.update(v))).toEqual(firstRun);
  });

  it("averages through the indicator it is given", () => {
    const instance = new VolatilityRTIndicator(new EmaRTIndicator(2));
    const expected = [0, 100, 33.33, 11.11, 3.7, 67.9];
    [1, 2, 2, 2, 2, 3].forEach((value, i) => {
      instance.update(value);
      // Java's withPrecision(0.01): at most 0.01 apart
      expect(Math.abs(instance.getValue() - expected[i]), `update ${i}`).toBeLessThanOrEqual(0.01);
    });
  });

  it("is ready from the start with the default average, which has no warm-up", () => {
    const instance = new VolatilityRTIndicator();
    instance.update(1);
    expect(instance.isReady()).toBe(true);
    instance.update(2);
    expect(instance.isReady()).toBe(true);
  });

  it("is ready when the average it feeds, from the second value on, is", () => {
    const smoother = new SmaRTIndicator(3);
    const instance = new VolatilityRTIndicator(smoother);
    for (let tick = 1; tick <= 8; tick++) {
      instance.update(tick % 2 === 0 ? 1 : 2);
      expect(instance.isReady(), `tick ${tick}`).toBe(smoother.isReady());
      expect(instance.isReady(), `tick ${tick}`).toBe(tick >= 4);
    }
  });

  it("is not ready through the clamp period", () => {
    const instance = new VolatilityRTIndicator().clampUpdates(2);
    instance.update(1);
    expect(instance.isReady()).toBe(false);
    instance.update(2);
    expect(instance.isReady()).toBe(false);
    instance.update(2);
    expect(instance.isReady()).toBe(true);
    expect(instance.getValue()).toBe(50);
  });

  it("is not ready again after a reset, and replays the same series", () => {
    const instance = new VolatilityRTIndicator(new SmaRTIndicator(3)).clampUpdates(1);
    const values = [1, 2, 2, 3, 3, 4, 4];
    const firstRun: number[] = [];
    const firstRunReady: boolean[] = [];
    for (const v of values) {
      firstRun.push(instance.update(v));
      firstRunReady.push(instance.isReady());
    }
    expect(instance.isReady()).toBe(true);
    instance.reset();
    expect(instance.isReady()).toBe(false);
    expect(instance.getValue()).toBe(0);
    values.forEach((v, i) => {
      expect(instance.update(v), `value ${i}`).toBe(firstRun[i]);
      expect(instance.isReady(), `ready ${i}`).toBe(firstRunReady[i]);
    });
  });
});
