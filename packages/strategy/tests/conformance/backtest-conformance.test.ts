import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractKlineStrategy } from "../../src/AbstractKlineStrategy";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import { OrderKind } from "../../src/event/signal/MarketHintSignal";
import type { MarketHintSignal } from "../../src/event/signal/MarketHintSignal";
import { DefaultStrategyYield } from "../../src/event/yield/DefaultStrategyYield";
import type { StrategyYield } from "../../src/event/yield/StrategyYield";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import type { ExecutionResult } from "../../src/execution/ExecutionResult";
import { FeeLeg } from "../../src/execution/FeeLeg";
import {
  FixedFeeModel,
  MakerTakerFeeModel,
} from "../../src/execution/simulation/FeeModel";
import type {
  FeeContext,
  FeeModel,
} from "../../src/execution/simulation/FeeModel";
import { YieldMetrics } from "../../src/execution/YieldMetrics";

/**
 * Backtest conformance harness. Loads the shared canonical fixtures (see
 * fixtures/README.md) and pins the canonical simulation contract: both-side
 * fees routed by fee leg (RECEIVED: buy in BASE, sell in QUOTE; QUOTE: both in
 * QUOTE with the buy fee reserved at sizing), all-in sizing, canonical metric
 * semantics, and the equity curve in the metrics snapshot.
 */

function loadFixture(name: string): any {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8"),
  );
}

/** Relative-tolerance assertion per the fixtures' `tolerances` convention. */
function expectClose(actual: number, expected: number, relTol: number): void {
  const tol = Math.max(1e-12, Math.abs(expected) * relTol);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
}

class ConformanceStrategy extends AbstractTickerStrategy {
  constructor() {
    super("Conformance");
  }
  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}
}

describe("backtest conformance — pipeline tier (pipeline-long-roundtrip-fees)", () => {
  const fixture = loadFixture("pipeline-long-roundtrip-fees.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function runPipelineFixture() {
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      currency: fixture.config.currency,
    };
    const strategy = new ConformanceStrategy();
    const metrics = new YieldMetrics(strategy, config.initialFunding);
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) {
        buys.push(r);
      },
      onFilledSell(r) {
        sells.push(r);
      },
      onYield(y) {
        yields.push(y);
        metrics.addYield(y);
      },
    });

    for (const s of fixture.signals) {
      const signal: MarketHintSignal =
        s.kind === "buy"
          ? new BuySignal("Conformance", fixture.config.instrument, s.price)
          : new SellSignal("Conformance", fixture.config.instrument, s.price);
      signal.timestamp = s.timestamp;
      pipeline.handle(signal);
    }
    return { pipeline, metrics, buys, sells, yields };
  }

  it("buy fill charges the canonical BASE-currency fee", () => {
    const { buys } = runPipelineFixture();
    const expected = canonical.fills[0];
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(expected.price);
    expectClose(buys[0].baseAmount, expected.baseGross, tolAmount);
    expectClose(buys[0].feeAmount, expected.feeBase, tolAmount);
    expectClose(buys[0].getNetBaseAmount(), expected.baseNet, tolAmount);
    expectClose(buys[0].counterAmount, expected.quoteSpent, tolAmount);
  });

  it("sell fill charges the canonical QUOTE-currency fee on the net base", () => {
    const { sells } = runPipelineFixture();
    const expected = canonical.fills[1];
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(expected.price);
    expectClose(sells[0].baseAmount, expected.baseSold, tolAmount);
    expectClose(sells[0].counterAmount, expected.quoteGross, tolAmount);
    expectClose(sells[0].feeAmount, expected.feeQuote, tolAmount);
    expectClose(sells[0].getNetCounterAmount(), expected.quoteNet, tolAmount);
  });

  it("round trip produces the canonical yield and final balance", () => {
    const { pipeline, yields } = runPipelineFixture();
    expect(yields).toHaveLength(1);
    const y = yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(pipeline.getBalance(), canonical.finalBalance, tolAmount);
  });

  it("surfaces the base buy fee and quote sell fee separately by asset", () => {
    const { pipeline } = runPipelineFixture();
    const fees = pipeline.getFeesByAsset();
    const base = fixture.config.instrument.split("/")[0];
    expectClose(fees[base], canonical.fills[0].feeBase, tolAmount);
    expectClose(fees[fixture.config.currency], canonical.fills[1].feeQuote, tolAmount);
  });

  it("metrics aggregate the round trip canonically", () => {
    // cagr is intentionally NOT asserted: a single yield gives
    // firstTimestamp == lastTimestamp, where CAGR = 0.
    const { metrics } = runPipelineFixture();
    const snap = metrics.snapshot();
    expect(snap.totalTrades).toBe(canonical.metrics.totalTrades);
    expect(snap.winCount).toBe(canonical.metrics.winCount);
    expectClose(snap.pnlTotal, canonical.yield.pnl, tolAmount);
    expect(snap.equityCurve).toHaveLength(1);
    expectClose(snap.equityCurve[0], canonical.finalBalance, tolAmount);
  });
});

