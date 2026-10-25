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
  constructor() {
    super("Test");
  }
  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}
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

describe("BacktestExecutionPipeline — limit orders (Phase 2c)", () => {
  it("fills a buy limit when the next tick's last reaches the limit", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    const limit = new BuySignal("T", "BTC/USDT", 95).setOrderKind(OrderKind.limit);
    pipeline.handle(limit);

    // Last still above the limit — stays pending.
    pipeline.onTicker(bar({ last: 96 }));
    expect(buys).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);

    // Last drops through the limit → fills at 95 exactly, no slippage.
    pipeline.onTicker(bar({ last: 93 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(95);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("fills a sell limit (take-profit) when the next tick's last rallies through it", () => {
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield(y) { yields.push(y); },
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    const tp = new SellSignal("T", "BTC/USDT", 120).setOrderKind(OrderKind.limit);
    pipeline.handle(tp);

    // Last below the limit — stays pending.
    pipeline.onTicker(bar({ last: 115 }));
    expect(sells).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);

    // Last rips through 120 → fills AT 120, not at the tick's 125.
    pipeline.onTicker(bar({ last: 125 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(120);
    expect(yields[0].output).toBeCloseTo(12000, 6);
  });

  it("slips limit fills too, as the Java engine does", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, slippageBps: 100 }, // 1% adverse
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    const limit = new BuySignal("T", "BTC/USDT", 95).setOrderKind(OrderKind.limit);
    pipeline.handle(limit);
    pipeline.onTicker(bar({ last: 93 }));

    // The limit resolves at 95 and the 1% adverse slippage still applies: 95 * 1.01
    expect(buys[0].price).toBeCloseTo(95.95, 9);
  });
});

describe("BacktestExecutionPipeline — stop orders (Phase 2c)", () => {
  it("fills a buy stop (breakout) when the tick's last crosses above", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    const stop = new BuySignal("T", "BTC/USDT", 105).setOrderKind(OrderKind.stop);
    pipeline.handle(stop);

    // Last stays at 104 — below the stop, no fill.
    pipeline.onTicker(bar({ last: 104 }));
    expect(buys).toHaveLength(0);

    // Last punches through 105 → fills at 105.
    pipeline.onTicker(bar({ last: 108 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(105);
  });

  it("triggers a stop order on signal.price, whatever stopPrice it carries", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    const stop = new BuySignal("T", "BTC/USDT", 110)
      .setOrderKind(OrderKind.stop)
      .setStopPrice(108);
    pipeline.handle(stop);

    // The trigger is signal.price (110), as in the Java engine: 109 does not fire it.
    pipeline.onTicker(bar({ last: 109 }));
    expect(buys).toHaveLength(0);

    pipeline.onTicker(bar({ last: 110 }));
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(110);
  });

  it("fills a sell stop-loss when the tick's last dips below", () => {
    const yields: StrategyYield[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onYield(y) { yields.push(y); },
    });

    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    const sl = new SellSignal("T", "BTC/USDT", 90).setOrderKind(OrderKind.stop);
    pipeline.handle(sl);

    pipeline.onTicker(bar({ last: 95 }));
    expect(yields).toHaveLength(0);

    pipeline.onTicker(bar({ last: 88 }));
    expect(yields).toHaveLength(1);
    // sold 100 base @ 90 → 9000; invested 10000 → yield -1000
    expect(yields[0].output).toBeCloseTo(9000, 6);
    expect(yields[0].getYield()).toBeCloseTo(-1000, 6);
  });

  it("applies slippage on stop fills (stops become market after trigger)", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(
      strategy,
      { ...config, slippageBps: 50 }, // 0.5% adverse
      {
        onFilledBuy(r) { buys.push(r); },
        onFilledSell() {},
        onYield() {},
      },
    );

    const stop = new BuySignal("T", "BTC/USDT", 100).setOrderKind(OrderKind.stop);
    pipeline.handle(stop);
    pipeline.onTicker(bar({ last: 103 }));

    // Triggered at 100, slippage +0.5% → effective 100.5
    expect(buys[0].price).toBeCloseTo(100.5, 6);
  });
});

describe("BacktestExecutionPipeline — order routing edge cases", () => {
  it("drops stopTrailing silently", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    const trailing = new BuySignal("T", "BTC/USDT", 100)
      .setOrderKind(OrderKind.stopTrailing);
    pipeline.handle(trailing);

    pipeline.onTicker(bar({ last: 110 }));
    pipeline.onTicker(bar({ last: 99 }));
    expect(buys).toHaveLength(0);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("keeps a limit pending when the tick has no last, whatever its low/high", () => {
    const buys: ExecutionResult[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) { buys.push(r); },
      onFilledSell() {},
      onYield() {},
    });

    const limit = new BuySignal("T", "BTC/USDT", 95).setOrderKind(OrderKind.limit);
    pipeline.handle(limit);

    // No last → can't evaluate the trigger, even though low/high cross it.
    pipeline.onTicker(bar({ last: null, low: 90, high: 100 }));
    expect(buys).toHaveLength(0);

    // Tick with last=90 → fills.
    pipeline.onTicker(bar({ last: 90 }));
    expect(buys).toHaveLength(1);
  });

  it("processes a queued limit buy followed by a queued limit sell in order", () => {
    const yields: StrategyYield[] = [];
    const strategy = new TestStrategy();
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onYield(y) { yields.push(y); },
    });

    // One last price can only satisfy both limits when they coincide.
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100).setOrderKind(OrderKind.limit));
    pipeline.handle(new SellSignal("T", "BTC/USDT", 100).setOrderKind(OrderKind.limit));

    // Single tick that reaches both sides — buy fills first (FIFO),
    // then sell sees a position to close.
    pipeline.onTicker(bar({ last: 100 }));
    expect(yields).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });
});

