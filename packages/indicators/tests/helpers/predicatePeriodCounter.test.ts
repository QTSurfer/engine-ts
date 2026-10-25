import { describe, it, expect } from "vitest";
import { PredicatePeriodCounterRTIndicator } from "$helpers/PredicatePeriodCounterRTIndicator";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

const DELTA = 10;

describe("PredicatePeriodCounterRTIndicator", () => {
  // The value is the decorated indicator's value; the count of consecutive periods the predicate
  // held is `periodCount`.
  it("testPositive", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.positive(gain);
    counter.update(10); // gain=0
    expect(counter.periodCount).toBe(0);
    expect(counter.update(20)).toBeCloseTo(10, DELTA); // gain=10
    expect(counter.periodCount).toBe(1);
    expect(counter.update(25)).toBeCloseTo(5, DELTA); // gain=5
    expect(counter.periodCount).toBe(2);
    expect(counter.update(20)).toBeCloseTo(0, DELTA); // gain=0 (loss resets)
    expect(counter.periodCount).toBe(0);
    counter.update(25); // gain=5
    expect(counter.periodCount).toBe(1);
    expect(counter.maxPeriods).toBe(2);
  });

  it("testPositiveWithLoss", () => {
    // LossRTIndicator returns positive values for losses,
    // so positive() predicate counts consecutive loss periods.
    const loss = new LossRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.positive(loss);
    counter.update(10); // loss=0
    expect(counter.periodCount).toBe(0);
    counter.update(20); // loss=0 (price went up)
    expect(counter.periodCount).toBe(0);
    expect(counter.update(15)).toBeCloseTo(5, DELTA); // loss=5
    expect(counter.periodCount).toBe(1);
    counter.update(10); // loss=5
    expect(counter.periodCount).toBe(2);
    counter.update(20); // loss=0 (price went up)
    expect(counter.periodCount).toBe(0);
  });

  it("testGreaterThan", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.greaterThan(gain, 3);
    counter.update(10); // gain=0
    expect(counter.periodCount).toBe(0);
    counter.update(20); // gain=10 > 3
    expect(counter.periodCount).toBe(1);
    counter.update(22); // gain=2, not > 3
    expect(counter.periodCount).toBe(0);
    counter.update(30); // gain=8 > 3
    expect(counter.periodCount).toBe(1);
  });

  it("testLessThan", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.lessThan(gain, 5);
    counter.update(10); // gain=0 < 5
    expect(counter.periodCount).toBe(1);
    counter.update(12); // gain=2 < 5
    expect(counter.periodCount).toBe(2);
    counter.update(20); // gain=8, not < 5
    expect(counter.periodCount).toBe(0);
  });

  it("builds the six comparisons", () => {
    // values 5, 10, 15, 10 against a threshold of 10: the periods in a row the comparison held
    const run = (make: (source: ValueRTIndicator) => PredicatePeriodCounterRTIndicator) => {
      const counter = make(new ValueRTIndicator());
      return [5, 10, 15, 10].map((v) => {
        counter.update(v);
        return counter.periodCount;
      });
    };
    expect(run((s) => PredicatePeriodCounterRTIndicator.greatThan(s, 10))).toEqual([0, 0, 1, 0]);
    expect(run((s) => PredicatePeriodCounterRTIndicator.greatOrEqual(s, 10))).toEqual([0, 1, 2, 3]);
    expect(run((s) => PredicatePeriodCounterRTIndicator.lessThan(s, 10))).toEqual([1, 0, 0, 0]);
    expect(run((s) => PredicatePeriodCounterRTIndicator.lessOrEqual(s, 10))).toEqual([1, 2, 0, 1]);
    expect(run((s) => PredicatePeriodCounterRTIndicator.equal(s, 10))).toEqual([0, 1, 0, 1]);
    expect(run((s) => PredicatePeriodCounterRTIndicator.notEqual(s, 10))).toEqual([1, 0, 1, 0]);
  });

  it("testMaxPeriods", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.positive(gain);
    counter.update(10); // gain=0, counter=0
    counter.update(20); // gain=10, counter=1
    counter.update(25); // gain=5, counter=2
    expect(counter.maxPeriods).toBe(2);
    expect(counter.periodCount).toBe(2);
    expect(counter.currentPeriods).toBe(2);
    counter.update(20); // gain=0, resets
    expect(counter.periodCount).toBe(0);
    expect(counter.maxPeriods).toBe(2); // max stays
  });

  it("testPeriodStartValue", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.positive(gain);
    counter.update(10); // gain=0
    counter.update(20); // gain=10, start of positive period
    expect(counter.periodStartValue).toBe(10);
    counter.update(25); // gain=5, continues
    expect(counter.periodStartValue).toBe(10); // still from start
  });

  it("resetPeriods zeroes the count only", () => {
    const counter = new PredicatePeriodCounterRTIndicator(ValueRTIndicator.of(0), () => true);
    counter.update(7);
    counter.update(8);
    expect(counter.periodCount).toBe(2);
    counter.resetPeriods();
    expect(counter.periodCount).toBe(0);
    expect(counter.getValue()).toBe(8);
  });

  it("testReset", () => {
    const gain = new GainRTIndicator();
    const counter = PredicatePeriodCounterRTIndicator.positive(gain);
    counter.update(10);
    counter.update(20);
    counter.reset();
    expect(counter.periodCount).toBe(0);
    expect(counter.maxPeriods).toBe(0);
    expect(counter.getValue()).toBe(0);
  });

  it("testUpdateWithTruePredicate", () => {
    const indicator = ValueRTIndicator.of(42);
    const counter = new PredicatePeriodCounterRTIndicator(indicator, () => true);
    expect(counter.getValue()).toBe(42);
    expect(counter.update(100)).toBe(100);
    expect(counter.periodCount).toBe(1);
    expect(indicator.getValue()).toBe(100);
  });

  it("testUpdateWithFalsePredicate", () => {
    const indicator = ValueRTIndicator.of(42);
    const counter = new PredicatePeriodCounterRTIndicator(indicator, () => false);
    expect(counter.update(100)).toBe(100);
    expect(counter.periodCount).toBe(0);
    expect(indicator.getValue()).toBe(100);
  });
});