describe("backtest conformance — metrics tier (metrics-mixed-trades)", () => {
  const fixture = loadFixture("metrics-mixed-trades.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function buildMetrics(): YieldMetrics {
    const strategy = new ConformanceStrategy();
    const metrics = new YieldMetrics(strategy, fixture.initialCapital);
    for (const y of fixture.yields) {
      metrics.addYield(
        new DefaultStrategyYield(
          fixture.instrument,
          fixture.currency,
          y.input,
          y.output,
          y.timestamp,
        ),
      );
    }
    return metrics;
  }

  it("computes every canonical metric, including the equity curve", () => {
    const snap = buildMetrics().snapshot();

    expect(snap.totalTrades).toBe(canonical.totalTrades);
    expect(snap.winCount).toBe(canonical.winCount);
    expect(snap.lossCount).toBe(canonical.lossCount);
    expectClose(snap.winRate, canonical.winRate, tolRatio);
    expectClose(snap.pnlTotal, canonical.pnlTotal, tolAmount);
    expectClose(snap.sharpeRatio, canonical.sharpeRatio, tolRatio);
    expectClose(snap.sortinoRatio, canonical.sortinoRatio, tolRatio);
    expectClose(snap.pnlTotalPercent, canonical.pnlTotalPercent, tolRatio);
    expectClose(snap.cagr, canonical.cagr, tolRatio);
    expectClose(snap.maxDrawdown, canonical.maxDrawdown, tolAmount);
    expectClose(snap.maxDrawdownPercent, canonical.maxDrawdownPercent, tolRatio);

    expect(snap.equityCurve).toHaveLength(canonical.equityCurve.length);
    canonical.equityCurve.forEach((point: number, i: number) => {
      expectClose(snap.equityCurve[i], point, tolAmount);
    });
  });

  // Pins the dense weekly-returns vector (fixed 7-day windows counted from
  // the first yield's timestamp) and the dense-sum invariant — the vector must
  // always sum back to pnlTotal.
  it("weekly returns match the canonical bucketed vector", () => {
    const weeklyReturns = buildMetrics().getWeeklyReturns();

    expect(weeklyReturns).toHaveLength(canonical.weeklyReturns.length);
    let sum = 0;
    canonical.weeklyReturns.forEach((expected: number, i: number) => {
      expectClose(weeklyReturns[i], expected, tolAmount);
      sum += weeklyReturns[i];
    });
    expectClose(sum, canonical.pnlTotal, tolAmount);
  });
});

describe("backtest conformance — CAGR tier (metrics-cagr-multiyear)", () => {
  // Two trades spaced exactly two 365.25-day years apart. The 365.25-day
  // metrics-mixed-trades fixture has annualization exponent 1, where CAGR ==
  // total return; this fixture's 2-year span gives exponent 1/2, so CAGR (0.10)
  // MUST differ from total return (0.21).
  const fixture = loadFixture("metrics-cagr-multiyear.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function buildMetrics(): YieldMetrics {
    const strategy = new ConformanceStrategy();
    const metrics = new YieldMetrics(strategy, fixture.initialCapital);
    for (const y of fixture.yields) {
      metrics.addYield(
        new DefaultStrategyYield(
          fixture.instrument,
          fixture.currency,
          y.input,
          y.output,
          y.timestamp,
        ),
      );
    }
    return metrics;
  }

  it("annualizes CAGR over a multi-year span (CAGR != total return)", () => {
    const snap = buildMetrics().snapshot();
    const totalReturn = snap.pnlTotal / fixture.initialCapital;

    expect(snap.totalTrades).toBe(canonical.totalTrades);
    expect(snap.winCount).toBe(canonical.winCount);
    expectClose(snap.pnlTotal, canonical.pnlTotal, tolAmount);
    expectClose(snap.pnlTotalPercent, canonical.pnlTotalPercent, tolRatio);
    expectClose(snap.cagr, canonical.cagr, tolRatio);

    // The distinguishing guard the single-year fixture cannot give.
    expect(snap.cagr).toBeLessThan(totalReturn);
    expect(Math.abs(snap.cagr - totalReturn)).toBeGreaterThan(0.01);

    expect(snap.equityCurve).toHaveLength(canonical.equityCurve.length);
    canonical.equityCurve.forEach((point: number, i: number) => {
      expectClose(snap.equityCurve[i], point, tolAmount);
    });
  });
});

