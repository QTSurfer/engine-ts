import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { StrategyYield } from "../../src/event/yield/StrategyYield";
import { OrderKind } from "../../src/event/signal/MarketHintSignal";
import type { ExecutionResult } from "../../src/execution/ExecutionResult";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import { ExecutionStatus } from "../../src/execution/ExecutionStatus";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";

class TestStrategy extends AbstractTickerStrategy {
  constructor() { super("Test"); }
  protected override setupIndicators(_i: InstrumentGroupRTIndicator): void {}
}

const config: BacktestConfig = {
  initialFunding: 10000,
  feeRate: 0,
  currency: "USDT",
};

function bar(partial: Partial<Ticker>): Ticker {
  return {
    instrument: "BTC/USDT",
    open: null,
    high: null,
    low: null,
    last: null,
    bid: null,
    bidSize: null,
    ask: null,
    askSize: null,
    volume: null,
    quoteVolume: null,
    vwap: null,
    percentageChange: null,
    timestamp: 0,
    ...partial,
  };
}

describe("BacktestExecutionPipeline — trailing stop (Phase 2d)", () => {
  it("trails a long stop-loss up and exits when last punches through", () => {
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield(y) { yields.push(y); },
    });

    // Long 100 units @ 100.
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));

    // Emit trailing stop: 5-point distance from peak, seeded at the signal price 100.
    const trail = new SellSignal("T", "BTC/USDT", 100)
      .setOrderKind(OrderKind.stopTrailing)
      .setTrailDistance(5);
    pipeline.handle(trail);

    // Each former bar is two ticks: the new peak, then the pullback.
    // Ticks 105, 102 → peak 105, stop=100, last 102 > 100, still in.
    pipeline.onTicker(bar({ last: 105 }));
    pipeline.onTicker(bar({ last: 102 }));
    expect(sells).toHaveLength(0);

    // Ticks 110, 106 → peak 110, stop=105, last 106 > 105, still in.
    pipeline.onTicker(bar({ last: 110 }));
    pipeline.onTicker(bar({ last: 106 }));
    expect(sells).toHaveLength(0);

    // Ticks 112, 104 → peak ratchets to 112 → stop=107. Last 104 <= 107 → trigger at 107.
    pipeline.onTicker(bar({ last: 112 }));
    expect(sells).toHaveLength(0);
    pipeline.onTicker(bar({ last: 104 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(107);
    // 100 base * 107 = 10700; invested 10000 → yield 700.
    expect(yields[0].output).toBeCloseTo(10700, 6);
    expect(yields[0].getYield()).toBeCloseTo(700, 6);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("never triggers on a monotonic up-move", () => {
    const sells: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield() {},
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailDistance(3),
    );

    // Each former bar is two ticks (new peak, then a shallow pullback): last
    // always stays above the stop, and a new peak never fires.
    pipeline.onTicker(bar({ last: 105 }));
    pipeline.onTicker(bar({ last: 103 }));
    pipeline.onTicker(bar({ last: 110 }));
    pipeline.onTicker(bar({ last: 108 }));
    pipeline.onTicker(bar({ last: 120 }));
    pipeline.onTicker(bar({ last: 118 }));
    expect(sells).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("fires on the first tick when the move is already against you", () => {
    const sells: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield() {},
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailDistance(2),
    );

    // First tick: peak = 100 (the signal price), stop = 98, last = 97 → trigger at 98.
    pipeline.onTicker(bar({ last: 97 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(98);
  });

  it("drops a stopTrailing signal with neither a trail distance nor a trail percent", () => {
    const sells: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield() {},
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    const malformed = new SellSignal("T", "BTC/USDT", 100)
      .setOrderKind(OrderKind.stopTrailing);
    pipeline.handle(malformed);

    pipeline.onTicker(bar({ last: 85 }));
    pipeline.onTicker(bar({ last: 80 }));
    expect(sells).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("applies slippage on trailing-stop fills", () => {
    const sells: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, slippageBps: 100 }, // 1% adverse
      {
        onFilledBuy() {},
        onFilledSell(r) { sells.push(r); },
        onYield() {},
      },
    );

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailDistance(2),
    );

    // Stop level = 98; fill triggers at 98, sell slippage lowers by 1% → 97.02.
    pipeline.onTicker(bar({ last: 97 }));
    expect(sells[0].price).toBeCloseTo(97.02, 6);
  });

  it("supports buy-side trailing (ratchets down, fires on rebound)", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    // Buy trail: wait for price to bottom out then rebound by 3.
    const trail = new BuySignal("T", "BTC/USDT", 100)
      .setOrderKind(OrderKind.stopTrailing)
      .setTrailDistance(3);
    pipeline.handle(trail);

    // Price drops — trough ratchets down to 95, stop = 98, last 95 < 98 → no fire.
    pipeline.onTicker(bar({ last: 95 }));
    expect(buys).toHaveLength(0);

    // Rebound to 98: 98 >= stop (98) → triggers, fills at 98.
    pipeline.onTicker(bar({ last: 98 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(98);
  });

  it("lets the buy trail ratchet through several down moves before firing", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailDistance(3),
    );

    // Each former bar is two ticks: the new trough, then the rebound.
    // Ticks 98, 99 → trough=98, stop=101, last 99 < 101 → no fire.
    pipeline.onTicker(bar({ last: 98 }));
    pipeline.onTicker(bar({ last: 99 }));
    expect(buys).toHaveLength(0);

    // Ticks 90, 92 → trough ratchets to 90, stop=93, last 92 < 93 → no fire.
    pipeline.onTicker(bar({ last: 90 }));
    pipeline.onTicker(bar({ last: 92 }));
    expect(buys).toHaveLength(0);

    // Ticks 91, 95 → trough stays 90 (91 > 90), stop=93, last 95 >= 93 → fires at 93.
    pipeline.onTicker(bar({ last: 91 }));
    expect(buys).toHaveLength(0);
    pipeline.onTicker(bar({ last: 95 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(93);
  });
});

describe("BacktestExecutionPipeline — trailing stop by percent of the extreme", () => {
  function setup() {
    const sells: ExecutionResult[] = [];
    const buys: ExecutionResult[] = [];
    const pipeline = new BacktestExecutionPipeline(new TestStrategy(), config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell(r) { sells.push(r); },
      onYield() {},
    });
    return { pipeline, sells, buys };
  }

  it("seeds the extreme with the signal price and fills AT the trigger level", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailPercent(5),
    );

    // Extreme stays at the seed 100 → level 95; last 96 does not fire.
    pipeline.onTicker(bar({ last: 96 }));
    expect(sells).toHaveLength(0);

    // Last gaps to 90, below the level → fills at 95, not at 90.
    pipeline.onTicker(bar({ last: 90 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBeCloseTo(95, 9);
  });

  it("mirrors for a buy trail: tracks the trough, fires on a rise of the percent", () => {
    const { pipeline, buys } = setup();
    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailPercent(5),
    );

    // Trough 90 → level 94.5; last 94 < 94.5 does not fire.
    pipeline.onTicker(bar({ last: 90 }));
    pipeline.onTicker(bar({ last: 94 }));
    expect(buys).toHaveLength(0);

    // Last 95 >= 94.5 → fills at 94.5.
    pipeline.onTicker(bar({ last: 95 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBeCloseTo(94.5, 9);
  });

  it("prefers the percent over the absolute distance when both are set", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailPercent(10)
        .setTrailDistance(1),
    );

    // Distance alone would fire at 99; the 10% level is 90.
    pipeline.onTicker(bar({ last: 95 }));
    expect(sells).toHaveLength(0);
  });

  it("does not advance the extreme on a tick without a last", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailPercent(5),
    );

    // A high of 200 must not lift the extreme: level stays 95.
    pipeline.onTicker(bar({ last: null, high: 200, low: 50 }));
    pipeline.onTicker(bar({ last: 94 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBeCloseTo(95, 9);
  });
});
