import { describe, it, expect } from "vitest";
import { ClampRTIndicator } from "$numeric/ClampRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

const DELTA = 10;

describe("ClampRTIndicator", () => {
  it("testUpdate", () => {
    // Non-periodic SMA: init=first, then (prev+new)/2
    // update(1) -> SMA=1, clamp(0,1) -> 1
    // update(2) -> SMA=(1+2)/2=1.5, clamp(0,1) -> 1
    // update(3) -> SMA=(1.5+3)/2=2.25, clamp(0,1) -> 1
    // update(-1) -> SMA=(2.25+-1)/2=0.625, clamp(0,1) -> 0.625
    const clamp = new ClampRTIndicator(new SmaRTIndicator(), 0, 1);
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);
    expect(clamp.update(2)).toBeCloseTo(1, DELTA);
    expect(clamp.update(3)).toBeCloseTo(1, DELTA);
    expect(clamp.update(-1)).toBeCloseTo(0.625, DELTA);
  });

  it("testClampLowerBound", () => {
    const clamp = new ClampRTIndicator(new SmaRTIndicator(), 0, 100);
    expect(clamp.update(5)).toBeCloseTo(5, DELTA);
    expect(clamp.update(-20)).toBeCloseTo(0, DELTA); // SMA=(5+-20)/2=-7.5, clamped to 0
  });

  it("testReset", () => {
    const clamp = new ClampRTIndicator(new SmaRTIndicator(), 0, 1);
    clamp.update(1);
    clamp.update(2);
    clamp.reset();
    expect(clamp.getValue()).toBe(0);
    // The reset cascades to the wrapped SMA, as it does in every other holder of an indicator, so
    // the SMA starts over: its first value after the reset is 0.5, and clamp(0,1)(0.5) = 0.5
    expect(clamp.update(0.5)).toBeCloseTo(0.5, DELTA);
  });
});
