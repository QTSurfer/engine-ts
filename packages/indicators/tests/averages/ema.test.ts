import { describe, it, expect } from "vitest";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("EmaRTIndicator", () => {
  it("testBasic", () => {
    const ema = new EmaRTIndicator(3);
    ema.update(1);
    expect(ema.getValue()).toBe(1);
    expect(ema.periodCycles).toBe(0);
    ema.update(3);
    expect(ema.getValue()).toBe(2);
    expect(ema.periodCycles).toBe(0);
    ema.update(5);
    expect(ema.getValue()).toBe(3.5);
    expect(ema.periodCycles).toBe(1);
    ema.update(1);
    expect(ema.getValue()).toBe(2.25);
    expect(ema.periodCycles).toBe(1);
    ema.update(3);
    expect(ema.getValue()).toBe(2.625);
    expect(ema.periodCycles).toBe(1);
    ema.update(5);
    expect(ema.getValue()).toBe(3.8125);
    expect(ema.periodCycles).toBe(2);
  });

  it("testDecorated", () => {
    const ema = new EmaRTIndicator(2, new SmaRTIndicator());
    ema.update(1);
    expect(ema.getValue()).toBe(1);
    expect(ema.periodCycles).toBe(0);
    ema.update(3);
    expect(ema.getValue()).toBeCloseTo(1.66, 1);
    expect(ema.periodCycles).toBe(1);
    ema.update(5);
    expect(ema.getValue()).toBeCloseTo(2.88, 1);
    expect(ema.periodCycles).toBe(1);
    ema.update(5);
    expect(ema.getValue()).toBeCloseTo(3.79, 1);
    expect(ema.periodCycles).toBe(2);
  });

  it("testReset", () => {
    const ema = new EmaRTIndicator(3);
    ema.update(1);
    ema.update(3);
    ema.update(5);
    const valueBeforeReset = ema.getValue();
    expect(valueBeforeReset).toBe(3.5);

    ema.reset();
    expect(ema.getValue()).toBe(0);
    expect(ema.periodCycles).toBe(0);

    ema.update(1);
    ema.update(3);
    ema.update(5);
    expect(ema.getValue()).toBe(valueBeforeReset);
  });
});