describe("BacktestExecutionPipeline — stop-loss attached to a filled buy", () => {
  function setup() {
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(new TestStrategy(), config, {
      onFilledBuy() {},
      onFilledSell(r) { sells.push(r); },
      onYield(y) { yields.push(y); },
    });
    return { pipeline, sells, yields };
  }

  it("places a stop sell that fires from the next tick and sells the whole position", () => {
    const { pipeline, sells, yields } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100).setStopPrice(90));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);

    pipeline.onTicker(bar({ last: 95 }));
    expect(sells).toHaveLength(0);

    pipeline.onTicker(bar({ last: 85 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(90);
    expect(sells[0].baseAmount).toBeCloseTo(100, 9);
    expect(yields[0].getYield()).toBeCloseTo(-1000, 6);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("places it only once a limit entry fills, and not on the fill tick", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 95)
        .setOrderKind(OrderKind.limit)
        .setStopPrice(94),
    );

    // Limit fills (93 <= 95); the stop at 94 would already be hit by 93, but
    // it was enqueued by this very fill, so it is first eligible next tick.
    pipeline.onTicker(bar({ last: 93 }));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(sells).toHaveLength(0);

    pipeline.onTicker(bar({ last: 93 }));
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(94);
  });

  it("is cancelled when the position is closed another way", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100).setStopPrice(90));
    pipeline.handle(new SellSignal("T", "BTC/USDT", 110));
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(sells).toHaveLength(1);

    // A new entry without a stop must not inherit the old one.
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.onTicker(bar({ last: 80 }));
    expect(sells).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("is cancelled by a sell, which closes the whole position whatever its sellPercent", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100).setStopPrice(90));
    // As the Java engine's long pipeline: a sell closes the position and cancels its stop
    pipeline.handle(new SellSignal("T", "BTC/USDT", 110).setSellPercent(50));
    expect(sells).toHaveLength(1);
    expect(sells[0].baseAmount).toBeCloseTo(100, 9);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);

    pipeline.onTicker(bar({ last: 80 }));
    expect(sells).toHaveLength(1);
  });

  it("is cancelled when another queued order closes the position on the same tick", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    // The trailing sell comes first in the queue, the stop after it; only the
    // trailing sell fires (94 <= 95) — the stop at 80 does not.
    pipeline.handle(
      new SellSignal("T", "BTC/USDT", 100)
        .setOrderKind(OrderKind.stopTrailing)
        .setTrailPercent(5),
    );
    pipeline.handle(new SellSignal("T", "BTC/USDT", 80).setOrderKind(OrderKind.stop));
    pipeline.onTicker(bar({ last: 94 }));
    expect(sells).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);

    // The unfired stop must not survive to hit the next position.
    pipeline.handle(new BuySignal("T", "BTC/USDT", 100));
    pipeline.onTicker(bar({ last: 70 }));
    expect(sells).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
  });

  it("is also placed for a stop-order entry that carries a stop price", () => {
    const { pipeline, sells } = setup();
    pipeline.handle(
      new BuySignal("T", "BTC/USDT", 110)
        .setOrderKind(OrderKind.stop)
        .setStopPrice(108),
    );
    pipeline.onTicker(bar({ last: 111 })); // breakout fires at 110
    expect(pipeline.getStatus()).toBe(ExecutionStatus.EXECUTING);
    expect(sells).toHaveLength(0);

    pipeline.onTicker(bar({ last: 107 })); // the protective stop at 108 fires
    expect(sells).toHaveLength(1);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });
});
