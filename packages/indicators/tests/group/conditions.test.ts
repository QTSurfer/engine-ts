import { describe, expect, it } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { PredicatePeriodCounterRTIndicator } from "$helpers/PredicatePeriodCounterRTIndicator";
import { ConditionRTIndicator } from "$numeric/ConditionRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

// The conditions the group registers, isLessThan and its kin: 1 while the condition holds, 0 while it
// does not, to be read as a flag with isValue. lessThan and its kin are filters that keep the last
// value that passed, and stay so.

const INSTRUMENT = "BTC/USDT";

/** Closes with a repeat, a dip under 105 and a recovery above it. */
const CLOSES = [100, 110, 110, 99, 101, 104, 103, 80, 120, 120];

function tick(price: number): Ticker {
  return {
    instrument: INSTRUMENT,
    open: price,
    high: price,
    low: price,
    last: price,
    bid: price,
    bidSize: 1,
    ask: price,
    askSize: 1,
    volume: 5,
    quoteVolume: 0,
    vwap: price,
    percentageChange: 0,
    timestamp: 0,
  };
}

const group = () => new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();

/** The values the named indicator reads after each close. */
function trace(g: InstrumentGroupRTIndicator, name: string): number[] {
  return CLOSES.map((close) => {
    g.indicators.updateFrom(tick(close));
    return g.getIndicatorValue(name);
  });
}

/** What isValue says about the named indicator after each close. */
function flags(g: InstrumentGroupRTIndicator, name: string): boolean[] {
  return CLOSES.map((close) => {
    g.indicators.updateFrom(tick(close));
    return g.isValue(name);
  });
}

describe("the conditions of the group", () => {
  it("isLessThan gives one while the condition holds and zero otherwise", () => {
    expect(trace(group().isLessThan("lt", "price", 105), "lt")).toEqual([1, 0, 0, 1, 1, 1, 1, 1, 0, 0]);
  });

  it("every comparison gives its own flag", () => {
    expect(trace(group().isGreatThan("gt", "price", 105), "gt"), "> 105").toEqual([0, 1, 1, 0, 0, 0, 0, 0, 1, 1]);
    expect(trace(group().isGreatOrEqual("ge", "price", 110), "ge"), ">= 110").toEqual([0, 1, 1, 0, 0, 0, 0, 0, 1, 1]);
    expect(trace(group().isLessOrEqual("le", "price", 101), "le"), "<= 101").toEqual([1, 0, 0, 1, 1, 0, 0, 1, 0, 0]);
    expect(trace(group().isEqual("eq", "price", 110), "eq"), "== 110").toEqual([0, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(trace(group().isNotEqual("ne", "price", 110), "ne"), "!= 110").toEqual([1, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("isTrue takes any predicate", () => {
    expect(trace(group().isTrue("even", "price", (v) => v % 2 === 0), "even")).toEqual([1, 1, 1, 0, 0, 1, 0, 1, 1, 1]);
  });

  it("the filters keep the last value that passed and stay so", () => {
    expect(trace(group().lessThan("lt", "price", 105), "lt")).toEqual([100, 100, 100, 99, 101, 104, 103, 80, 80, 80]);
  });

  it("a condition registers a descriptor for the charts", () => {
    const g = group().isLessThan("oversold", "price", 105);
    const oversold = g.getExisting("oversold");

    expect(oversold.getId!()).toBe(ConditionRTIndicator.ID);
    expect(oversold.getMeta!().get(IndicatorMeta.SOURCE)).toBe("price");
    expect(oversold.getMeta!().get(IndicatorMeta.RANGE)).toBe("0:1");
    expect(oversold.getDisplayHint!()).toBe(DisplayHint.NUMBER);
    expect(oversold.isHidden!()).toBe(false);
  });

  it("a condition is ready when its source is", () => {
    const g = group().sma("avg", 3).isGreatThan("above", "avg", 0);
    const ticks = (...closes: number[]) => closes.forEach((close) => g.indicators.updateFrom(tick(close)));

    ticks(100, 100);
    expect(g.getExisting("above").isReady()).toBe(false);
    ticks(100);
    expect(g.getExisting("above").isReady()).toBe(true);
  });

  it("isValue reads a condition as a flag", () => {
    expect(flags(group().isLessThan("oversold", "price", 105), "oversold")).toEqual([
      true, false, false, true, true, true, true, true, false, false,
    ]);
  });

  it("isValue is false while the indicator is not ready, even if its value is not zero", () => {
    const g = group().sma("avg", 3);

    g.indicators.updateFrom(tick(100));
    g.indicators.updateFrom(tick(100));
    expect(g.getIndicatorValue("avg"), "a partial, non-zero value").not.toBe(0);
    expect(g.isValue("avg")).toBe(false);

    g.indicators.updateFrom(tick(100));
    expect(g.isValue("avg")).toBe(true);
  });

  it("isValue is false for zero and for not a number", () => {
    const g = group();
    g.indicators.add("zero", ValueRTIndicator.of(0));
    g.indicators.add("nan", ValueRTIndicator.of(Number.NaN));

    expect(g.getExisting("zero").isReady()).toBe(true);
    expect(g.getExisting("nan").isReady()).toBe(true);
    expect(g.isValue("zero")).toBe(false);
    expect(g.isValue("nan")).toBe(false);
  });

  it("isValue of an unknown name fails loudly", () => {
    expect(() => group().isValue("nope")).toThrow("Indicator not found: nope");
  });

  it("a condition composes with the counter of consecutive periods", () => {
    const g = group().isLessThan("oversold", "price", 105).periodCount("oversoldFor", "oversold", (v) => v > 0);
    const counter = g.getExisting("oversoldFor") as PredicatePeriodCounterRTIndicator;

    const counts = CLOSES.map((close) => {
      g.indicators.updateFrom(tick(close));
      return counter.periodCount;
    });

    expect(counts).toEqual([1, 0, 0, 1, 2, 3, 4, 5, 0, 0]);
  });
});
