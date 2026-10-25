import { describe, it, expect } from "vitest";
import { PredicateRTIndicator } from "$numeric/PredicateRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("PredicateRTIndicator", () => {
  // SmaRTIndicator() with no periods uses 2-period running average:
  // nextValue(prev, new) = (prev + new) / 2
  // update(1)  => 1          (init)
  // update(2)  => 1.5        = (1 + 2) / 2
  // update(-6) => -2.25      = (1.5 + -6) / 2
  // update(0)  => -1.125     = (-2.25 + 0) / 2
  // update(3)  => 0.375      = (-2.25 + 3) / 2
  //
  // A value the predicate rejects is not emitted: the indicator keeps the last accepted value, and
  // starts at the decorated indicator's value (0 here).

  it("testPositive", () => {
    const predicate = PredicateRTIndicator.positive(new SmaRTIndicator());
    expect(predicate.update(1)).toBeCloseTo(1, 10);      // sma=1, positive => 1
    expect(predicate.update(2)).toBeCloseTo(1.5, 10);    // sma=1.5, positive => 1.5
    expect(predicate.update(-6)).toBeCloseTo(1.5, 10);   // sma=-2.25, not positive => keeps 1.5
    expect(predicate.update(0)).toBeCloseTo(1.5, 10);    // sma=-1.125, not positive => keeps 1.5
  });

  it("testNegative", () => {
    const predicate = PredicateRTIndicator.negative(new SmaRTIndicator());
    expect(predicate.update(1)).toBeCloseTo(0, 10);      // sma=1, not negative => 0
    expect(predicate.update(2)).toBeCloseTo(0, 10);      // sma=1.5, not negative => 0
    expect(predicate.update(-6)).toBeCloseTo(-2.25, 10); // sma=-2.25, negative => -2.25
  });

  it("testPositiveOrZero", () => {
    const predicate = PredicateRTIndicator.positiveOrZero(new SmaRTIndicator());
    expect(predicate.update(1)).toBeCloseTo(1, 10);      // sma=1, >=0 => 1
    expect(predicate.update(2)).toBeCloseTo(1.5, 10);    // sma=1.5, >=0 => 1.5
    expect(predicate.update(-6)).toBeCloseTo(1.5, 10);   // sma=-2.25, not >=0 => keeps 1.5
    expect(predicate.update(3)).toBeCloseTo(0.375, 10);  // sma=0.375, >=0 => 0.375
  });

  it("testNegativeOrZero", () => {
    const predicate = PredicateRTIndicator.negativeOrZero(new SmaRTIndicator());
    expect(predicate.update(1)).toBeCloseTo(0, 10);      // sma=1, not <=0 => 0
    expect(predicate.update(2)).toBeCloseTo(0, 10);      // sma=1.5, not <=0 => 0
    expect(predicate.update(-6)).toBeCloseTo(-2.25, 10); // sma=-2.25, <=0 => -2.25
    expect(predicate.update(3)).toBeCloseTo(-2.25, 10);  // sma=0.375, not <=0 => keeps -2.25
  });

  it("testGreaterThan", () => {
    const predicate = PredicateRTIndicator.greaterThan(new SmaRTIndicator(), 2);
    expect(predicate.update(1)).toBeCloseTo(0, 10);      // sma=1, not >2 => 0
    expect(predicate.update(2)).toBeCloseTo(0, 10);      // sma=1.5, not >2 => 0
    expect(predicate.update(6)).toBeCloseTo(3.75, 10);   // sma=3.75, >2 => 3.75
  });

  it("testLessThan", () => {
    const predicate = PredicateRTIndicator.lessThan(new SmaRTIndicator(), 2);
    // sma: 1, 1.5, 3.75, -1.125, -3.5625
    expect(predicate.update(1)).toBeCloseTo(1, 10);          // sma=1, <2 => 1
    expect(predicate.update(2)).toBeCloseTo(1.5, 10);        // sma=1.5, <2 => 1.5
    expect(predicate.update(6)).toBeCloseTo(1.5, 10);        // sma=3.75, not <2 => keeps 1.5
    expect(predicate.update(-6)).toBeCloseTo(-1.125, 10);    // sma=-1.125, <2 => -1.125
    expect(predicate.update(-6)).toBeCloseTo(-3.5625, 10);   // sma=-3.5625, <2 => -3.5625
  });

  it("keeps the decorated value on a true predicate and starts at the decorated value", () => {
    const source = ValueRTIndicator.of(42);
    const accepts = new PredicateRTIndicator(source, () => true);
    expect(accepts.getValue()).toBe(42);
    expect(accepts.update(100)).toBe(100);

    const rejects = new PredicateRTIndicator(ValueRTIndicator.of(42), () => false);
    expect(rejects.getValue()).toBe(42);
    expect(rejects.update(100)).toBe(42);
  });

  it("builds the six comparisons", () => {
    // values 5, 10, 15, 10 with a threshold of 10; each keeps the last value the comparison accepted
    const run = (make: (source: ValueRTIndicator) => PredicateRTIndicator) => {
      const source = new ValueRTIndicator();
      const predicate = make(source);
      return [5, 10, 15, 10].map((v) => predicate.update(v));
    };
    expect(run((s) => PredicateRTIndicator.greatThan(s, 10))).toEqual([0, 0, 15, 15]);
    expect(run((s) => PredicateRTIndicator.greatOrEqual(s, 10))).toEqual([0, 10, 15, 10]);
    expect(run((s) => PredicateRTIndicator.lessThan(s, 10))).toEqual([5, 5, 5, 5]);
    expect(run((s) => PredicateRTIndicator.lessOrEqual(s, 10))).toEqual([5, 10, 10, 10]);
    expect(run((s) => PredicateRTIndicator.equal(s, 10))).toEqual([0, 10, 10, 10]);
    expect(run((s) => PredicateRTIndicator.notEqual(s, 10))).toEqual([5, 5, 15, 15]);
  });

  it("testReset", () => {
    const predicate = PredicateRTIndicator.positive(new SmaRTIndicator());
    predicate.update(1);
    predicate.reset();
    expect(predicate.getValue()).toBe(0);
    expect(predicate.update(1)).toBeCloseTo(1, 10);
  });
});
