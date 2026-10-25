import { describe, it, expect } from "vitest";
import { ClampPredicateRTIndicator } from "$numeric/ClampPredicateRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

const DELTA = 10;

describe("ClampPredicateRTIndicator", () => {
  // Non-periodic SMA: init=first value, then (prev+new)/2
  // update(1) -> SMA=1
  // update(2) -> SMA=(1+2)/2=1.5
  // update(-6) -> SMA=(1.5+-6)/2=-2.25

  it("testPositive", () => {
    // positive predicate: if result > 0, clamp to 0; else keep
    const clamp = ClampPredicateRTIndicator.positive(new SmaRTIndicator());
    expect(clamp.update(1)).toBeCloseTo(0, DELTA);     // SMA=1, positive -> clamp to 0
    expect(clamp.update(2)).toBeCloseTo(0, DELTA);     // SMA=1.5, positive -> clamp to 0
    expect(clamp.update(-6)).toBeCloseTo(-2.25, DELTA); // SMA=-2.25, not positive -> keep
  });

  it("testNegative", () => {
    // negative predicate: if result < 0, clamp to 0; else keep
    const clamp = ClampPredicateRTIndicator.negative(new SmaRTIndicator());
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);   // SMA=1, not negative -> keep
    expect(clamp.update(2)).toBeCloseTo(1.5, DELTA); // SMA=1.5, not negative -> keep
    expect(clamp.update(-6)).toBeCloseTo(0, DELTA);  // SMA=-2.25, negative -> clamp to 0
  });

  it("testZero", () => {
    // zero predicate: if result === 0, clamp to 0; else keep (effectively identity)
    const clamp = ClampPredicateRTIndicator.zero(new SmaRTIndicator());
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);
    expect(clamp.update(2)).toBeCloseTo(1.5, DELTA);
    expect(clamp.update(-6)).toBeCloseTo(-2.25, DELTA);
  });

  it("testGreaterThan", () => {
    // greaterThan(2): if result > 2, clamp to 2; else keep
    const clamp = ClampPredicateRTIndicator.greaterThan(new SmaRTIndicator(), 2);
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);   // SMA=1, not >2 -> keep
    expect(clamp.update(2)).toBeCloseTo(1.5, DELTA); // SMA=1.5, not >2 -> keep
    expect(clamp.update(6)).toBeCloseTo(2, DELTA);   // SMA=(1.5+6)/2=3.75, >2 -> clamp to 2
  });

  it("testLessThan", () => {
    // lessThan(2): if result < 2, clamp to 2; else keep
    const clamp = ClampPredicateRTIndicator.lessThan(new SmaRTIndicator(), 2);
    expect(clamp.update(1)).toBeCloseTo(2, DELTA);   // SMA=1, <2 -> clamp to 2
    expect(clamp.update(2)).toBeCloseTo(2, DELTA);   // SMA=1.5, <2 -> clamp to 2
    expect(clamp.update(6)).toBeCloseTo(3.75, DELTA); // SMA=3.75, not <2 -> keep
  });

  it("testGreaterOrEqual", () => {
    const clamp = ClampPredicateRTIndicator.greaterOrEqual(new SmaRTIndicator(), 1.5);
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);     // SMA=1, not >=1.5 -> keep
    expect(clamp.update(2)).toBeCloseTo(1.5, DELTA);   // SMA=1.5, >=1.5 -> clamp to 1.5
  });

  it("testLessOrEqual", () => {
    const clamp = ClampPredicateRTIndicator.lessOrEqual(new SmaRTIndicator(), 1.5);
    expect(clamp.update(1)).toBeCloseTo(1.5, DELTA);   // SMA=1, <=1.5 -> clamp to 1.5
    expect(clamp.update(2)).toBeCloseTo(1.5, DELTA);   // SMA=1.5, <=1.5 -> clamp to 1.5
    expect(clamp.update(4)).toBeCloseTo(2.75, DELTA);  // SMA=(1.5+4)/2=2.75, not <=1.5 -> keep
  });

  it("testPositiveOrZero", () => {
    const clamp = ClampPredicateRTIndicator.positiveOrZero(new SmaRTIndicator());
    expect(clamp.update(1)).toBeCloseTo(0, DELTA);      // SMA=1, >=0 -> clamp to 0
    expect(clamp.update(-6)).toBeCloseTo(-2.5, DELTA);  // SMA=(1+-6)/2=-2.5, not >=0 -> keep
  });

  it("testNegativeOrZero", () => {
    const clamp = ClampPredicateRTIndicator.negativeOrZero(new SmaRTIndicator());
    expect(clamp.update(1)).toBeCloseTo(1, DELTA);     // SMA=1, not <=0 -> keep
    expect(clamp.update(-6)).toBeCloseTo(0, DELTA);    // SMA=-2.5, <=0 -> clamp to 0
  });

  it("testReset", () => {
    const clamp = ClampPredicateRTIndicator.positive(new SmaRTIndicator());
    clamp.update(1);
    clamp.reset();
    expect(clamp.getValue()).toBe(0);
    expect(clamp.update(5)).toBeCloseTo(0, DELTA); // SMA=5, positive -> clamp to 0
  });

  it("starts at the decorated indicator's value", () => {
    const clamp = new ClampPredicateRTIndicator(ValueRTIndicator.of(42), () => true, 1234);
    expect(clamp.getValue()).toBe(42);
    expect(clamp.update(100)).toBe(1234);
  });
});
