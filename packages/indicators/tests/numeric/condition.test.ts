import { describe, expect, it } from "vitest";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { ConditionRTIndicator } from "$numeric/ConditionRTIndicator";
import { PredicateRTIndicator } from "$numeric/PredicateRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

/** The boolean twin of PredicateRTIndicator: 1 while the condition holds, 0 while not. */
describe("ConditionRTIndicator", () => {
  it("gives one while the condition holds and zero otherwise", () => {
    const instance = new ConditionRTIndicator(ValueRTIndicator.of(0), (v) => v > 10);

    expect(instance.update(5)).toBe(0);
    expect(instance.update(20)).toBe(1);
    expect(instance.update(7), "it does not keep the last value that passed").toBe(0);
    expect(instance.getValue()).toBe(0);
  });

  it("is told apart from its filter twin, which keeps the last value that passed", () => {
    const filter = new PredicateRTIndicator(ValueRTIndicator.of(0), (v) => v > 10);

    filter.update(20);
    filter.update(7);

    expect(filter.getValue()).toBe(20);
  });

  it("follows the readiness of its source", () => {
    const instance = ConditionRTIndicator.greatThan(new SmaRTIndicator(3), 0);

    instance.update(10);
    instance.update(10);
    expect(instance.isReady()).toBe(false);
    instance.update(10);
    expect(instance.isReady()).toBe(true);
    expect(instance.getValue()).toBe(1);
  });

  it("resets the source and reads zero after a reset", () => {
    const source: RTIndicator = ValueRTIndicator.of(0);
    const instance = ConditionRTIndicator.lessThan(source, 5);
    instance.update(1);
    expect(instance.getValue()).toBe(1);

    instance.reset();

    expect(instance.getValue()).toBe(0);
    expect(source.getValue()).toBe(0);
  });

  it("tests its own comparison in every factory", () => {
    const flags = (indicator: ConditionRTIndicator) => [4, 5, 6].map((value) => indicator.update(value));
    const source = () => ValueRTIndicator.of(0);

    expect(flags(ConditionRTIndicator.equal(source(), 5))).toEqual([0, 1, 0]);
    expect(flags(ConditionRTIndicator.notEqual(source(), 5))).toEqual([1, 0, 1]);
    expect(flags(ConditionRTIndicator.lessThan(source(), 5))).toEqual([1, 0, 0]);
    expect(flags(ConditionRTIndicator.lessOrEqual(source(), 5))).toEqual([1, 1, 0]);
    expect(flags(ConditionRTIndicator.greatThan(source(), 5))).toEqual([0, 0, 1]);
    expect(flags(ConditionRTIndicator.greatOrEqual(source(), 5))).toEqual([0, 1, 1]);
  });
});