describe("backtest conformance — metrics tier (metrics-dirty-returns)", () => {
  // Returns that are not exact at two significant digits (+9.78011%, -4.56789%,
  // +0.37%, +12.3456%). Sharpe and Sortino must use the exact per-trade return, so
  // a metric computed from a rounded return lands off the canonical numbers.
  const fixture = loadFixture("metrics-dirty-returns.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function buildMetrics(): YieldMetrics {
    const strategy = new ConformanceStrategy();
    const metrics = new YieldMetrics(strategy, fixture.initialCapital);
    for (const y of fixture.yields) {
      metrics.addYield(
        new DefaultStrategyYield(
          fixture.instrument,
          fixture.currency,
          y.input,
          y.output,
          y.timestamp,
        ),
      );
    }
    return metrics;
  }

  it("computes every canonical metric over the exact per-trade returns", () => {
    const snap = buildMetrics().snapshot();

    expect(snap.totalTrades).toBe(canonical.totalTrades);
    expect(snap.winCount).toBe(canonical.winCount);
    expect(snap.lossCount).toBe(canonical.lossCount);
    expectClose(snap.winRate, canonical.winRate, tolRatio);
    expectClose(snap.pnlTotal, canonical.pnlTotal, tolAmount);
    expectClose(snap.pnlTotalPercent, canonical.pnlTotalPercent, tolRatio);
    expectClose(snap.sharpeRatio, canonical.sharpeRatio, tolRatio);
    expectClose(snap.sortinoRatio, canonical.sortinoRatio, tolRatio);
    expectClose(snap.cagr, canonical.cagr, tolRatio);
    expectClose(snap.maxDrawdown, canonical.maxDrawdown, tolAmount);
    expectClose(snap.maxDrawdownPercent, canonical.maxDrawdownPercent, tolRatio);

    expect(snap.equityCurve).toHaveLength(canonical.equityCurve.length);
    canonical.equityCurve.forEach((point: number, i: number) => {
      expectClose(snap.equityCurve[i], point, tolAmount);
    });
  });

  it("weekly returns match the canonical bucketed vector", () => {
    const weeklyReturns = buildMetrics().getWeeklyReturns();

    expect(weeklyReturns).toHaveLength(canonical.weeklyReturns.length);
    canonical.weeklyReturns.forEach((expected: number, i: number) => {
      expectClose(weeklyReturns[i], expected, tolAmount);
    });
  });
});

describe("backtest conformance — pipeline tier (pipeline-asymmetric-fees)", () => {
  // Different per-side rates (buy 0.1% in base, sell 0.2% in quote). Pins that
  // the pipeline routes feeRateBuy to the buy fill and feeRateSell to the sell
  // fill — a single shared rate would land output 1097.8011 instead of the
  // canonical 1096.7022. The canonical fixture carries the engine-side rate keys
  // `buyFeeRate` / `sellFeeRate`; they map to the TS config `feeRateBuy` /
  // `feeRateSell`.
  const fixture = loadFixture("pipeline-asymmetric-fees.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function runPipelineFixture() {
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      feeRateBuy: fixture.config.buyFeeRate,
      feeRateSell: fixture.config.sellFeeRate,
      currency: fixture.config.currency,
    };
    const strategy = new ConformanceStrategy();
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) {
        buys.push(r);
      },
      onFilledSell(r) {
        sells.push(r);
      },
      onYield(y) {
        yields.push(y);
      },
    });

    for (const s of fixture.signals) {
      const signal: MarketHintSignal =
        s.kind === "buy"
          ? new BuySignal("Conformance", fixture.config.instrument, s.price)
          : new SellSignal("Conformance", fixture.config.instrument, s.price);
      signal.timestamp = s.timestamp;
      pipeline.handle(signal);
    }
    return { pipeline, buys, sells, yields };
  }

  it("charges the BUY fee at feeRateBuy (base) and SELL fee at feeRateSell (quote)", () => {
    const { buys, sells } = runPipelineFixture();
    const buy = canonical.fills[0];
    const sell = canonical.fills[1];

    expect(buys).toHaveLength(1);
    expectClose(buys[0].feeAmount, buy.feeBase, tolAmount);
    expectClose(buys[0].getNetBaseAmount(), buy.baseNet, tolAmount);

    expect(sells).toHaveLength(1);
    expectClose(sells[0].feeAmount, sell.feeQuote, tolAmount);
    expectClose(sells[0].getNetCounterAmount(), sell.quoteNet, tolAmount);
  });

  it("produces the canonical asymmetric-fee yield and final balance", () => {
    const { pipeline, yields } = runPipelineFixture();
    expect(yields).toHaveLength(1);
    expectClose(yields[0].output, canonical.yield.output, tolAmount);
    expectClose(yields[0].getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(pipeline.getBalance(), canonical.finalBalance, tolAmount);
  });

  it("surfaces per-side fees separately by asset", () => {
    const { pipeline } = runPipelineFixture();
    const fees = pipeline.getFeesByAsset();
    const base = fixture.config.instrument.split("/")[0];
    expectClose(fees[base], canonical.fills[0].feeBase, tolAmount);
    expectClose(fees[fixture.config.currency], canonical.fills[1].feeQuote, tolAmount);
  });
});

