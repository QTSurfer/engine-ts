import { describe, it, expect } from "vitest";
import { Instrument } from "@qtsurfer/core";
import type { Ticker } from "@qtsurfer/core";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { AbstractKlineStrategy } from "../src/AbstractKlineStrategy";
import { ExecutionMode } from "../src/execution/ExecutionMode";
import { StrategyCurrencyFilter } from "../src/StrategyCurrencyFilter";
import type { StrategySignal } from "../src/event/signal/StrategySignal";

class HookStrategy extends AbstractTickerStrategy {
  constructor() {
    super("HookStrategy");
  }

  multiplier(): number {
    return this.getMinPercentGainMultiplier();
  }
}

/** What a compiled `init { ... }` block does: set the hooks from the constructor. */
class ConfiguredInConstructor extends AbstractTickerStrategy {
  constructor() {
    super("ConfiguredInConstructor");
    this.setPercentGain(0.5);
    this.setMinGain(2);
    this.setMultiEntryEnabled(true);
    this.setEnableIndicatorsSignals(true);
    this.setBlacklistedCurrencies(["DOGE"]);
  }

  multiplier(): number {
    return this.getMinPercentGainMultiplier();
  }
}

class KlineHooks extends AbstractKlineStrategy {
  constructor() {
    super("KlineHooks");
  }
}

function ticker(instrument: string, last: number, timestamp = 1): Ticker {
  return {
    instrument,
    open: last,
    high: last,
    low: last,
    last,
    bid: last,
    bidSize: 1,
    ask: last,
    askSize: 1,
    volume: 1,
    quoteVolume: last,
    vwap: last,
    percentageChange: 0,
    timestamp,
  };
}

describe("setPercentGain", () => {
  it("starts at zero with a zero multiplier", () => {
    const strategy = new HookStrategy();
    expect(strategy.getPercentGain()).toBe(0);
    expect(strategy.multiplier()).toBe(0);
  });

  it("stores the percent and the multiplier a strategy reads", () => {
    const strategy = new HookStrategy();
    strategy.setPercentGain(0.5);
    expect(strategy.getPercentGain()).toBe(0.5);
    expect(strategy.multiplier()).toBe(0.005);
  });

  it("shifts the decimal point, so no float division error creeps in", () => {
    const strategy = new HookStrategy();
    for (const [percent, multiplier] of [
      [0.7, 0.007],
      [1.25, 0.0125],
      [33.3, 0.333],
      [100, 1],
      [0, 0],
      [0.0000001, 0.000000001],
    ] as const) {
      strategy.setPercentGain(percent);
      expect(strategy.multiplier()).toBe(multiplier);
    }
  });

  it("accepts both ends of the 0-100 range", () => {
    const strategy = new HookStrategy();
    strategy.setPercentGain(0);
    strategy.setPercentGain(100);
    expect(strategy.getPercentGain()).toBe(100);
  });

  it.each([-0.001, 100.001, NaN, Infinity, -Infinity])("rejects %s and keeps the last good value", (bad) => {
    const strategy = new HookStrategy();
    strategy.setPercentGain(2);
    expect(() => strategy.setPercentGain(bad)).toThrow(/percentGain/);
    expect(strategy.getPercentGain()).toBe(2);
    expect(strategy.multiplier()).toBe(0.02);
  });
});

describe("setMinGain", () => {
  it("starts at zero and stores what it is given", () => {
    const strategy = new HookStrategy();
    expect(strategy.getMinGain()).toBe(0);
    strategy.setMinGain(2.5);
    expect(strategy.getMinGain()).toBe(2.5);
    strategy.setMinGain(0);
    expect(strategy.getMinGain()).toBe(0);
  });

  it.each([-1, -0.0001, NaN, -Infinity])("rejects %s and keeps the last good value", (bad) => {
    const strategy = new HookStrategy();
    strategy.setMinGain(3);
    expect(() => strategy.setMinGain(bad)).toThrow(/minGain/);
    expect(strategy.getMinGain()).toBe(3);
  });

  it("does not move percentGain", () => {
    const strategy = new HookStrategy();
    strategy.setPercentGain(1);
    strategy.setMinGain(5);
    expect(strategy.getPercentGain()).toBe(1);
  });
});

