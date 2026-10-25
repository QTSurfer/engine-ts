import { describe, it, expect } from "vitest";
import { TransformRTIndicator } from "$numeric/TransformRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("TransformRTIndicator", () => {
  it("testGetValue", () => {
    const v = ValueRTIndicator.of(42);
    const plusInstance = TransformRTIndicator.plus(v, 100);
    const minusInstance = TransformRTIndicator.minus(v, 100);
    const multiplyInstance = TransformRTIndicator.multiply(v, 100);
    const divideInstance = TransformRTIndicator.divide(v, 100);
    const maxInstance = TransformRTIndicator.max(v, 100);
    const minInstance = TransformRTIndicator.min(v, 100);
    const absInstance = TransformRTIndicator.abs(v);
    const sqrtInstance = TransformRTIndicator.sqrt(v);
    const logInstance = TransformRTIndicator.log(v);

    expect(plusInstance.getValue()).toBe(142);
    expect(minusInstance.getValue()).toBe(-58);
    expect(multiplyInstance.getValue()).toBe(4200);
    expect(divideInstance.getValue()).toBe(0.42);
    expect(maxInstance.getValue()).toBe(100);
    expect(minInstance.getValue()).toBe(42);
    expect(absInstance.getValue()).toBe(42);
    expect(sqrtInstance.getValue()).toBeCloseTo(6.48, 1);
    expect(logInstance.getValue()).toBeCloseTo(3.73, 1);
  });

  it("testUpdate", () => {
    const v = ValueRTIndicator.of(42);
    const plusInstance = TransformRTIndicator.plus(v, 100);
    const minusInstance = TransformRTIndicator.minus(v, 100);
    const multiplyInstance = TransformRTIndicator.multiply(v, 100);
    const divideInstance = TransformRTIndicator.divide(v, 100);
    const maxInstance = TransformRTIndicator.max(v, 100);
    const minInstance = TransformRTIndicator.min(v, 100);
    const absInstance = TransformRTIndicator.abs(v);
    const sqrtInstance = TransformRTIndicator.sqrt(v);
    const logInstance = TransformRTIndicator.log(v);

    expect(plusInstance.update(33)).toBe(133);
    expect(minusInstance.update(33)).toBe(-67);
    expect(multiplyInstance.update(33)).toBe(3300);
    expect(divideInstance.update(33)).toBe(0.33);
    expect(maxInstance.update(33)).toBe(100);
    expect(minInstance.update(33)).toBe(33);
    expect(absInstance.update(-33)).toBe(33);
    expect(sqrtInstance.update(9)).toBe(3);
    expect(logInstance.update(33)).toBeCloseTo(3.49, 1);
  });

  it("testNegate", () => {
    const transform = TransformRTIndicator.negate(ValueRTIndicator.of(0));
    expect(transform.update(1)).toBe(-1);
    expect(transform.update(2)).toBe(-2);
  });

  it("testPercent", () => {
    const transform = TransformRTIndicator.percent(ValueRTIndicator.of(0));
    expect(transform.update(1)).toBe(100);
    expect(transform.update(0.5)).toBe(50);
  });

  it("testClamp", () => {
    const transform = TransformRTIndicator.clamp(ValueRTIndicator.of(0), 10, 20);
    expect(transform.update(5)).toBe(10);
    expect(transform.update(15)).toBe(15);
    expect(transform.update(25)).toBe(20);
  });

  it("testClampInvalidRange", () => {
    expect(() => TransformRTIndicator.clamp(ValueRTIndicator.of(0), 20, 10)).toThrow(
      "Min range must be < max range",
    );
  });

  it("testReset", () => {
    const v = ValueRTIndicator.of(0);
    const instance = TransformRTIndicator.plus(v, 100);
    const values = [10, 20, 30];
    const firstRunResults: number[] = [];
    for (const val of values) {
      firstRunResults.push(instance.update(val));
    }
    instance.reset();
    expect(instance.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(instance.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