describe("backtest conformance — pipeline tier (pipeline-quote-fees, FeeLeg.QUOTE)", () => {
  // FeeLeg.QUOTE: the fee is charged in QUOTE on BOTH sides. The buy fee is
  // reserved out of the all-in cash at sizing (base / (1 + feeRate)), so
  // cost + fee == funding with no negative balance, and is folded into the
  // realized output of the matching sell. The distinguishing signal vs RECEIVED
  // is feesByAsset: every fee lands in quote (2.097902 USDT), with NO base entry.
  const fixture = loadFixture("pipeline-quote-fees.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function runPipelineFixture() {
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      feeLeg: FeeLeg.QUOTE,
      currency: fixture.config.currency,
    };
    const strategy = new ConformanceStrategy();
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) {
        buys.push(r);
      },
      onFilledSell(r) {
        sells.push(r);
      },
      onYield(y) {
        yields.push(y);
      },
    });

    for (const s of fixture.signals) {
      const signal: MarketHintSignal =
        s.kind === "buy"
          ? new BuySignal("Conformance", fixture.config.instrument, s.price)
          : new SellSignal("Conformance", fixture.config.instrument, s.price);
      signal.timestamp = s.timestamp;
      pipeline.handle(signal);
    }
    return { pipeline, buys, sells, yields };
  }

  it("reserves the buy fee at sizing: base = allInBase / (1 + feeRate)", () => {
    const { buys } = runPipelineFixture();
    const buy = canonical.fills[0];
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(buy.price);
    // The position holds the reserved gross base, and cost + fee == funding.
    expectClose(buys[0].baseAmount, buy.baseNet, tolAmount);
    expectClose(buys[0].counterAmount, buy.cost, tolAmount);
    expectClose(buys[0].feeAmount, buy.feeQuote, tolAmount);
  });

  it("sell fill charges the quote fee and returns quoteReceived", () => {
    const { sells } = runPipelineFixture();
    const sell = canonical.fills[1];
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(sell.price);
    expectClose(sells[0].baseAmount, sell.baseSold, tolAmount);
    expectClose(sells[0].counterAmount, sell.quoteGross, tolAmount);
    expectClose(sells[0].feeAmount, sell.feeQuote, tolAmount);
    expectClose(sells[0].getNetCounterAmount(), sell.quoteReceived, tolAmount);
  });

  it("round trip produces the canonical cost-basis yield and final balance", () => {
    const { pipeline, yields } = runPipelineFixture();
    expect(yields).toHaveLength(1);
    const y = yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    // No negative balance: cost + reserved buy fee == funding → finalBalance exact.
    expectClose(pipeline.getBalance(), canonical.finalBalance, tolAmount);
  });

  it("records ALL fees in quote with no base-asset entry", () => {
    const { pipeline } = runPipelineFixture();
    const fees = pipeline.getFeesByAsset();
    const base = fixture.config.instrument.split("/")[0];
    expectClose(fees[fixture.config.currency], canonical.feesByAsset.USDT, tolAmount);
    expect(fees[base]).toBeUndefined();
  });
});

