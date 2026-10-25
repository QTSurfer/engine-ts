import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { KlineValueSource, TickerValueSource } from "@qtsurfer/core";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { DisplayHint } from "$core/DisplayHint";
import type { RTIndicator } from "$core/RTIndicator";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { PredicatePeriodCounterRTIndicator } from "$helpers/PredicatePeriodCounterRTIndicator";
import { CciRTIndicator } from "$indicators/CciRTIndicator";
import { MacdRTIndicator } from "$indicators/MacdRTIndicator";
import { StochasticRsiRTIndicator } from "$indicators/StochasticRsiRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "$group/InstrumentMapKlineSourceRTIndicator";
import { KlineRTIndicator } from "$group/KlineRTIndicator";
import { TickerRTIndicator } from "$group/TickerRTIndicator";
import { ClampPredicateRTIndicator } from "$numeric/ClampPredicateRTIndicator";
import { ClampRTIndicator } from "$numeric/ClampRTIndicator";
import { ConditionalRTIndicator } from "$numeric/ConditionalRTIndicator";
import { PredicateRTIndicator } from "$numeric/PredicateRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";
import { TransformRTIndicator } from "$numeric/TransformRTIndicator";
import { BiFunctionRTIndicator } from "$numeric/BiFunctionRTIndicator";

const INSTRUMENT = "BTC/USDT";

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

/** A group whose "price" follows the last price of each tick. */
function priceGroup(): InstrumentGroupRTIndicator {
  return new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();
}

/** A group with `hi` = 2 x price and `lo` = -1 x price: two branches that tell each other apart. */
function branchGroup(): InstrumentGroupRTIndicator {
  return priceGroup().mul("hi", "price", 2).mul("lo", "price", -1);
}

/** Feeds one tick per price and returns the value of `name` after each. */
function series(group: InstrumentGroupRTIndicator, name: string, prices: number[]): number[] {
  return prices.map((price) => {
    group.indicators.updateFrom(tick(price));
    return group.getIndicatorValue(name);
  });
}

function run(build: (group: InstrumentGroupRTIndicator) => void, name: string, prices: number[]): number[] {
  const group = branchGroup();
  build(group);
  return series(group, name, prices);
}

function metaOf(group: InstrumentGroupRTIndicator, name: string): Record<string, string> {
  return Object.fromEntries(group.getExisting(name).getMeta!().asMap());
}

function growth(group: InstrumentGroupRTIndicator, build: () => void): number {
  const before = group.indicators.size();
  build();
  return group.indicators.size() - before;
}

function close(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(value, `index ${i}`).toBeCloseTo(expected[i], 9));
}

const PRICES = [5, 12, 8, 15];

describe("the Java builder vocabulary", () => {
  // The public builder methods of the Java InstrumentGroupRTIndicator that this class offers (the
  // window forms are listed in window-periods.test.ts). Not offered yet: useTickerValue,
  // indicatorBank, getNotices, backtestEnabled, reset(...names), getValue; stateStoreSupplier is
  // setStateStoreSupplier here.
  const JAVA_BUILDER_METHODS = [
    "addPrice",
    "sma",
    "ema",
    "rsi",
    "macd",
    "cci",
    "stochRsi",
    "bollinger",
    "bollingerBandwidth",
    "gain",
    "loss",
    "max",
    "min",
    "sum",
    "distanceMa",
    "distance",
    "percentChange",
    "rateChange",
    "decorate",
    "equal",
    "notEqual",
    "greatOrEqual",
    "greatThan",
    "lessOrEqual",
    "lessThan",
    "predicate",
    "periodCount",
    "conditional",
    "clamp",
    "round",
    "add",
    "diff",
    "mul",
    "fun",
    "window",
    "addWindow",
    "getReadOnlyExisting",
    "getReadOnly",
    "getExisting",
    "get",
    "remove",
    "clear",
  ];

  it.each(JAVA_BUILDER_METHODS)("offers %s", (method) => {
    expect(typeof (priceGroup() as unknown as Record<string, unknown>)[method]).toBe("function");
  });

  it("offers the default name prefixes", () => {
    expect(InstrumentGroupRTIndicator.PREFIX_MACD).toBe("macd");
    expect(InstrumentGroupRTIndicator.PREFIX_CCI).toBe("cci");
    expect(InstrumentGroupRTIndicator.PREFIX_STOCH_RSI).toBe("stochRsi");
    expect(InstrumentGroupRTIndicator.PREFIX_CLAMP).toBe("clmp");
    expect(InstrumentGroupRTIndicator.PREFIX_WINDOW).toBe("_win");
  });
});

