import { describe, it, expect } from "vitest";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("MmaRTIndicator", () => {
  it("testBasic", () => {
    const mma = new MmaRTIndicator(3);
    mma.update(3);
    expect(mma.getValue()).toBe(3);

    // MMA = 3 + (1/3)*(6-3) = 4
    mma.update(6);
    expect(mma.getValue()).toBe(4);

    // MMA = 4 + (1/3)*(9-4) = 5.666...
    mma.update(9);
    expect(mma.getValue()).toBeCloseTo(5.6666, 3);
  });

  it("testDifferentFromEma", () => {
    const mma = new MmaRTIndicator(5);
    const ema = new EmaRTIndicator(5);

    const values = [10, 20, 30, 40, 50];
    for (const v of values) {
      mma.update(v);
      ema.update(v);
    }

    expect(mma.getValue()).not.toBe(ema.getValue());
  });

  it("testWithDecorator", () => {
    const mma = new MmaRTIndicator(3, new SmaRTIndicator());
    mma.update(10);
    mma.update(20);
    mma.update(30);

    expect(mma.getValue()).not.toBeNaN();
    expect(mma.getValue()).toBeGreaterThan(0);
  });

  it("testReset", () => {
    const mma = new MmaRTIndicator(3);
    mma.update(10);
    mma.update(20);
    mma.update(30);
    const valueBeforeReset = mma.getValue();

    mma.reset();
    expect(mma.getValue()).toBe(0);

    mma.update(10);
    mma.update(20);
    mma.update(30);
    expect(mma.getValue()).toBe(valueBeforeReset);
  });
});
