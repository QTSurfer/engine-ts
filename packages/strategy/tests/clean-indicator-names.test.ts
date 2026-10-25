import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { DisplayHint, ValueRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { InfoStrategySignal } from "../src/event/signal/InfoStrategySignal";
import type { StrategySignal } from "../src/event/signal/StrategySignal";
import { makeTicker } from "./helpers/tickers";

const INSTRUMENT = "BTC/USDT";

class TickerStrategy extends AbstractTickerStrategy {
  constructor() {
    super("TickerStrategy");
  }
}

function publicNames(strategy: TickerStrategy): string[] {
  const names: string[] = [];
  strategy.getInstrumentIndicatorGroup(INSTRUMENT).indicators.forEachPublicable((name) => names.push(name));
  return names;
}

describe("the default indicators of a ticker strategy", () => {
  it("registers the same names as the Java engine, none with a display suffix", () => {
    const strategy = new TickerStrategy();
    expect(publicNames(strategy)).toEqual(["price", "chg", "vwap", "volAsk", "volBid"]);
  });

  it("no longer registers chg%", () => {
    const strategy = new TickerStrategy();
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    expect(group.get("chg")).toBeDefined();
    expect(group.get("chg%")).toBeUndefined();
    expect(() => group.getIndicatorValue("chg%")).toThrow("Indicator not found: chg%");
  });

  it("feeds each one from the field its name says", () => {
    const strategy = new TickerStrategy();
    strategy.update({
      ...makeTicker(100, 1000),
      vwap: 99,
      askSize: 7,
      bidSize: 3,
      percentageChange: 2.5,
    });
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    expect(group.getIndicatorValue("price")).toBe(100);
    expect(group.getIndicatorValue("chg")).toBe(2.5);
    expect(group.getIndicatorValue("vwap")).toBe(99);
    expect(group.getIndicatorValue("volAsk")).toBe(7);
    expect(group.getIndicatorValue("volBid")).toBe(3);
  });

  it("reports the id of each one from its class, in the built package too", () => {
    // The strategy loads the built indicators: a bundle that renamed a class would show here
    const group = new TickerStrategy().getInstrumentIndicatorGroup(INSTRUMENT);
    group.rsi(2);
    expect(group.getExisting("price").getId?.()).toBe("value");
    expect(group.getExisting("chg").getId?.()).toBe("ticker");
    expect(group.getExisting("rsi2").getId?.()).toBe("rsi");
  });

  it("describes the percent change as a percentage and the sizes as volume", () => {
    const group = new TickerStrategy().getInstrumentIndicatorGroup(INSTRUMENT);
    const hint = (name: string) => group.getExisting(name).getDisplayHint?.();
    expect(hint("chg")).toBe(DisplayHint.PERCENT);
    expect(hint("volAsk")).toBe(DisplayHint.VOLUME);
    expect(hint("volBid")).toBe(DisplayHint.VOLUME);
    expect(hint("price")).toBe(DisplayHint.ABSOLUTE);
    expect(hint("vwap")).toBe(DisplayHint.ABSOLUTE);
  });
});

describe("the info signal", () => {
  function infoOf(strategy: TickerStrategy, ticker: Ticker): InfoStrategySignal {
    const signals: StrategySignal[] = [];
    strategy.onSignal((signal) => signals.push(signal));
    strategy.update(ticker);
    expect(signals).toHaveLength(1);
    return signals[0] as InfoStrategySignal;
  }

  it("carries the public indicators under their clean names", () => {
    const strategy = new TickerStrategy();
    strategy.enableIndicatorsSignals = true;
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    group.rsi(2).percentChange("price");

    const info = infoOf(strategy, makeTicker(100, 1000));

    expect([...info.properties.keys()].sort()).toEqual(
      ["chg", "chgprice", "price", "rsi2", "volAsk", "volBid", "vwap"].sort(),
    );
  });

  it("leaves out the internal indicators, which are still updated", () => {
    const strategy = new TickerStrategy();
    strategy.enableIndicatorsSignals = true;
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    group.gain("price");

    const info = infoOf(strategy, makeTicker(100, 1000));
    infoOf(strategy, makeTicker(105, 2000));

    expect(info.properties.has("_gainprice")).toBe(false);
    expect(group.getIndicatorValue("_gainprice")).toBe(5);
  });

  it("leaves out an indicator marked hidden by its metadata", () => {
    const strategy = new TickerStrategy();
    strategy.enableIndicatorsSignals = true;
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    const internal = new ValueRTIndicator().hide();
    group.add("internal", internal);

    const info = infoOf(strategy, makeTicker(100, 1000));

    expect(info.properties.has("internal")).toBe(false);
    expect(info.properties.has("price")).toBe(true);
    expect(internal.getValue()).toBe(100);
  });
});

// A script reaches an indicator by the name it registered it under (rsi14, not rsi14%): these pin that, and that
// a window and a distance can be attached to those names.
/** 20-second ticks: a one-minute window closes every third tick. */
function driveEvery20s(strategy: TickerStrategy, prices: number[]) {
  strategy.backtestEnabled = true;
  const start = 1_700_000_000_000;
  prices.forEach((price, i) => strategy.update(makeTicker(price, start + i * 20_000)));
}

const PRICES = [100, 102, 101, 105, 104, 108, 107, 103, 99, 101, 106, 110, 108, 104, 100];

describe("indicators registered under clean names", () => {
  function windowed(onFire: (values: { actual: number; distance: number }) => void): TickerStrategy {
    const strategy = new TickerStrategy();
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    group
      .ema("ema12", 12)
      .rsi("rsi14", 14, true)
      .distance("d", "ema12", "rsi14")
      .window("rsi14", "m1", (_store, _prev, actual) => onFire({ actual, distance: group.getIndicatorValue("d") }));
    return strategy;
  }

  it("registers rsi14 and the distance from ema12 to rsi14 under those names", () => {
    const strategy = windowed(() => undefined);
    driveEvery20s(strategy, PRICES);
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);

    expect(group.get("rsi14")).toBeDefined();
    expect(group.get("rsi14%")).toBeUndefined();
    expect(group.getExisting("rsi14").getDisplayHint?.()).toBe(DisplayHint.PERCENT);
    expect(group.getExisting("d").getDisplayHint?.()).toBe(DisplayHint.PERCENT);
    const ema = group.getIndicatorValue("ema12");
    const rsi = group.getIndicatorValue("rsi14");
    expect(group.getIndicatorValue("d")).toBeCloseTo((100 * (ema - rsi)) / rsi, 9);
  });

  it("fires the one-minute window on rsi14 and reads the distance", () => {
    const fired: Array<{ actual: number; distance: number }> = [];
    driveEvery20s(windowed((values) => fired.push(values)), PRICES);

    expect(fired.length).toBeGreaterThan(0);
    expect(fired.every(({ actual, distance }) => Number.isFinite(actual) && Number.isFinite(distance))).toBe(true);
  });

  it("fails to find the old chg% name, as a stored definition that still uses it should", () => {
    const strategy = new TickerStrategy();
    strategy.update(makeTicker(100, 1000));
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);

    expect(() => group.getIndicatorValue("chg%")).toThrow("Indicator not found: chg%");
  });

  it("a window on the old name rsi14% fails with the indicator-not-found error", () => {
    const group = new TickerStrategy().getInstrumentIndicatorGroup(INSTRUMENT);
    group.rsi("rsi14", 14, true);

    expect(() => group.window("rsi14%", "m1", () => undefined)).toThrow("Indicator not found: rsi14%");
  });
});