describe("macd", () => {
  it("registers under macd, a given name, or a given name with periods, with no helper entries", () => {
    const group = priceGroup();
    expect(growth(group, () => group.macd())).toBe(1);
    expect(growth(group, () => group.macd("m"))).toBe(1);
    expect(growth(group, () => group.macd("m3", 3, 5))).toBe(1);
    expect(growth(group, () => group.macd("mp", "price", 3, 5))).toBe(1);
    for (const name of ["macd", "m", "m3", "mp"]) {
      expect(group.get(name), name).toBeInstanceOf(MacdRTIndicator);
    }
    expect(group.get("macd12_26")).toBeUndefined();
  });

  it("describes its periods, and its source when it has one", () => {
    const group = priceGroup().macd().macd("m", 3, 5).ema("e", 4).macd("me", "e", 3, 5);
    expect(metaOf(group, "macd")).toEqual({ shortPeriods: "12", longPeriods: "26" });
    expect(metaOf(group, "m")).toEqual({ shortPeriods: "3", longPeriods: "5" });
    expect(metaOf(group, "me")).toMatchObject({ shortPeriods: "3", longPeriods: "5", src: "e" });
    expect(group.getExisting("macd").getDisplayHint!()).toBe(DisplayHint.ABSOLUTE);
  });

  it("is the short EMA minus the long EMA", () => {
    // 10, 20, 30 with EMA(3) alpha 1/2 and EMA(5) alpha 1/3:
    //   short: 10, 10 + 10/2 = 15, 15 + 15/2 = 22.5      long: 10, 10 + 10/3 = 40/3, 40/3 + (50/3)/3 = 170/9
    //   macd:  0, 15 - 40/3 = 5/3, 45/2 - 170/9 = 65/18
    const group = priceGroup().macd("m", 3, 5);
    close(series(group, "m", [10, 20, 30]), [0, 5 / 3, 65 / 18]);
  });

  it("defaults to the 12 and 26 periods", () => {
    // 100 then 110: short 100 + 10 * 2/13, long 100 + 10 * 2/27: 20/13 - 20/27 = 280/351
    const group = priceGroup().macd();
    close(series(group, "macd", [100, 110]), [0, 280 / 351]);
  });

  it("takes the same values through every overload that means the same periods", () => {
    const prices = [10, 20, 30, 25, 40];
    const positional = series(priceGroup().macd(), "macd", prices);
    expect(series(priceGroup().macd("macd"), "macd", prices)).toEqual(positional);
    expect(series(priceGroup().macd("macd", 12, 26), "macd", prices)).toEqual(positional);
    expect(series(priceGroup().macd("macd", "price", 12, 26), "macd", prices)).toEqual(positional);
  });

  it("decorates the named indicator instead of the raw value", () => {
    // dbl = 2 x price, so the macd of dbl is twice the macd of price: 0, 10/3, 65/9
    const group = priceGroup().mul("dbl", "price", 2).macd("md", "dbl", 3, 5);
    close(series(group, "md", [10, 20, 30]), [0, 10 / 3, 65 / 9]);
  });

  it("fails when the named source is not registered", () => {
    expect(() => priceGroup().macd("m", "nope", 3, 5)).toThrow("Indicator not found: nope");
  });
});