describe("backtest conformance — pipeline tier (pipeline-percent-lock)", () => {
  // Fractional entry sizing: funding 1000, 50% → the entry trades 5 base (500
  // quote), not the all-in 10, and the yield cost basis is the 500 actually
  // spent. The canonical fixture key `percentAmountToLock` (percentage of the
  // available funds committed per entry, 0-100) maps to the TS config key
  // `buyPercent`, which has the same meaning.
  const fixture = loadFixture("pipeline-percent-lock.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function runPipelineFixture() {
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      buyPercent: fixture.config.percentAmountToLock,
      currency: fixture.config.currency,
    };
    const strategy = new ConformanceStrategy();
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) {
        buys.push(r);
      },
      onFilledSell(r) {
        sells.push(r);
      },
      onYield(y) {
        yields.push(y);
      },
    });

    for (const s of fixture.signals) {
      const signal: MarketHintSignal =
        s.kind === "buy"
          ? new BuySignal("Conformance", fixture.config.instrument, s.price)
          : new SellSignal("Conformance", fixture.config.instrument, s.price);
      signal.timestamp = s.timestamp;
      pipeline.handle(signal);
    }
    return { pipeline, buys, sells, yields };
  }

  it("sizes the entry to the configured fraction of the funds", () => {
    const { buys } = runPipelineFixture();
    const buy = canonical.fills[0];
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(buy.price);
    expectClose(buys[0].baseAmount, buy.baseGross, tolAmount);
    expectClose(buys[0].counterAmount, buy.quoteSpent, tolAmount);
  });

  it("sells the whole fractional position", () => {
    const { sells } = runPipelineFixture();
    const sell = canonical.fills[1];
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(sell.price);
    expectClose(sells[0].baseAmount, sell.baseSold, tolAmount);
    expectClose(sells[0].counterAmount, sell.quoteGross, tolAmount);
  });

  it("yield basis is the committed amount; the rest of the funds stays in cash", () => {
    const { pipeline, yields } = runPipelineFixture();
    expect(yields).toHaveLength(1);
    const y = yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(pipeline.getBalance(), canonical.finalBalance, tolAmount);
  });
});

describe("backtest conformance — pipeline tier (pipeline-maker-taker)", () => {
  // A maker/taker fee model (makerRate 0.0005, takerRate 0.002) with two plain
  // market fills: a market fill always takes liquidity, so BOTH sides must be
  // charged the TAKER rate. The fixture's `makerRate` / `takerRate` map to
  // `feeModel: new MakerTakerFeeModel(maker, taker)`; the shared `feeRate` is
  // required by BacktestConfig and set to 0 (the model supersedes it).
  const fixture = loadFixture("pipeline-maker-taker.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;

  function runPipelineFixture() {
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: 0,
      feeModel: new MakerTakerFeeModel(
        fixture.config.makerRate,
        fixture.config.takerRate,
      ),
      currency: fixture.config.currency,
    };
    const strategy = new ConformanceStrategy();
    const metrics = new YieldMetrics(strategy, config.initialFunding);
    const buys: ExecutionResult[] = [];
    const sells: ExecutionResult[] = [];
    const yields: StrategyYield[] = [];
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy(r) {
        buys.push(r);
      },
      onFilledSell(r) {
        sells.push(r);
      },
      onYield(y) {
        yields.push(y);
        metrics.addYield(y);
      },
    });

    for (const s of fixture.signals) {
      const signal: MarketHintSignal =
        s.kind === "buy"
          ? new BuySignal("Conformance", fixture.config.instrument, s.price)
          : new SellSignal("Conformance", fixture.config.instrument, s.price);
      signal.timestamp = s.timestamp;
      pipeline.handle(signal);
    }
    return { pipeline, metrics, buys, sells, yields };
  }

  it("buy market fill is charged the TAKER rate in base", () => {
    const { buys } = runPipelineFixture();
    const buy = canonical.fills[0];
    expect(buys).toHaveLength(1);
    expect(buys[0].price).toBe(buy.price);
    expectClose(buys[0].baseAmount, buy.baseGross, tolAmount);
    expectClose(buys[0].feeAmount, buy.feeBase, tolAmount);
    expectClose(buys[0].getNetBaseAmount(), buy.baseNet, tolAmount);
    expectClose(buys[0].counterAmount, buy.quoteSpent, tolAmount);
  });

  it("sell market fill is charged the TAKER rate in quote", () => {
    const { sells } = runPipelineFixture();
    const sell = canonical.fills[1];
    expect(sells).toHaveLength(1);
    expect(sells[0].price).toBe(sell.price);
    expectClose(sells[0].baseAmount, sell.baseSold, tolAmount);
    expectClose(sells[0].counterAmount, sell.quoteGross, tolAmount);
    expectClose(sells[0].feeAmount, sell.feeQuote, tolAmount);
    expectClose(sells[0].getNetCounterAmount(), sell.quoteNet, tolAmount);
  });

  it("round trip produces the canonical yield and final balance", () => {
    const { pipeline, yields } = runPipelineFixture();
    expect(yields).toHaveLength(1);
    const y = yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(pipeline.getBalance(), canonical.finalBalance, tolAmount);
  });

  it("surfaces the base buy fee and quote sell fee separately by asset", () => {
    const { pipeline } = runPipelineFixture();
    const fees = pipeline.getFeesByAsset();
    const base = fixture.config.instrument.split("/")[0];
    expectClose(fees[base], canonical.feesByAsset.BTC, tolAmount);
    expectClose(fees[fixture.config.currency], canonical.feesByAsset.USDT, tolAmount);
  });

  it("metrics aggregate the round trip", () => {
    const { metrics } = runPipelineFixture();
    const snap = metrics.snapshot();
    expect(snap.totalTrades).toBe(canonical.metrics.totalTrades);
    expect(snap.winCount).toBe(canonical.metrics.winCount);
    expectClose(snap.pnlTotal, canonical.yield.pnl, tolAmount);
  });
});

