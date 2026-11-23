import { describe, expect, it } from "vitest";
import { Instrument, MarketDataSource, VenueType } from "@qtsurfer/core";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { StrategyEventType } from "../src/event/StrategyEventType";
import { SystemSignal } from "../src/event/signal/SystemSignal";
import type { StrategySignal } from "../src/event/signal/StrategySignal";
import { StrategyContext } from "../src/StrategyContext";

/**
 * `detach(...)` is how a strategy asks the platform to detach a market-data source: it emits a
 * `SystemSignal` with the action `DETACH`, about an instrument and, from the attach and detach
 * hooks, naming the attachment by its id.
 */

const INSTRUMENT = "BTC/USDT";

class DetachingStrategy extends AbstractTickerStrategy {
  constructor() {
    super("Detaching");
  }

  askToDetach(target: string | StrategyContext): void {
    this.detach(target);
  }
}

function contextOf(...instruments: Instrument[]) {
  return StrategyContext.builder()
    .id("att-7")
    .venueType(VenueType.CEX)
    .exchange("binance")
    .segment("spot")
    .type(MarketDataSource.Ticker)
    .instruments(instruments)
    .build();
}

function watch(strategy: DetachingStrategy): StrategySignal[] {
  const signals: StrategySignal[] = [];
  strategy.onSignal((signal) => signals.push(signal));
  return signals;
}

describe("detach", () => {
  it("of an instrument emits one SystemSignal about it", () => {
    const strategy = new DetachingStrategy();
    const signals = watch(strategy);

    strategy.askToDetach(INSTRUMENT);

    expect(signals).toHaveLength(1);
    const detach = signals[0] as SystemSignal;
    expect(detach).toBeInstanceOf(SystemSignal);
    expect(detach.type).toBe(StrategyEventType.System);
    expect(detach.instrument).toBe(INSTRUMENT);
    expect(detach.getEventTypeValue()).toBe(SystemSignal.DETACH);
    expect(detach.strategyName).toBe("Detaching");
    expect(detach.getAttachment()).toBeUndefined();
  });

  it("of a context names the attachment and its first instrument", () => {
    const strategy = new DetachingStrategy();
    const signals = watch(strategy);

    strategy.askToDetach(contextOf(Instrument.of("BTC", "USDT")));

    const detach = signals[0] as SystemSignal;
    expect(detach.instrument).toBe(INSTRUMENT);
    expect(detach.getAttachment()).toBe("att-7");
  });

  it("of a context with several instruments is about the first of the list", () => {
    const strategy = new DetachingStrategy();
    const signals = watch(strategy);

    strategy.askToDetach(
      contextOf(Instrument.of("ETH", "USDT"), Instrument.of("SOL", "USDT"), Instrument.of("BTC", "USDT")),
    );

    expect(signals).toHaveLength(1);
    const detach = signals[0] as SystemSignal;
    expect(detach.instrument).toBe("ETH/USDT");
    expect(detach.getAttachment()).toBe("att-7");
  });

  it("of a context with no instrument is about its exchange and segment", () => {
    const strategy = new DetachingStrategy();
    const signals = watch(strategy);

    strategy.askToDetach(contextOf());

    const detach = signals[0] as SystemSignal;
    expect(detach.instrument).toBe(Instrument.of("binance", "spot").symbol());
    expect(detach.getAttachment()).toBe("att-7");
  });

  it("emits nothing while the host is detaching the source, and goes on after", () => {
    const strategy = new DetachingStrategy();
    const signals = watch(strategy);

    strategy.setSourceDetaching(true);
    strategy.askToDetach(INSTRUMENT);
    strategy.askToDetach(contextOf(Instrument.of("BTC", "USDT")));
    expect(signals).toHaveLength(0);

    strategy.setSourceDetaching(false);
    strategy.askToDetach(INSTRUMENT);
    expect(signals).toHaveLength(1);
  });

  it("takes the time of the last market event in a backtest, like any other signal", () => {
    const strategy = new DetachingStrategy();
    strategy.backtestEnabled = true;
    strategy.lastEventTimestamp = 1_700_000_000_000;
    const signals = watch(strategy);

    strategy.askToDetach(INSTRUMENT);

    expect(signals[0]?.timestamp).toBe(1_700_000_000_000);
  });
});