describe("cci", () => {
  it("registers under cci + periods or a given name", () => {
    const group = priceGroup();
    expect(growth(group, () => group.cci(20))).toBe(1);
    expect(growth(group, () => group.cci("mine", 14))).toBe(1);
    expect(group.get("cci20")).toBeInstanceOf(CciRTIndicator);
    expect(group.get("mine")).toBeInstanceOf(CciRTIndicator);
  });

  it("describes its periods and has no display hint", () => {
    const group = priceGroup().cci(20).cci("mine", 14);
    expect(metaOf(group, "cci20")).toEqual({ periods: "20" });
    expect(metaOf(group, "mine")).toEqual({ periods: "14" });
    expect(group.getExisting("cci20").getDisplayHint!()).toBe(DisplayHint.ABSOLUTE);
  });

  it("is the distance from the mean over 0.015 times the mean absolute deviation", () => {
    // periods 3 over 10, 20, 60, 100
    //   [10]:          mean 10, deviation 0                                   -> 0
    //   [10, 20]:      mean 15, mad (5 + 5) / 2 = 5,    (20 - 15) / (0.015 * 5)  = 66.67
    //   [10, 20, 60]:  mean 30, mad (20 + 10 + 30) / 3 = 20, (60 - 30) / (0.015 * 20) = 100
    //   [20, 60, 100]: mean 60, mad (40 + 0 + 40) / 3 = 80/3, (100 - 60) / (0.015 * 80/3) = 100
    const group = priceGroup().cci(3);
    close(series(group, "cci3", [10, 20, 60, 100]), [0, 200 / 3, 100, 100]);
  });

  it("takes the same values through the positional and the named form", () => {
    const prices = [10, 20, 60, 100, 30];
    expect(series(priceGroup().cci(3), "cci3", prices)).toEqual(series(priceGroup().cci("cci3", 3), "cci3", prices));
  });
});

describe("stochRsi", () => {
  it("registers under stochRsi + periods or a given name", () => {
    const group = priceGroup();
    expect(growth(group, () => group.stochRsi(14))).toBe(1);
    expect(growth(group, () => group.stochRsi("mine", 7))).toBe(1);
    expect(group.get("stochRsi14")).toBeInstanceOf(StochasticRsiRTIndicator);
    expect(group.get("mine")).toBeInstanceOf(StochasticRsiRTIndicator);
  });

  it("describes its periods and displays as a percentage", () => {
    const group = priceGroup().stochRsi(14);
    expect(metaOf(group, "stochRsi14")).toEqual({ periods: "14", dsp: "P" });
    expect(group.getExisting("stochRsi14").getDisplayHint!()).toBe(DisplayHint.PERCENT);
  });

  it("is where the RSI sits in its own range of the last periods", () => {
    // Cutler RSI(3) over 10, 12, 11, 13, 14, 13 is 0, 0, 66.67, 66.67, 66.67, 75 (averages move
    // at ticks 3 and 6). StochRSI = 100 * (rsi - min) / (max - min) over the last 3 RSI values:
    //   [0] 0   [0, 0] 0   [0, 0, 66.67] 100   [0, 66.67, 66.67] 100   [66.67 x3] 0   [66.67, 66.67, 75] 100
    const group = priceGroup().stochRsi(3);
    expect(series(group, "stochRsi3", [10, 12, 11, 13, 14, 13])).toEqual([0, 0, 100, 100, 0, 100]);
  });

  it("takes the same values through the positional and the named form", () => {
    const prices = [10, 12, 11, 13, 14, 13, 15, 12];
    expect(series(priceGroup().stochRsi(3), "stochRsi3", prices)).toEqual(
      series(priceGroup().stochRsi("stochRsi3", 3), "stochRsi3", prices),
    );
  });
});