/**
 * Tick-scripted tier helpers. A fixture tick carries a single price (`last`),
 * so the scripted ticker has only `last` and `timestamp` set and every other
 * field null — exactly the scalar tick the engine's reference harness feeds.
 */
function lastOnlyTick(instrument: string, last: number, timestamp: number): Ticker {
  return {
    instrument,
    open: null,
    high: null,
    low: null,
    last,
    bid: null,
    bidSize: null,
    ask: null,
    askSize: null,
    volume: null,
    quoteVolume: null,
    vwap: null,
    percentageChange: null,
    timestamp,
  };
}

/** Strategy that emits scripted signals keyed on the 1-based tick sequence. */
class TickScriptedStrategy extends AbstractTickerStrategy {
  private seen = 0;
  private readonly script: (seq: number, ticker: Ticker) => MarketHintSignal | null;

  constructor(script: (seq: number, ticker: Ticker) => MarketHintSignal | null) {
    super("Conformance");
    this.script = script;
  }

  protected override setupIndicators(_indicators: InstrumentGroupRTIndicator): void {}

  override update(ticker: Ticker): void {
    this.seen++;
    const signal = this.script(this.seen, ticker);
    if (signal) {
      signal.timestamp = ticker.timestamp;
      this.emitSignal(signal);
    }
  }
}

/**
 * Wraps a fee model and records every FeeContext it is asked about, so a test
 * can assert the fill price, amounts and liquidity role of each fill (the
 * runner does not expose individual fills).
 */
function recordingFeeModel(inner: FeeModel): { model: FeeModel; calls: FeeContext[] } {
  const calls: FeeContext[] = [];
  return {
    calls,
    model: {
      compute(ctx) {
        calls.push(ctx);
        return inner.compute(ctx);
      },
    },
  };
}

describe("backtest conformance — tick tier (pipeline-limit-fill)", () => {
  // A LIMIT BUY emitted on tick 1 must not fill on that tick, must resolve on
  // tick 2 (last 99 <= limit 100) AT the limit price tagged MAKER, and the
  // market exit on tick 3 is TAKER. Config mapping: `makerRate` / `takerRate`
  // → `feeModel: new MakerTakerFeeModel(...)`; `feeLeg` → `feeLeg`. The limit
  // price (100) is the one stated in the fixture's tick-1 action.
  const fixture = loadFixture("pipeline-limit-fill.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;
  const instrument: string = fixture.config.instrument;
  const LIMIT_PRICE = 100;

  function runFixture() {
    const ticks: Ticker[] = fixture.ticks.map((t: any) =>
      lastOnlyTick(instrument, t.last, t.timestamp),
    );
    const strategy = new TickScriptedStrategy((seq, ticker) => {
      if (seq === 1) {
        return new BuySignal("Conformance", instrument, LIMIT_PRICE).setOrderKind(
          OrderKind.limit,
        );
      }
      if (seq === 3) {
        return new SellSignal("Conformance", instrument, ticker.last ?? 0);
      }
      return null;
    });
    const { model, calls } = recordingFeeModel(
      new MakerTakerFeeModel(fixture.config.makerRate, fixture.config.takerRate),
    );
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: 0,
      feeLeg: FeeLeg[fixture.config.feeLeg as keyof typeof FeeLeg],
      feeModel: model,
      currency: fixture.config.currency,
    };
    const result = BacktestRunner.run(strategy, ticks, config);
    return { result, calls, ticks };
  }

  it("runs the whole tick script", () => {
    const { result, ticks } = runFixture();
    expect(result.totalTicks).toBe(ticks.length);
  });

  it("limit entry fills AT the limit price as MAKER; market exit is TAKER", () => {
    const { calls } = runFixture();
    const buy = canonical.fills[0];
    const sell = canonical.fills[1];
    expect(calls).toHaveLength(2);

    expect(calls[0].side).toBe("buy");
    expect(calls[0].liquidity).toBe(buy.liquidity);
    expect(calls[0].price).toBe(buy.price);
    expectClose(calls[0].baseAmount, buy.baseGross, tolAmount);
    expectClose(calls[0].counterAmount, buy.quoteSpent, tolAmount);

    expect(calls[1].side).toBe("sell");
    expect(calls[1].liquidity).toBe(sell.liquidity);
    expect(calls[1].price).toBe(sell.price);
    expectClose(calls[1].baseAmount, sell.baseSold, tolAmount);
    expectClose(calls[1].counterAmount, sell.quoteGross, tolAmount);
  });

  it("round trip produces the canonical yield and final balance", () => {
    const { result } = runFixture();
    expect(result.yields).toHaveLength(1);
    const y = result.yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(result.finalBalance, canonical.finalBalance, tolAmount);
    // The Java runner states its final equity, the same when the run ends flat
    expectClose(result.finalEquity, canonical.finalBalance, tolAmount);
  });

  it("charges the maker fee in base on the entry and the taker fee in quote on the exit", () => {
    const { result } = runFixture();
    const base = instrument.split("/")[0];
    expectClose(result.feesByAsset[base], canonical.fills[0].feeBase, tolAmount);
    expectClose(
      result.feesByAsset[fixture.config.currency],
      canonical.fills[1].feeQuote,
      tolAmount,
    );
  });

  it("metrics aggregate the round trip", () => {
    const { result } = runFixture();
    expect(result.metrics.totalTrades).toBe(canonical.metrics.totalTrades);
    expect(result.metrics.winCount).toBe(canonical.metrics.winCount);
  });
});