describe("execution mode", () => {
  it("is LONG until set", () => {
    expect(new HookStrategy().getExecutionMode("BTC/USDT")).toBe(ExecutionMode.LONG);
  });

  it("setExecutionMode is what getExecutionMode returns, for any instrument", () => {
    const strategy = new HookStrategy();
    strategy.setExecutionMode(ExecutionMode.SHORT);
    expect(strategy.getExecutionMode("BTC/USDT")).toBe(ExecutionMode.SHORT);
    expect(strategy.getExecutionMode("ETH/USDT")).toBe(ExecutionMode.SHORT);
  });

  it("rejects a null mode", () => {
    expect(() => new HookStrategy().setExecutionMode(null as unknown as ExecutionMode)).toThrow(
      TypeError,
    );
  });

  it("setMultiEntryEnabled maps true to LONG_MULTI and false to LONG", () => {
    const strategy = new HookStrategy();
    strategy.setMultiEntryEnabled(true);
    expect(strategy.getExecutionMode("BTC/USDT")).toBe(ExecutionMode.LONG_MULTI);
    strategy.setMultiEntryEnabled(false);
    expect(strategy.getExecutionMode("BTC/USDT")).toBe(ExecutionMode.LONG);
  });

  it("setMultiEntryEnabled(false) also takes a SHORT strategy back to LONG, as Java does", () => {
    const strategy = new HookStrategy();
    strategy.setExecutionMode(ExecutionMode.SHORT);
    strategy.setMultiEntryEnabled(false);
    expect(strategy.getExecutionMode("BTC/USDT")).toBe(ExecutionMode.LONG);
  });

  it("goes through setExecutionMode, so an override sees it", () => {
    const seen: ExecutionMode[] = [];
    class Spy extends HookStrategy {
      override setExecutionMode(mode: ExecutionMode): void {
        seen.push(mode);
        super.setExecutionMode(mode);
      }
    }
    new Spy().setMultiEntryEnabled(true);
    expect(seen).toEqual([ExecutionMode.LONG_MULTI]);
  });
});

describe("currency filter hooks", () => {
  it("every strategy starts with a filter that lets everything through", () => {
    const strategy = new HookStrategy();
    expect(strategy.getCurrencyFilter()).toBeInstanceOf(StrategyCurrencyFilter);
    expect(strategy.getCurrencyFilter().getWhitelistedCurrencies()).toBeUndefined();
    expect(strategy.getCurrencyFilter().getBlacklistedCurrencies()).toBeUndefined();
  });

  it("setWhitelistedCurrencies and setBlacklistedCurrencies feed the strategy's own filter", () => {
    const strategy = new HookStrategy();
    strategy.setWhitelistedCurrencies(["btc", "eth"]);
    strategy.setBlacklistedCurrencies(["eth"]);
    const filter = strategy.getCurrencyFilter();
    expect([...(filter.getWhitelistedCurrencies() ?? [])]).toEqual(["BTC", "ETH"]);
    expect([...(filter.getBlacklistedCurrencies() ?? [])]).toEqual(["ETH"]);
  });

  it("setCurrencyFilter swaps the filter in, and rejects null", () => {
    const strategy = new HookStrategy();
    const filter = new StrategyCurrencyFilter();
    filter.setWhitelistedCurrencies(["SOL"]);
    strategy.setCurrencyFilter(filter);
    expect(strategy.getCurrencyFilter()).toBe(filter);
    expect(strategy.acceptInstrument(Instrument.of("SOL", "USDT"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.of("BTC", "USDT"))).toBe(false);
    expect(() => strategy.setCurrencyFilter(null as unknown as StrategyCurrencyFilter)).toThrow(
      TypeError,
    );
    expect(strategy.getCurrencyFilter()).toBe(filter);
  });
});

describe("setEnableIndicatorsSignals", () => {
  it("is off until set, and the public field still reads the same value", () => {
    const strategy = new HookStrategy();
    expect(strategy.isEnableIndicatorsSignals()).toBe(false);
    expect(strategy.enableIndicatorsSignals).toBe(false);
    strategy.setEnableIndicatorsSignals(true);
    expect(strategy.isEnableIndicatorsSignals()).toBe(true);
    expect(strategy.enableIndicatorsSignals).toBe(true);
  });

  it("makes update() emit an info signal per tick, and stops again when cleared", () => {
    const strategy = new HookStrategy();
    const signals: StrategySignal[] = [];
    strategy.onSignal((signal) => signals.push(signal));

    strategy.update(ticker("BTC/USDT", 100, 1));
    expect(signals).toHaveLength(0);

    strategy.setEnableIndicatorsSignals(true);
    strategy.update(ticker("BTC/USDT", 101, 2));
    expect(signals).toHaveLength(1);

    strategy.setEnableIndicatorsSignals(false);
    strategy.update(ticker("BTC/USDT", 102, 3));
    expect(signals).toHaveLength(1);
  });

  it("is on the kline strategy too", () => {
    const strategy = new KlineHooks();
    strategy.setEnableIndicatorsSignals(true);
    expect(strategy.isEnableIndicatorsSignals()).toBe(true);
  });
});

describe("hooks called from a constructor, as a compiled init block does", () => {
  it("leave the strategy configured before it sees any data", () => {
    const strategy = new ConfiguredInConstructor();
    expect(strategy.getPercentGain()).toBe(0.5);
    expect(strategy.multiplier()).toBe(0.005);
    expect(strategy.getMinGain()).toBe(2);
    expect(strategy.getExecutionMode("BTC/USDT")).toBe(ExecutionMode.LONG_MULTI);
    expect(strategy.isEnableIndicatorsSignals()).toBe(true);
    expect([...(strategy.getCurrencyFilter().getBlacklistedCurrencies() ?? [])]).toEqual(["DOGE"]);
  });

  it("keep per-instance state apart", () => {
    const a = new ConfiguredInConstructor();
    const b = new ConfiguredInConstructor();
    a.setPercentGain(9);
    a.setBlacklistedCurrencies([]);
    expect(b.getPercentGain()).toBe(0.5);
    expect([...(b.getCurrencyFilter().getBlacklistedCurrencies() ?? [])]).toEqual(["DOGE"]);
  });
});