describe("the comparisons", () => {
  // price 5, 12, 8, 15. Without branches, the entry holds the price while the comparison holds and
  // keeps the last such price otherwise; it starts at the source's value, 0.
  const WITHOUT_BRANCHES: Array<[string, number, number[]]> = [
    ["greatThan", 12, [0, 0, 0, 15]],
    ["greatOrEqual", 12, [0, 12, 12, 15]],
    ["lessThan", 8, [5, 5, 5, 5]],
    ["lessOrEqual", 8, [5, 5, 8, 8]],
    ["equal", 12, [0, 12, 12, 12]],
    ["notEqual", 12, [5, 5, 8, 15]],
  ];

  it.each(WITHOUT_BRANCHES)("%s(name, indicator, coefficient) filters the source", (method, coefficient, expected) => {
    const group = branchGroup();
    const call = group[method as "greatThan"].bind(group);
    expect(growth(group, () => call("cmp", "price", coefficient))).toBe(1);
    expect(series(group, "cmp", PRICES)).toEqual(expected);
    expect(group.getExisting("cmp")).toBeInstanceOf(PredicateRTIndicator);
    expect(metaOf(group, "cmp")).toEqual({});
  });

  // With then = hi (2 x price) and else = lo (-1 x price): 5 -> -5 | 24 | -8 | 30 depending on the comparison.
  const WITH_BRANCHES: Array<[string, number, number[], number[]]> = [
    //                         then only         then and else
    ["greatThan", 10, [0, 24, 24, 30], [-5, 24, -8, 30]],
    ["greatOrEqual", 12, [0, 24, 24, 30], [-5, 24, -8, 30]],
    ["lessThan", 12, [10, 10, 16, 16], [10, -12, 16, -15]],
    ["lessOrEqual", 12, [10, 24, 16, 16], [10, 24, 16, -15]],
    ["equal", 12, [0, 24, 24, 24], [-5, 24, -8, -15]],
    ["notEqual", 12, [10, 10, 16, 30], [10, -12, 16, 30]],
  ];

  it.each(WITH_BRANCHES)("%s with a then indicator takes its value, and holds when it fails", (method, coefficient, thenOnly) => {
    const group = branchGroup();
    const call = group[method as "greatThan"].bind(group);
    expect(growth(group, () => call("cmp", "price", coefficient, "hi"))).toBe(1);
    expect(series(group, "cmp", PRICES)).toEqual(thenOnly);
    expect(group.getExisting("cmp")).toBeInstanceOf(ConditionalRTIndicator);
    expect(metaOf(group, "cmp")).toEqual({});
  });

  it.each(WITH_BRANCHES)("%s with then and else indicators takes the one that applies", (method, coefficient, _thenOnly, both) => {
    const group = branchGroup();
    (group[method as "greatThan"] as (...args: unknown[]) => unknown).call(group, "cmp", "price", coefficient, "hi", "lo");
    expect(series(group, "cmp", PRICES)).toEqual(both);
  });

  it("returns the group, as every builder method does", () => {
    const group = branchGroup();
    expect(group.greatThan("a", "price", 1)).toBe(group);
    expect(group.greatThan("b", "price", 1, "hi")).toBe(group);
    expect(group.greatThan("c", "price", 1, "hi", "lo")).toBe(group);
  });

  it("takes the same values with the else indicator left out or not registered", () => {
    const four = run((g) => g.greatThan("cmp", "price", 10, "hi"), "cmp", PRICES);
    const fiveMissing = run((g) => g.greatThan("cmp", "price", 10, "hi", "nope"), "cmp", PRICES);
    const fiveUndefined = run((g) => g.greatThan("cmp", "price", 10, "hi", undefined), "cmp", PRICES);
    expect(fiveMissing).toEqual(four);
    expect(fiveUndefined).toEqual(four);
    expect(four).toEqual([0, 24, 24, 30]);
  });

  it("fails on a source or a then indicator that is not registered", () => {
    expect(() => branchGroup().greatThan("cmp", "nope", 10)).toThrow("Indicator not found: nope");
    expect(() => branchGroup().greatThan("cmp", "price", 10, "nope")).toThrow("Indicator not found: nope");
  });

  it("registers nothing when it fails", () => {
    const group = branchGroup();
    expect(() => group.lessThan("cmp", "price", 10, "nope")).toThrow();
    expect(group.get("cmp")).toBeUndefined();
  });
});

describe("predicate", () => {
  it("keeps the source value while the predicate holds and the last accepted value otherwise", () => {
    // even prices pass: 5 no (start value 0), 12 yes, 8 yes, 15 no (keeps 8)
    const group = branchGroup();
    expect(growth(group, () => group.predicate("even", "price", (v) => v % 2 === 0))).toBe(1);
    expect(series(group, "even", PRICES)).toEqual([0, 12, 8, 8]);
    expect(group.getExisting("even")).toBeInstanceOf(PredicateRTIndicator);
    expect(metaOf(group, "even")).toEqual({});
  });

  it("is what the comparison without branches is", () => {
    const viaPredicate = run((g) => g.predicate("cmp", "price", (v) => v > 10), "cmp", PRICES);
    const viaComparison = run((g) => g.greatThan("cmp", "price", 10), "cmp", PRICES);
    expect(viaPredicate).toEqual(viaComparison);
  });
});

