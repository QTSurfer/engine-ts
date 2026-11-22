import { describe, expect, it } from "vitest";
import { Instrument, MarketDataSource, VenueType } from "@qtsurfer/core";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import type { Strategy } from "../src/Strategy";
import { StrategyContext } from "../src/StrategyContext";
import type { StrategySignal } from "../src/event/signal/StrategySignal";
import type { StrategyYield } from "../src/event/yield/StrategyYield";

/**
 * The attach and detach hooks are additive: a strategy that does not override them is unaffected,
 * and the defaults accept whatever context a host builds.
 */

class BareStrategy extends AbstractTickerStrategy {
  constructor() {
    super("BareStrategy");
  }
}

function context() {
  return StrategyContext.builder()
    .id("att-1")
    .venueType(VenueType.CEX)
    .exchange("binance")
    .segment("spot")
    .type(MarketDataSource.Ticker);
}

describe("onAttach and onDetach defaults", () => {
  it("do nothing for any context", () => {
    const strategy = new BareStrategy();
    const signals: StrategySignal[] = [];
    const yields: StrategyYield[] = [];
    strategy.onSignal((signal) => signals.push(signal));
    strategy.onYield((event) => yields.push(event));

    const attach = context().instruments([Instrument.of("BTC", "USDT")]).warmingUp(true).build();
    expect(() => strategy.onAttach(attach)).not.toThrow();
    expect(() => strategy.onDetach(attach.detached(StrategyContext.REASON_FUNDS))).not.toThrow();
    expect(() => strategy.onDetach(attach.detached(null))).not.toThrow();
    expect(() => strategy.onDetach(context().build())).not.toThrow();

    expect(signals).toEqual([]);
    expect(yields).toEqual([]);
    expect(strategy.instruments.size).toBe(0);
  });

  it("are on the interface, so any strategy has them", () => {
    const strategy: Strategy = new BareStrategy();

    expect(() => strategy.onAttach(context().build())).not.toThrow();
    expect(() => strategy.onDetach(context().build())).not.toThrow();
  });

  it("reject a missing context", () => {
    const strategy: Strategy = new BareStrategy();

    expect(() => strategy.onAttach(null as unknown as StrategyContext)).toThrow(TypeError);
    expect(() => strategy.onDetach(undefined as unknown as StrategyContext)).toThrow(TypeError);
  });
});