describe("backtest conformance — tick tier (pipeline-stop-loss)", () => {
  // A filled market BUY carrying setStopPrice(90) must auto-place a pending
  // STOP-SELL that fires on the first tick at or below the stop (tick 3, last
  // 89) and fills AT the stop price 90. The strategy emits ONLY the buy: the
  // stop-sell is expected to come from the stop price attached to the entry.
  const fixture = loadFixture("pipeline-stop-loss.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;
  const instrument: string = fixture.config.instrument;

  function runFixture() {
    const ticks: Ticker[] = fixture.ticks.map((t: any) =>
      lastOnlyTick(instrument, t.last, t.timestamp),
    );
    const strategy = new TickScriptedStrategy((seq, ticker) => {
      if (seq !== 1) return null;
      return new BuySignal("Conformance", instrument, ticker.last ?? 0).setStopPrice(
        fixture.config.stopPrice,
      );
    });
    const { model, calls } = recordingFeeModel(
      new FixedFeeModel(fixture.config.feeRate, fixture.config.feeRate),
    );
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      feeModel: model,
      currency: fixture.config.currency,
    };
    const result = BacktestRunner.run(strategy, ticks, config);
    return { result, calls };
  }

  it("the attached stop fires on tick 3 and fills AT the stop price as TAKER", () => {
    const { calls } = runFixture();
    const buy = canonical.fills[0];
    const sell = canonical.fills[1];
    expect(calls).toHaveLength(2);
    expect(calls[0].side).toBe("buy");
    expect(calls[0].price).toBe(buy.price);
    expectClose(calls[0].baseAmount, buy.baseGross, tolAmount);
    expect(calls[1].side).toBe("sell");
    expect(calls[1].liquidity).toBe(sell.liquidity);
    expect(calls[1].price).toBe(sell.price);
    expectClose(calls[1].baseAmount, sell.baseSold, tolAmount);
    expectClose(calls[1].counterAmount, sell.quoteGross, tolAmount);
  });

  it("round trip produces the canonical loss and final balance", () => {
    const { result } = runFixture();
    expect(result.yields).toHaveLength(1);
    const y = result.yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(result.finalBalance, canonical.finalBalance, tolAmount);
    // The Java runner states its final equity, the same when the run ends flat
    expectClose(result.finalEquity, canonical.finalBalance, tolAmount);
  });

  it("metrics record one losing trade", () => {
    const { result } = runFixture();
    expect(result.metrics.totalTrades).toBe(canonical.metrics.totalTrades);
    expect(result.metrics.winCount).toBe(canonical.metrics.winCount);
  });
});