describe("periodCount", () => {
  it("counts the updates in a row where the predicate holds and keeps the source value", () => {
    // price > 6: 5 no (0), 12 yes (1), 8 yes (2), 3 no (0), 9 yes (1)
    const group = branchGroup();
    expect(growth(group, () => group.periodCount("run", "price", (v) => v > 6))).toBe(1);
    const counter = group.getExisting("run") as PredicatePeriodCounterRTIndicator;
    expect(counter).toBeInstanceOf(PredicatePeriodCounterRTIndicator);
    const counts: number[] = [];
    const values: number[] = [];
    for (const price of [5, 12, 8, 3, 9]) {
      group.indicators.updateFrom(tick(price));
      counts.push(counter.periodCount);
      values.push(group.getIndicatorValue("run"));
    }
    expect(counts).toEqual([0, 1, 2, 0, 1]);
    expect(values).toEqual([5, 12, 8, 3, 9]);
    expect(metaOf(group, "run")).toEqual({});
  });
});

describe("conditional", () => {
  const above10 = (indicator: RTIndicator): boolean => indicator.getValue() > 10;

  it("takes the value of the then indicator when the predicate holds", () => {
    // then is the raw indicator: only a true predicate feeds it. EMA(2) has alpha 2/3 and is fed 12
    // then 15: 12, then 12 + 3 * 2/3 = 14. The 8 between does not feed it, so the output holds 12.
    const group = priceGroup();
    expect(growth(group, () => group.conditional("cond", "price", above10, new EmaRTIndicator(2)))).toBe(1);
    expect(series(group, "cond", PRICES)).toEqual([0, 12, 12, 14]);
    expect(group.getExisting("cond")).toBeInstanceOf(ConditionalRTIndicator);
    expect(metaOf(group, "cond")).toEqual({});
  });

  it("takes the value of the else indicator when the predicate fails", () => {
    // else EMA(2) is fed 5 then 8: 5, then 5 + 3 * 2/3 = 7
    const group = priceGroup().conditional("cond", "price", above10, new EmaRTIndicator(2), new EmaRTIndicator(2));
    expect(series(group, "cond", PRICES)).toEqual([5, 12, 7, 14]);
  });

  it("takes the same values with the else indicator left out or null", () => {
    const left = series(priceGroup().conditional("cond", "price", above10, new EmaRTIndicator(2)), "cond", PRICES);
    const nulled = series(priceGroup().conditional("cond", "price", above10, new EmaRTIndicator(2), null), "cond", PRICES);
    expect(nulled).toEqual(left);
  });

  it("hands the predicate the read-only view of the source", () => {
    const group = priceGroup();
    let received: RTIndicator | undefined;
    group.conditional(
      "cond",
      "price",
      (indicator) => {
        received = indicator;
        return true;
      },
      new EmaRTIndicator(2),
    );
    series(group, "cond", [5]);
    expect(received).toBeInstanceOf(ReadOnlyRTIndicator);
    expect(received!.getValue()).toBe(5);
  });

  it("fails when the source is not registered", () => {
    expect(() => priceGroup().conditional("cond", "nope", above10, new EmaRTIndicator(2))).toThrow("Indicator not found: nope");
  });
});

