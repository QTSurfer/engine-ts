import { describe, expect, it } from "vitest";
import type { Kline } from "@qtsurfer/core";
import { AbstractKlineStrategy } from "../../src/AbstractKlineStrategy";
import { OrderKind } from "../../src/event/signal/MarketHintSignal";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";

const MINUTE = 60_000;
const START = 1_700_000_000_000;

const config: BacktestConfig = { initialFunding: 1000, feeRate: 0, currency: "USDT" };

function bar(index: number, close: number, range?: { high: number; low: number }): Kline {
  return {
    instrument: "BTC/USDT",
    open: close,
    high: range?.high ?? close,
    low: range?.low ?? close,
    close,
    volume: 1,
    quoteVolume: close,
    numberOfTrades: 1,
    timestamp: START + index * MINUTE,
  };
}

/** Runs the scripted action for the bar with the given 1-based index. */
class ScriptedKlineStrategy extends AbstractKlineStrategy {
  private seen = 0;

  constructor(
    private readonly script: Record<number, (strategy: ScriptedKlineStrategy, kline: Kline) => void>,
  ) {
    super("ScriptedKline");
  }

  override update(kline: Kline): void {
    super.update(kline);
    this.seen++;
    this.script[this.seen]?.(this, kline);
  }

  send(signal: BuySignal | SellSignal): void {
    this.emitSignal(signal);
  }
}

function strategyWith(
  script: Record<number, (strategy: ScriptedKlineStrategy, kline: Kline) => void>,
): ScriptedKlineStrategy {
  return new ScriptedKlineStrategy(script);
}

describe("BacktestRunner.runKlines", () => {
  it("runs a closed round trip over rising bars through the execution pipeline", () => {
    const strategy = strategyWith({
      1: (s, k) => s.send(new BuySignal("K", k.instrument, k.close)),
      4: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
    });
    const bars = [100, 102, 105, 110, 111].map((close, i) => bar(i, close));

    const result = BacktestRunner.runKlines(strategy, bars, config);

    expect(result.totalTicks).toBe(5);
    expect(result.yields).toHaveLength(1);
    expect(result.yields[0].input).toBeCloseTo(1000, 9);
    expect(result.yields[0].output).toBeCloseTo(1100, 9);
    expect(result.finalBalance).toBeCloseTo(1100, 9);
  });

  it("fills a resting limit order against a later bar's close", () => {
    const strategy = strategyWith({
      1: (s, k) =>
        s.send(new BuySignal("K", k.instrument, 100).setOrderKind(OrderKind.limit)),
      3: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
    });
    // The limit is queued on bar 1 (close 105), first eligible on bar 2, which closes at 99.
    const bars = [105, 99, 110].map((close, i) => bar(i, close));

    const result = BacktestRunner.runKlines(strategy, bars, config);

    expect(result.yields).toHaveLength(1);
    expect(result.yields[0].input).toBeCloseTo(1000, 9);
    expect(result.yields[0].output).toBeCloseTo(1100, 9);
  });

  it("resolves a resting order on the close, not on the bar's low or high", () => {
    const strategy = strategyWith({
      1: (s, k) =>
        s.send(new BuySignal("K", k.instrument, 100).setOrderKind(OrderKind.limit)),
    });
    // Bar 2 trades down to 95 but closes at 101: its low is not known until it closes,
    // so the limit buy at 100 must not fill on it.
    const bars = [bar(0, 105), bar(1, 101, { high: 106, low: 95 }), bar(2, 103)];

    const result = BacktestRunner.runKlines(strategy, bars, config);

    expect(result.yields).toHaveLength(0);
    expect(result.finalBalance).toBeCloseTo(1000, 9);
  });

  it("gives the numbers a ticker replay gives when the bars are flat", () => {
    const closes = [100, 104, 103, 110];
    const klineStrategy = strategyWith({
      1: (s, k) => s.send(new BuySignal("K", k.instrument, k.close)),
      4: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
    });
    const klineResult = BacktestRunner.runKlines(
      klineStrategy,
      closes.map((close, i) => bar(i, close)),
      { ...config, feeRate: 0.001 },
    );

    // Same trade as a pipeline-level round trip: buy@100 all-in, sell@110, 0.1% each side.
    expect(klineResult.yields).toHaveLength(1);
    expect(klineResult.finalBalance).toBeCloseTo(1097.8011, 4);
    expect(klineResult.metrics.winCount).toBe(1);
  });
});
