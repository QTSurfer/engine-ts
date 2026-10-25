import { describe, it, expect, beforeEach } from "vitest";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { CLOSE_PRICES_LIST } from "../fixtures";

describe("GainRTIndicator", () => {
  it("testPlainIndicator", () => {
    const gain = new GainRTIndicator();
    expect(gain.periodCount).toBe(0);
    expect(gain.update(1)).toBe(0);
    expect(gain.periodCount).toBe(0);
    expect(gain.update(2)).toBe(1);
    expect(gain.periodCount).toBe(1);
    expect(gain.update(2.5)).toBe(0.5);
    expect(gain.periodCount).toBe(2);
  });

  it("testThatGainsAreCounted (with SMA decorator)", () => {
    const gain = new GainRTIndicator(new SmaRTIndicator());
    expect(gain.periodCount).toBe(0);
    expect(gain.update(1)).toBe(0);
    expect(gain.periodCount).toBe(0);
    expect(gain.update(2)).toBe(0.5);
    expect(gain.periodCount).toBe(1);
  });

  it("testThatLossesResetsGainPeriods", () => {
    const gain = new GainRTIndicator(new SmaRTIndicator());
    expect(gain.periodCount).toBe(0);
    expect(gain.update(1)).toBe(0);
    expect(gain.periodCount).toBe(0);
    expect(gain.update(2)).toBe(0.5);
    expect(gain.periodCount).toBe(1);
    expect(gain.update(1)).toBe(0);
    expect(gain.periodCount).toBe(0);
  });

  it("testDisabledResetPeriodsOnSustainedValues", () => {
    const gain = new GainRTIndicator(new SmaRTIndicator());
    gain.setResetPeriodsOnSustain(false);
    expect(gain.periodCount).toBe(0);
    expect(gain.update(1)).toBe(0);
    expect(gain.getValue()).toBe(0);
    expect(gain.periodCount).toBe(0);
    expect(gain.update(2)).toBe(0.5);
    expect(gain.getValue()).toBe(0.5);
    expect(gain.periodCount).toBe(1);
    expect(gain.update(2)).toBeCloseTo(0.25, 10);
    expect(gain.getValue()).toBeCloseTo(0.25, 10);
    expect(gain.periodCount).toBe(2);
  });

  it("testFromTickerFixturesClosingPricesList", () => {
    const gain = new GainRTIndicator();
    const sma = new SmaRTIndicator(CLOSE_PRICES_LIST.length, gain);
    for (const price of CLOSE_PRICES_LIST) {
      sma.update(price);
    }
    expect(gain.getValue()).toBeCloseTo(0.47, 1);
    expect(sma.getValue()).toBeCloseTo(0.19, 1);
  });

  it("testReset", () => {
    const gain = new GainRTIndicator();
    const values = [10, 20, 15, 25];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(gain.update(v));
    }
    gain.reset();
    expect(gain.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(gain.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