describe("clamp", () => {
  it("clamps to a range, named after the source by default", () => {
    // 5, 12, 8, 15 held to [6, 10]
    const group = priceGroup();
    expect(growth(group, () => group.clamp("price", 6, 10))).toBe(1);
    expect(group.get("clmpprice")).toBeInstanceOf(ClampRTIndicator);
    expect(series(group, "clmpprice", PRICES)).toEqual([6, 10, 8, 10]);
    expect(metaOf(group, "clmpprice")).toEqual({});
  });

  it("clamps to a range under a given name", () => {
    const group = priceGroup();
    expect(growth(group, () => group.clamp("band", "price", 6, 10))).toBe(1);
    expect(group.get("band")).toBeInstanceOf(ClampRTIndicator);
    expect(series(group, "band", PRICES)).toEqual([6, 10, 8, 10]);
  });

  it("replaces the values a predicate holds for with the clamp value, named after the source by default", () => {
    // above 10 becomes 10: 5, 12 -> 10, 8, 15 -> 10
    const group = priceGroup();
    expect(growth(group, () => group.clamp("price", (v) => v > 10, 10))).toBe(1);
    expect(group.get("clmpprice")).toBeInstanceOf(ClampPredicateRTIndicator);
    expect(series(group, "clmpprice", PRICES)).toEqual([5, 10, 8, 10]);
    expect(metaOf(group, "clmpprice")).toEqual({});
  });

  it("replaces the values a predicate holds for under a given name", () => {
    const group = priceGroup();
    expect(growth(group, () => group.clamp("cap", "price", (v) => v > 10, 10))).toBe(1);
    expect(group.get("cap")).toBeInstanceOf(ClampPredicateRTIndicator);
    expect(series(group, "cap", PRICES)).toEqual([5, 10, 8, 10]);
  });

  it("takes the same values through the default and the given name", () => {
    expect(series(priceGroup().clamp("price", 6, 10), "clmpprice", PRICES)).toEqual(
      series(priceGroup().clamp("clmpprice", "price", 6, 10), "clmpprice", PRICES),
    );
    const above = (v: number): boolean => v > 10;
    expect(series(priceGroup().clamp("price", above, 10), "clmpprice", PRICES)).toEqual(
      series(priceGroup().clamp("clmpprice", "price", above, 10), "clmpprice", PRICES),
    );
  });

  it("replaces the entry of the other form when both use the default name", () => {
    const group = priceGroup().clamp("price", 6, 10).clamp("price", (v) => v > 10, 10);
    expect(group.get("clmpprice")).toBeInstanceOf(ClampPredicateRTIndicator);
  });

  it("starts at the source's value, as the clamp of a predicate does", () => {
    const group = priceGroup();
    group.getExisting("price").update(42);
    group.clamp("cap", "price", () => false, 0);
    expect(group.getExisting("cap").getValue()).toBe(42);
  });

  it("fails when the source is not registered", () => {
    expect(() => priceGroup().clamp("nope", 0, 1)).toThrow("Indicator not found: nope");
    expect(() => priceGroup().clamp("c", "nope", () => true, 1)).toThrow("Indicator not found: nope");
  });
});

describe("fun", () => {
  it("combines two indicators through the function", () => {
    // hi = 2p, lo = -p: hi - lo = 3p; hi * lo = -2p^2
    const group = branchGroup();
    expect(growth(group, () => group.fun("spread", "hi", "lo", (a, b) => a - b))).toBe(1);
    expect(group.get("spread")).toBeInstanceOf(BiFunctionRTIndicator);
    expect(series(group, "spread", PRICES)).toEqual([15, 36, 24, 45]);
    group.fun("prod", "hi", "lo", (a, b) => a * b);
    expect(series(group, "prod", [3])).toEqual([-18]);
    expect(metaOf(group, "spread")).toEqual({});
  });

  it("fails when either indicator is not registered", () => {
    expect(() => branchGroup().fun("f", "hi", "nope", (a, b) => a + b)).toThrow("Indicator not found: nope");
    expect(() => branchGroup().fun("f", "nope", "lo", (a, b) => a + b)).toThrow("Indicator not found: nope");
  });
});

describe("decorate", () => {
  it("registers what the operator makes of the read-only view of the source", () => {
    let received: RTIndicator | undefined;
    const group = priceGroup();
    expect(
      growth(group, () =>
        group.decorate("triple", "price", (source) => {
          received = source;
          return TransformRTIndicator.multiply(source, 3);
        }),
      ),
    ).toBe(1);
    expect(received).toBeInstanceOf(ReadOnlyRTIndicator);
    expect(series(group, "triple", PRICES)).toEqual([15, 36, 24, 45]);
  });

  it("does not update the source through the view", () => {
    const group = priceGroup();
    group.decorate("view", "price", (source) => source);
    group.getExisting("view").update(99);
    expect(group.getExisting("price").getValue()).toBe(0);
  });

  it("fails when the source is not registered", () => {
    expect(() => priceGroup().decorate("d", "nope", (source) => source)).toThrow("Indicator not found: nope");
  });
});

