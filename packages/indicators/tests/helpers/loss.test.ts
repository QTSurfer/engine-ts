import { describe, it, expect } from "vitest";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("LossRTIndicator", () => {
  it("testPlainIndicator", () => {
    const loss = new LossRTIndicator();
    expect(loss.periodCount).toBe(0);
    expect(loss.update(2)).toBe(0);
    expect(loss.periodCount).toBe(0);
    expect(loss.update(1)).toBe(1);
    expect(loss.periodCount).toBe(1);
    expect(loss.update(0.5)).toBe(0.5);
    expect(loss.periodCount).toBe(2);
  });

  it("testThatLossesAreCounted (with SMA decorator)", () => {
    const loss = new LossRTIndicator(new SmaRTIndicator());
    expect(loss.periodCount).toBe(0);
    expect(loss.update(2)).toBe(0);
    expect(loss.periodCount).toBe(0);
    expect(loss.update(1)).toBe(0.5);
    expect(loss.periodCount).toBe(1);
  });

  it("testThatGainsResetsLossesPeriods", () => {
    const loss = new LossRTIndicator(new SmaRTIndicator());
    expect(loss.periodCount).toBe(0);
    expect(loss.update(2)).toBe(0);
    expect(loss.periodCount).toBe(0);
    expect(loss.update(1)).toBe(0.5);
    expect(loss.periodCount).toBe(1);
    expect(loss.update(2)).toBe(0);
    expect(loss.periodCount).toBe(0);
  });

  it("testDisabledResetPeriodsOnSustainedValues", () => {
    const loss = new LossRTIndicator(new SmaRTIndicator());
    loss.setResetPeriodsOnSustain(false);
    expect(loss.periodCount).toBe(0);
    expect(loss.update(2)).toBe(0);
    expect(loss.getValue()).toBe(0);
    expect(loss.periodCount).toBe(0);
    expect(loss.update(1)).toBe(0.5);
    expect(loss.getValue()).toBe(0.5);
    expect(loss.periodCount).toBe(1);
    expect(loss.update(1)).toBeCloseTo(0.25, 10);
    expect(loss.getValue()).toBeCloseTo(0.25, 10);
    expect(loss.periodCount).toBe(2);
  });

  it("testFromTickerFixturesClosingPricesList", () => {
    const loss = new LossRTIndicator();
    const sma = new SmaRTIndicator(14, loss);
    for (const price of CLOSE_PRICES_LIST) {
      sma.update(price);
    }
    expect(loss.getValue()).toBe(0);
    expect(sma.getValue()).toBeCloseTo(0.286, 1);
  });

  it("testReset", () => {
    const loss = new LossRTIndicator();
    const values = [20, 10, 25, 15];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(loss.update(v));
    }
    loss.reset();
    expect(loss.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(loss.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
