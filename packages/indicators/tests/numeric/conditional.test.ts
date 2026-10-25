import { describe, it, expect } from "vitest";
import { ConditionalRTIndicator } from "$numeric/ConditionalRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";

const DELTA = 10;

describe("ConditionalRTIndicator", () => {
  // Non-periodic SMA: init=first value, then (prev+new)/2
  // update(1) -> SMA=1
  // update(2) -> SMA=(1+2)/2=1.5
  // update(-6) -> SMA=(1.5+-6)/2=-2.25

  it("testPositive", () => {
    const cond = ConditionalRTIndicator.positive(new SmaRTIndicator());
    expect(cond.update(1)).toBeCloseTo(1, DELTA);    // SMA=1, positive -> return 1
    expect(cond.update(2)).toBeCloseTo(1.5, DELTA);  // SMA=1.5, positive -> return 1.5
    expect(cond.update(-6)).toBeCloseTo(0, DELTA);   // SMA=-2.25, not positive -> default 0
  });

  it("testPositiveThen", () => {
    const cond = ConditionalRTIndicator.positive(new SmaRTIndicator()).then((v) => v * 2);
    expect(cond.update(1)).toBeCloseTo(2, DELTA);    // SMA=1, positive -> 1*2=2
    expect(cond.update(2)).toBeCloseTo(3, DELTA);    // SMA=1.5, positive -> 1.5*2=3
    expect(cond.update(-6)).toBeCloseTo(0, DELTA);   // SMA=-2.25, not positive -> default 0
  });

  it("testPositiveThenElse", () => {
    const cond = ConditionalRTIndicator.positive(new SmaRTIndicator())
      .then((v) => v * 2)
      .orElse((v) => v * 3);
    expect(cond.update(1)).toBeCloseTo(2, DELTA);     // SMA=1, positive -> 1*2=2
    expect(cond.update(2)).toBeCloseTo(3, DELTA);     // SMA=1.5, positive -> 1.5*2=3
    expect(cond.update(-6)).toBeCloseTo(-6.75, DELTA); // SMA=-2.25, else -> -2.25*3=-6.75
  });

  it("testNegative", () => {
    const cond = ConditionalRTIndicator.negative(new SmaRTIndicator());
    expect(cond.update(1)).toBeCloseTo(0, DELTA);      // SMA=1, not negative -> default 0
    expect(cond.update(2)).toBeCloseTo(0, DELTA);      // SMA=1.5, not negative -> default 0
    expect(cond.update(-6)).toBeCloseTo(-2.25, DELTA); // SMA=-2.25, negative -> return -2.25
  });

  it("testDefaultValue", () => {
    const cond = ConditionalRTIndicator.positive(new SmaRTIndicator()).defaultValue(42);
    expect(cond.update(1)).toBeCloseTo(1, DELTA);   // SMA=1, positive -> return 1
    expect(cond.update(-6)).toBeCloseTo(42, DELTA); // SMA=-2.5, not positive -> default 42
  });

  it("testGreaterThan", () => {
    const cond = ConditionalRTIndicator.greaterThan(new SmaRTIndicator(), 2);
    expect(cond.update(1)).toBeCloseTo(0, DELTA);    // SMA=1, not >2 -> default 0
    expect(cond.update(2)).toBeCloseTo(0, DELTA);    // SMA=1.5, not >2 -> default 0
    expect(cond.update(6)).toBeCloseTo(3.75, DELTA); // SMA=(1.5+6)/2=3.75, >2 -> return 3.75
  });

  it("testLessThan", () => {
    const cond = ConditionalRTIndicator.lessThan(new SmaRTIndicator(), 2);
    expect(cond.update(1)).toBeCloseTo(1, DELTA);   // SMA=1, <2 -> return 1
    expect(cond.update(2)).toBeCloseTo(1.5, DELTA); // SMA=1.5, <2 -> return 1.5
    expect(cond.update(6)).toBeCloseTo(0, DELTA);   // SMA=3.75, not <2 -> default 0
  });

  it("testZero", () => {
    const cond = ConditionalRTIndicator.zero(new SmaRTIndicator());
    expect(cond.update(1)).toBeCloseTo(0, DELTA);   // SMA=1, not zero -> default 0
    expect(cond.update(-1)).toBeCloseTo(0, DELTA);  // SMA=0, zero -> return 0
  });

  it("testPositiveOrZero", () => {
    const cond = ConditionalRTIndicator.positiveOrZero(new SmaRTIndicator());
    expect(cond.update(1)).toBeCloseTo(1, DELTA);   // SMA=1, >=0 -> return 1
    expect(cond.update(-6)).toBeCloseTo(0, DELTA);  // SMA=-2.5, not >=0 -> default 0
  });

  it("testNegativeOrZero", () => {
    const cond = ConditionalRTIndicator.negativeOrZero(new SmaRTIndicator());
    expect(cond.update(1)).toBeCloseTo(0, DELTA);      // SMA=1, not <=0 -> default 0
    expect(cond.update(-6)).toBeCloseTo(-2.5, DELTA);  // SMA=-2.5, <=0 -> return -2.5
  });

  describe("with then and else indicators", () => {
    it("feeds the then indicator when the predicate holds", () => {
      const indicator = ValueRTIndicator.of(42);
      const thenIndicator = ValueRTIndicator.of(27);
      const elseIndicator = ValueRTIndicator.of(31);
      const cond = new ConditionalRTIndicator(indicator, () => true, thenIndicator, elseIndicator);
      expect(cond.getValue()).toBe(42); // starts at the decorated value
      cond.update(100);
      expect(indicator.getValue()).toBe(100);
      expect(cond.getValue()).toBe(100);
      expect(thenIndicator.getValue()).toBe(100);
      expect(elseIndicator.getValue()).toBe(31); // never fed
    });

    it("feeds the else indicator when the predicate fails", () => {
      const thenIndicator = ValueRTIndicator.of(27);
      const elseIndicator = ValueRTIndicator.of(31);
      const cond = new ConditionalRTIndicator(ValueRTIndicator.of(42), () => false, thenIndicator, elseIndicator);
      cond.update(100);
      expect(cond.getValue()).toBe(100);
      expect(thenIndicator.getValue()).toBe(27); // never fed
      expect(elseIndicator.getValue()).toBe(100);
    });

    it("keeps its value when the predicate fails and there is no else indicator", () => {
      const cond = new ConditionalRTIndicator(ValueRTIndicator.of(42), (i) => i.getValue() > 50, ValueRTIndicator.of(0));
      expect(cond.update(40)).toBe(42);
      expect(cond.update(60)).toBe(60);
      expect(cond.update(10)).toBe(60);
    });

    it("tests the predicate against the decorated indicator after it was updated", () => {
      const seen: number[] = [];
      const cond = new ConditionalRTIndicator(
        ValueRTIndicator.of(0),
        (i) => {
          seen.push(i.getValue());
          return true;
        },
        ValueRTIndicator.of(0),
      );
      cond.update(5);
      cond.update(7);
      expect(seen).toEqual([5, 7]);
    });

    it("updates the then indicator only on the ticks where the predicate holds", () => {
      // then EMA(2), alpha = 2/3, fed 12 then 15: 12, then 12 + (15 - 12) * 2/3 = 14. The 8 between is not fed.
      const cond = new ConditionalRTIndicator(new ValueRTIndicator(), (i) => i.getValue() > 10, new EmaRTIndicator(2));
      expect([5, 12, 8, 15].map((v) => cond.update(v))).toEqual([0, 12, 12, 14]);
    });

    it("resets the branches with it", () => {
      const cond = new ConditionalRTIndicator(ValueRTIndicator.of(0), () => true, new EmaRTIndicator(2));
      cond.update(10);
      cond.update(40);
      cond.reset();
      expect(cond.getValue()).toBe(0);
      expect(cond.update(10)).toBe(10); // a fresh EMA starts at the first value
    });
  });

  it("then, orElse and defaultValue need a conditional built from values", () => {
    const cond = new ConditionalRTIndicator(new SmaRTIndicator(), () => true, new SmaRTIndicator());
    expect(() => cond.then((v) => v)).toThrow();
  });

  it("testReset", () => {
    const cond = ConditionalRTIndicator.positive(new SmaRTIndicator());
    cond.update(1);
    cond.reset();
    expect(cond.getValue()).toBe(0);
    expect(cond.update(1)).toBeCloseTo(1, DELTA);
  });


  describe("readiness", () => {
    it("is ready when its source and both branches are", () => {
      const source = new SmaRTIndicator(5);
      const thenBranch = new SmaRTIndicator(3);
      const elseBranch = new SmaRTIndicator(4);
      const cond = new ConditionalRTIndicator(
        source,
        (i) => i.getValue() > 0,
        new ReadOnlyRTIndicator(thenBranch),
        new ReadOnlyRTIndicator(elseBranch),
      );

      for (let tick = 1; tick <= 8; tick++) {
        thenBranch.update(100 + tick);
        elseBranch.update(100 + tick);
        cond.update(100 + tick);
        expect(cond.isReady(), `tick ${tick}`).toBe(tick >= 5);
      }
    });

    it("a slow branch holds it back even when the source is ready", () => {
      const source = new SmaRTIndicator(3);
      const thenBranch = new SmaRTIndicator(6);
      const cond = new ConditionalRTIndicator(
        source,
        (i) => i.getValue() > 0,
        new ReadOnlyRTIndicator(thenBranch),
      );

      for (let tick = 1; tick <= 8; tick++) {
        thenBranch.update(100 + tick);
        cond.update(100 + tick);
        expect(source.isReady(), `source at tick ${tick}`).toBe(tick >= 3);
        expect(cond.isReady(), `tick ${tick}`).toBe(tick >= 6);
      }
    });

    it("is not ready again after a reset", () => {
      const source = new SmaRTIndicator(5);
      const thenBranch = new SmaRTIndicator(3);
      const cond = new ConditionalRTIndicator(source, (i) => i.getValue() > 0, thenBranch);
      for (let tick = 1; tick <= 8; tick++) cond.update(100 + tick);
      expect(cond.isReady()).toBe(true);

      cond.reset();

      expect(cond.isReady()).toBe(false);
      expect(source.isReady()).toBe(false);
      expect(thenBranch.isReady()).toBe(false);
    });
  });
});