describe("gain and loss", () => {
  it("take whether a flat price resets the count as a third argument", () => {
    const group = priceGroup().gain("g", "price", false).loss("l", "price", false).gain("gDefault", "price");
    expect((group.getExisting("g") as GainRTIndicator).resetPeriodsOnSustain).toBe(false);
    expect((group.getExisting("l") as LossRTIndicator).resetPeriodsOnSustain).toBe(false);
    expect((group.getExisting("gDefault") as GainRTIndicator).resetPeriodsOnSustain).toBe(true);
  });
});

describe("add", () => {
  it("registers the sum of two indicators under add + A + B, or under a given name", () => {
    // price + hi = p + 2p = 3p
    const group = branchGroup();
    expect(growth(group, () => group.add("price", "hi"))).toBe(1);
    expect(growth(group, () => group.add("total", "price", "hi"))).toBe(1);
    expect(series(group, "addpricehi", PRICES)).toEqual([15, 36, 24, 45]);
    expect(series(group, "total", [2])).toEqual([6]);
    expect(group.get("addpricehi")).toBeInstanceOf(BiFunctionRTIndicator);
  });

  it("is the sum addIndicators makes", () => {
    // hi + lo = 2p - p = p
    const viaAdd = run((g) => g.add("hi", "lo").add("t", "hi", "lo"), "addhilo", PRICES);
    const viaAddIndicators = run((g) => g.addIndicators("hi", "lo").addIndicators("t", "hi", "lo"), "addhilo", PRICES);
    expect(viaAdd).toEqual(viaAddIndicators);
    expect(viaAdd).toEqual(PRICES);
  });

  it("registers an indicator under a name and sets a display hint on it", () => {
    const group = priceGroup();
    const ema = new EmaRTIndicator(3);
    expect(growth(group, () => group.add("fast", ema, DisplayHint.PERCENT))).toBe(1);
    expect(group.get("fast")).toBe(ema);
    expect(group.getExisting("fast").getDisplayHint!()).toBe(DisplayHint.PERCENT);
    expect(metaOf(group, "fast")).toEqual({ dsp: "P" });
  });

  it("registers an indicator without a hint as before", () => {
    const group = priceGroup();
    const ema = new EmaRTIndicator(3);
    group.add("plain", ema);
    expect(group.get("plain")).toBe(ema);
    expect(ema.getDisplayHint()).toBe(DisplayHint.ABSOLUTE);
  });

  it("keeps a value source name in the second place as the value source", () => {
    const group = priceGroup();
    group.add("vol", "Volume").add("last", TickerValueSource.Close);
    expect(group.get("vol")).toBeInstanceOf(TickerRTIndicator);
    expect(group.getExisting("vol").getDisplayHint!()).toBe(DisplayHint.VOLUME);
    group.indicators.updateFrom(tick(9));
    expect(group.getIndicatorValue("vol")).toBe(5);
    expect(group.getIndicatorValue("last")).toBe(9);
    expect(group.get("addvolVolume")).toBeUndefined();
  });

  it("keeps a kline value source name as the value source on a kline map", () => {
    const group = new InstrumentGroupRTIndicator(new InstrumentMapKlineSourceRTIndicator(INSTRUMENT));
    group.add("vol", "Volume").add("n", KlineValueSource.NumberOfTrades);
    expect(group.get("vol")).toBeInstanceOf(KlineRTIndicator);
    expect(group.getExisting("n").getDisplayHint!()).toBe(DisplayHint.VOLUME);
  });

  it("registers a value source feeding an indicator", () => {
    // the EMA(2) is fed the last price: 10, then 10 + (13 - 10) * 2/3 = 12
    const group = priceGroup().add("emaClose", TickerValueSource.Close, new EmaRTIndicator(2));
    expect(group.get("emaClose")).toBeInstanceOf(TickerRTIndicator);
    expect(series(group, "emaClose", [10, 13])).toEqual([10, 12]);
    expect(group.getExisting("emaClose").getDisplayHint!()).toBe(DisplayHint.ABSOLUTE);
  });

  it("fails on a value source it does not know when given an indicator", () => {
    expect(() => priceGroup().add("x", "bogus", new EmaRTIndicator(2))).toThrow("Unknown value source: bogus");
  });

  it("fails on an indicator that is not registered", () => {
    expect(() => priceGroup().add("nope", "price")).toThrow("Indicator not found: nope");
    expect(() => priceGroup().add("t", "price", "nope")).toThrow("Indicator not found: nope");
  });
});