describe("backtest conformance — tick tier (pipeline-trailing-stop)", () => {
  // Percent-from-extreme trailing stop: the sell tracks a running MAX(extreme,
  // last) seeded with the signal's own price and fires when last retraces
  // `trailPercent`% from that extreme, filling AT the trigger level
  // (125 * 0.9 = 112.5).
  const fixture = loadFixture("pipeline-trailing-stop.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;
  const tolRatio: number = fixture.tolerances.ratios;
  const instrument: string = fixture.config.instrument;

  function runFixture() {
    const ticks: Ticker[] = fixture.ticks.map((t: any) =>
      lastOnlyTick(instrument, t.last, t.timestamp),
    );
    const strategy = new TickScriptedStrategy((seq, ticker) => {
      if (seq === 1) {
        return new BuySignal("Conformance", instrument, ticker.last ?? 0);
      }
      if (seq === 2) {
        return new SellSignal("Conformance", instrument, ticker.last ?? 0)
          .setOrderKind(OrderKind.stopTrailing)
          .setTrailPercent(fixture.config.trailPercent);
      }
      return null;
    });
    const { model, calls } = recordingFeeModel(
      new FixedFeeModel(fixture.config.feeRate, fixture.config.feeRate),
    );
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      feeModel: model,
      currency: fixture.config.currency,
    };
    const result = BacktestRunner.run(strategy, ticks, config);
    return { result, calls };
  }

  it("trailing sell fires AT the trigger level computed from the running extreme", () => {
    const { result, calls } = runFixture();
    const sell = canonical.fills[1];
    expect(calls).toHaveLength(2);
    expect(calls[1].liquidity).toBe(sell.liquidity);
    expectClose(calls[1].price, sell.price, tolAmount);

    expect(result.yields).toHaveLength(1);
    const y = result.yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(y.getYieldPercent(), canonical.yield.percent, tolRatio);
    expectClose(result.finalBalance, canonical.finalBalance, tolAmount);
    // The Java runner states its final equity, the same when the run ends flat
    expectClose(result.finalEquity, canonical.finalBalance, tolAmount);
    expect(result.metrics.winCount).toBe(canonical.metrics.winCount);
  });
});

describe("backtest conformance — bar tier (pipeline-kline-roundtrip-fees)", () => {
  // The bar-path counterpart of pipeline-long-roundtrip-fees: the same canonical
  // numbers, replayed as closed 1m bars with flat OHLC through a kline strategy.
  // Pins that the bar path reuses the production execution pipeline.
  const fixture = loadFixture("pipeline-kline-roundtrip-fees.json");
  const canonical = fixture.expected.canonical;
  const tolAmount: number = fixture.tolerances.amounts;

  /** Emits the fixture's scripted signals: buy on the first bar, sell on the second. */
  class ScriptedKlineStrategy extends AbstractKlineStrategy {
    private seen = 0;

    constructor() {
      super("Conformance");
    }

    override update(kline: Kline): void {
      super.update(kline);
      this.seen++;
      if (this.seen === 1) {
        this.emitSignal(new BuySignal("Conformance", kline.instrument, kline.close));
      } else if (this.seen === 2) {
        this.emitSignal(new SellSignal("Conformance", kline.instrument, kline.close));
      }
    }
  }

  /** A closed bar whose OHLC is flat at `price`, so the fill price is unambiguous. */
  function flatBar(price: number, timestamp: number): Kline {
    return {
      instrument: fixture.config.instrument,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1,
      quoteVolume: price,
      numberOfTrades: 1,
      timestamp,
    };
  }

  function runFixture() {
    const bars: Kline[] = fixture.signals.map((s: { price: number; timestamp: number }) =>
      flatBar(s.price, s.timestamp),
    );
    const config: BacktestConfig = {
      initialFunding: fixture.config.initialFunding,
      feeRate: fixture.config.feeRate,
      currency: fixture.config.currency,
    };
    return { bars, result: BacktestRunner.runKlines(new ScriptedKlineStrategy(), bars, config) };
  }

  it("replays the bars and produces the canonical yield and final balance", () => {
    const { bars, result } = runFixture();
    expect(result.totalTicks).toBe(bars.length);
    expect(result.yields).toHaveLength(1);
    const y = result.yields[0];
    expectClose(y.input, canonical.yield.input, tolAmount);
    expectClose(y.output, canonical.yield.output, tolAmount);
    expectClose(y.getYield(), canonical.yield.pnl, tolAmount);
    expectClose(result.finalBalance, canonical.finalBalance, tolAmount);
    // The Java runner states its final equity, the same when the run ends flat
    expectClose(result.finalEquity, canonical.finalBalance, tolAmount);
    expect(result.metrics.totalTrades).toBe(canonical.metrics.totalTrades);
    expect(result.metrics.winCount).toBe(canonical.metrics.winCount);
  });

  it("charges the canonical base fee on the buy and quote fee on the sell", () => {
    const { result } = runFixture();
    const base = fixture.config.instrument.split("/")[0];
    expectClose(result.feesByAsset[base], canonical.fills[0].feeBase, tolAmount);
    expectClose(result.feesByAsset[fixture.config.currency], canonical.fills[1].feeQuote, tolAmount);
  });
});
