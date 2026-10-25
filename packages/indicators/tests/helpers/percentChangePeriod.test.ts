import { describe, it, expect } from "vitest";
import { PercentChangePeriodRTIndicator } from "$helpers/PercentChangePeriodRTIndicator";
import { PeriodCounterRTIndicator } from "$helpers/PeriodCounterRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

// Port of the Java engine's PercentChangePeriodRTIndicatorTest and PercentChangePeriodLossRTIndicatorTest

describe("PercentChangePeriodRTIndicator", () => {
  it("sets the initial value on the first update, with no change", () => {
    const pct = new PercentChangePeriodRTIndicator(new PeriodCounterRTIndicator(new ValueRTIndicator()));
    pct.update(100);
    expect(pct.getInitialValue()).toBe(100);
    expect(pct.getValue()).toBe(0);
    expect(pct.getPercentChange()).toBe(0);
  });

  it("is the change as a fraction of the initial value", () => {
    const pct = new PercentChangePeriodRTIndicator(new PeriodCounterRTIndicator(new ValueRTIndicator()));
    pct.update(100);
    pct.update(110);
    expect(pct.getInitialValue()).toBe(100);
    expect(pct.getValue()).toBeCloseTo(1.1, 9);
    expect(pct.getPercentChange()).toBeCloseTo(110, 9);
  });

  it("shows a decline as a lower ratio", () => {
    const pct = new PercentChangePeriodRTIndicator(new PeriodCounterRTIndicator(new ValueRTIndicator()));
    pct.update(100);
    pct.update(80);
    expect(pct.getValue()).toBeCloseTo(0.8, 9);
    expect(pct.getPercentChange()).toBeCloseTo(80, 9);
  });

  it("takes a zero first value as 100, so the ratio stays defined", () => {
    const pct = new PercentChangePeriodRTIndicator(new PeriodCounterRTIndicator(new ValueRTIndicator()));
    pct.update(0);
    pct.update(50);
    expect(pct.getInitialValue()).toBe(100);
    expect(Number.isNaN(pct.getValue())).toBe(false);
  });

  it("counts the periods of its sequence", () => {
    const pct = new PercentChangePeriodRTIndicator(new PeriodCounterRTIndicator(new ValueRTIndicator()));
    pct.update(100);
    expect(pct.periodCount).toBe(0);
    pct.update(110);
    expect(pct.periodCount).toBe(1);
    pct.update(120);
    expect(pct.periodCount).toBe(2);
  });
});

describe("PercentChangePeriodRTIndicator over a loss", () => {
  it("counts the losses as a fraction of the first value", () => {
    const pct = new PercentChangePeriodRTIndicator(new LossRTIndicator(new ValueRTIndicator()));
    expect(pct.periodCount).toBe(0);
    expect(pct.update(100)).toBe(0);
    expect(pct.periodCount).toBe(0);
    expect(pct.update(80)).toBeCloseTo(0.2, 9);
    expect(pct.getPercentChange()).toBeCloseTo(20, 9);
    expect(pct.periodCount).toBe(1);
  });

  it("counts from a zero first value", () => {
    const pct = new PercentChangePeriodRTIndicator(new LossRTIndicator(new ValueRTIndicator()));
    expect(pct.update(0)).toBe(0);
    expect(pct.update(-20)).toBeCloseTo(0.2, 9);
    expect(pct.getPercentChange()).toBeCloseTo(20, 9);
    expect(pct.periodCount).toBe(1);
    expect(pct.update(-50)).toBeCloseTo(0.3, 9);
    expect(pct.getPercentChange()).toBeCloseTo(30, 9);
    expect(pct.periodCount).toBe(2);
  });

  it("counts no period while the value rises, so a rise is no loss", () => {
    const pct = new PercentChangePeriodRTIndicator(new LossRTIndicator(new ValueRTIndicator()));
    expect(pct.update(80)).toBe(0);
    expect(pct.update(90)).toBe(0);
    expect(pct.update(100)).toBe(0);
    expect(pct.periodCount).toBe(0);
  });
});
