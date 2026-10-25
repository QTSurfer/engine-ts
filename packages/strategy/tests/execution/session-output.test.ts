import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import { ValueRTIndicator, type InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { AbstractKlineStrategy } from "../../src/AbstractKlineStrategy";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { CrossDetector } from "../../src/CrossDetector";
import { StrategyEventType } from "../../src/event/StrategyEventType";
import { BuySignal } from "../../src/event/signal/BuySignal";
import { EventTypeValueSignal } from "../../src/event/signal/EventTypeValueSignal";
import { InfoStrategySignal } from "../../src/event/signal/InfoStrategySignal";
import { OrderKind, type MarketHintSignal } from "../../src/event/signal/MarketHintSignal";
import { SellSignal } from "../../src/event/signal/SellSignal";
import type { StrategySignal } from "../../src/event/signal/StrategySignal";
import { DefaultStrategyYield } from "../../src/event/yield/DefaultStrategyYield";
import type { BacktestConfig } from "../../src/execution/BacktestConfig";
import { BacktestExecutionPipeline } from "../../src/execution/BacktestExecutionPipeline";
import { BacktestRunner } from "../../src/execution/BacktestRunner";
import { ExecutionStatus } from "../../src/execution/ExecutionStatus";
import { FeeLeg } from "../../src/execution/FeeLeg";
import { NextBarOpenFill } from "../../src/execution/simulation/FillPolicy";
import { MakerTakerFeeModel } from "../../src/execution/simulation/FeeModel";
import type { Fill, IgnoredReason, SessionOutput } from "../../src/execution/SessionOutput";
import { YieldMetrics } from "../../src/execution/YieldMetrics";

const INSTRUMENT = "BTC/USDT";
const MINUTE = 60_000;
const START = 1_700_000_000_000;

function fixture(name: string): any {
  return JSON.parse(readFileSync(new URL(`../conformance/fixtures/${name}`, import.meta.url), "utf-8"));
}

function tick(price: number, timestamp: number, instrument = INSTRUMENT): Ticker {
  return {
    instrument,
    open: null,
    high: null,
    low: null,
    last: price,
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

function bar(close: number, timestamp: number): Kline {
  return {
    instrument: INSTRUMENT,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    quoteVolume: close,
    numberOfTrades: 1,
    timestamp,
  };
}

type Script = Record<number, (strategy: ScriptedStrategy, ticker: Ticker) => void>;

/**
 * Runs the scripted action of the 1-based tick sequence after the base update, so the indicators
 * have seen the tick and the signals carry the data time.
 */
class ScriptedStrategy extends AbstractTickerStrategy {
  private seen = 0;

  constructor(
    private readonly script: Script = {},
    private readonly setup?: (indicators: InstrumentGroupRTIndicator) => void,
  ) {
    super("Scripted");
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    this.setup?.(indicators);
  }

  override update(ticker: Ticker): void {
    super.update(ticker);
    this.seen++;
    this.script[this.seen]?.(this, ticker);
  }

  send(signal: StrategySignal): void {
    this.emitSignal(signal);
  }

  info(instrument: string, key?: string, ...values: unknown[]): void {
    this.emitInfo(instrument, key, ...values);
  }
}

class ScriptedKlineStrategy extends AbstractKlineStrategy {
  private seen = 0;

  constructor(private readonly script: Record<number, (strategy: ScriptedKlineStrategy, bar: Kline) => void>) {
    super("ScriptedKline");
  }

  override update(kline: Kline): void {
    super.update(kline);
    this.seen++;
    this.script[this.seen]?.(this, kline);
  }

  send(signal: StrategySignal): void {
    this.emitSignal(signal);
  }
}

function config(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return { initialFunding: 1000, feeRate: 0, currency: "USDT", ...overrides };
}

/** A market buy then a market sell at the prices of the fixture's two signals. */
function roundTrip(): Script {
  return {
    1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
    2: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
  };
}

function ticksOf(signals: { price: number; timestamp: number }[]): Ticker[] {
  return signals.map((s) => tick(s.price, s.timestamp));
}

describe("session output of a round trip (pipeline-long-roundtrip-fees)", () => {
  const long = fixture("pipeline-long-roundtrip-fees.json");
  const canonical = long.expected.canonical;
  const t0: number = long.signals[0].timestamp;
  const t1: number = long.signals[1].timestamp;

  function run() {
    return BacktestRunner.run(
      new ScriptedStrategy(roundTrip()),
      ticksOf(long.signals),
      config({ feeRate: long.config.feeRate }),
    );
  }

  it("records both fills with every field", () => {
    const { fills } = run().session;
    expect(fills).toHaveLength(2);

    const [buy, sell] = fills;
    expect(buy).toMatchObject({
      instrument: INSTRUMENT,
      timestamp: t0,
      side: "buy",
      price: canonical.fills[0].price,
      feeAsset: "BTC",
      liquidity: "taker",
      orderKind: "market",
    });
    expect(buy.baseAmount).toBeCloseTo(canonical.fills[0].baseGross, 9);
    expect(buy.counterAmount).toBeCloseTo(canonical.fills[0].quoteSpent, 9);
    expect(buy.fee).toBeCloseTo(canonical.fills[0].feeBase, 9);

    expect(sell).toMatchObject({
      instrument: INSTRUMENT,
      timestamp: t1,
      side: "sell",
      price: canonical.fills[1].price,
      feeAsset: "USDT",
      liquidity: "taker",
      orderKind: "market",
    });
    expect(sell.baseAmount).toBeCloseTo(canonical.fills[1].baseSold, 9);
    expect(sell.counterAmount).toBeCloseTo(canonical.fills[1].quoteGross, 9);
    expect(sell.fee).toBeCloseTo(canonical.fills[1].feeQuote, 9);
  });

  it("derives one trade from the entry fill, the exit fill and the yield", () => {
    const { trades } = run().session;
    expect(trades).toHaveLength(1);

    const [trade] = trades;
    expect(trade).toMatchObject({
      instrument: INSTRUMENT,
      entryTime: t0,
      entryPrice: 100,
      exitTime: t1,
      exitPrice: 110,
      exitKind: "market",
    });
    expect(trade.baseAmount).toBeCloseTo(canonical.fills[1].baseSold, 9);
    expect(trade.input).toBeCloseTo(canonical.yield.input, 9);
    expect(trade.output).toBeCloseTo(canonical.yield.output, 9);
    expect(trade.pnl).toBeCloseTo(canonical.yield.pnl, 9);
    expect(trade.pnlPercent).toBeCloseTo(canonical.yield.percent, 9);
  });

  it("anchors the equity at the first data point, then steps at the trade", () => {
    const { equity } = run().session;
    expect(equity).toHaveLength(2);
    expect(equity[0]).toEqual({ timestamp: t0, equity: 1000 });
    expect(equity[1].timestamp).toBe(t1);
    expect(equity[1].equity).toBeCloseTo(canonical.yield.output, 9);
  });

  it("keeps the equity curve of the metrics as it was and adds the timestamped points", () => {
    const { metrics, session } = run();
    expect(metrics.equityCurve).toEqual([session.equity[1].equity]);
    expect(metrics.equityPoints).toEqual([session.equity[1]]);
  });

  it("marks every signal in order, with its time and price", () => {
    const { markers } = run().session;
    expect(markers).toEqual([
      { timestamp: t0, instrument: INSTRUMENT, kind: "buy", price: 100, text: "BUY @ 100", orderKind: "market" },
      { timestamp: t1, instrument: INSTRUMENT, kind: "sell", price: 110, text: "SELL @ 110", orderKind: "market" },
    ]);
  });

  it("leaves the indicator series out unless asked for", () => {
    expect(run().session.indicators).toEqual([]);
  });

  it("gives the same session over closed bars (runKlines)", () => {
    const bars = long.signals.map((s: { price: number; timestamp: number }) => bar(s.price, s.timestamp));
    const strategy = new ScriptedKlineStrategy({
      1: (s, k) => s.send(new BuySignal("K", k.instrument, k.close)),
      2: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
    });

    const viaBars = BacktestRunner.runKlines(strategy, bars, config({ feeRate: long.config.feeRate }));

    expect(viaBars.session).toEqual(run().session);
  });
});

describe("session output by order kind", () => {
  it("a limit entry fills as maker at the limit, on the tick it resolves (pipeline-limit-fill)", () => {
    const limit = fixture("pipeline-limit-fill.json");
    const canonical = limit.expected.canonical;
    const ticks: Ticker[] = limit.ticks.map((t: any) => tick(t.last, t.timestamp));
    const [, second, third] = ticks;
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, 100).setOrderKind(OrderKind.limit)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(
      strategy,
      ticks,
      config({
        feeModel: new MakerTakerFeeModel(limit.config.makerRate, limit.config.takerRate),
        feeLeg: FeeLeg.RECEIVED,
      }),
    );

    expect(session.fills.map((f) => [f.side, f.orderKind, f.liquidity, f.price, f.feeAsset])).toEqual([
      ["buy", "limit", "maker", 100, "BTC"],
      ["sell", "market", "taker", 110, "USDT"],
    ]);
    expect(session.fills[0].fee).toBeCloseTo(canonical.fills[0].feeBase, 9);
    expect(session.fills[1].fee).toBeCloseTo(canonical.fills[1].feeQuote, 9);
    // The order waited one tick: the fill is stamped with the tick it resolved on
    expect(session.fills[0].timestamp).toBe(second.timestamp);
    expect(session.fills[1].timestamp).toBe(third.timestamp);
    expect(session.trades[0].entryTime).toBe(second.timestamp);
    expect(session.trades[0].pnl).toBeCloseTo(canonical.yield.pnl, 9);
    expect(session.markers.map((m) => [m.timestamp, m.text])).toEqual([
      [ticks[0].timestamp, "BUY limit @ 100"],
      [third.timestamp, "SELL @ 110"],
    ]);
  });

  it("a protective stop closes the trade as a stop at the stop price (pipeline-stop-loss)", () => {
    const stop = fixture("pipeline-stop-loss.json");
    const ticks: Ticker[] = stop.ticks.map((t: any) => tick(t.last, t.timestamp));
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0).setStopPrice(stop.config.stopPrice)),
    });

    const result = BacktestRunner.run(strategy, ticks, config());
    const { session } = result;

    expect(session.fills.map((f) => [f.side, f.orderKind, f.liquidity, f.price])).toEqual([
      ["buy", "market", "taker", 100],
      ["sell", "stop", "taker", 90],
    ]);
    expect(session.fills[1].baseAmount).toBeCloseTo(10, 9);
    expect(session.fills[1].counterAmount).toBeCloseTo(900, 9);
    expect(session.fills[1].timestamp).toBe(ticks[2].timestamp);

    expect(session.trades).toHaveLength(1);
    expect(session.trades[0]).toMatchObject({
      entryTime: ticks[0].timestamp,
      entryPrice: 100,
      exitTime: ticks[2].timestamp,
      exitPrice: 90,
      exitKind: "stop",
      input: 1000,
      output: 900,
      pnl: -100,
      pnlPercent: -10,
    });

    expect(session.equity.map((p) => p.equity)).toEqual([1000, 900]);
    // The point sits at the exit fill's time. The yield carries the time of the last point the
    // strategy saw: the stop resolves on tick 2 before the strategy sees it, so tick 1's, as the
    // Java engine stamps it
    expect(session.equity[1].timestamp).toBe(ticks[2].timestamp);
    expect(result.yields[0].timestamp).toBe(ticks[1].timestamp);

    // Only what the strategy emitted is marked: the stop is the pipeline's own order
    expect(session.markers.map((m) => m.text)).toEqual(["BUY @ 100"]);
  });

  it("a trailing stop closes the trade as stopTrailing at the trigger level (pipeline-trailing-stop)", () => {
    const trailing = fixture("pipeline-trailing-stop.json");
    const ticks: Ticker[] = trailing.ticks.map((t: any) => tick(t.last, t.timestamp));
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) =>
        s.send(
          new SellSignal("S", t.instrument, t.last ?? 0)
            .setOrderKind(OrderKind.stopTrailing)
            .setTrailPercent(trailing.config.trailPercent),
        ),
    });

    const { session } = BacktestRunner.run(strategy, ticks, config());

    expect(session.fills[1]).toMatchObject({
      side: "sell",
      orderKind: "stopTrailing",
      liquidity: "taker",
      price: 112.5,
      timestamp: ticks[3].timestamp,
    });
    expect(session.trades[0]).toMatchObject({ exitKind: "stopTrailing", exitPrice: 112.5, pnl: 125 });
    expect(session.equity.map((p) => p.equity)).toEqual([1000, 1125]);
    expect(session.markers.map((m) => m.text)).toEqual(["BUY @ 100", "SELL stopTrailing @ 120"]);
  });

  it("a fractional entry trades the committed part (pipeline-percent-lock)", () => {
    const lock = fixture("pipeline-percent-lock.json");
    const canonical = lock.expected.canonical;

    const { session } = BacktestRunner.run(
      new ScriptedStrategy(roundTrip()),
      ticksOf(lock.signals),
      config({ buyPercent: lock.config.percentAmountToLock }),
    );

    expect(session.fills.map((f) => [f.side, f.price, f.baseAmount, f.counterAmount, f.fee])).toEqual([
      ["buy", 100, canonical.fills[0].baseGross, canonical.fills[0].quoteSpent, 0],
      ["sell", 110, canonical.fills[1].baseSold, canonical.fills[1].quoteGross, 0],
    ]);
    expect(session.trades[0]).toMatchObject({ input: 500, output: 550, pnl: 50, pnlPercent: 10 });
    expect(session.equity.map((p) => p.equity)).toEqual([1000, canonical.finalBalance]);
  });

  it("charges the fee of both fills in quote under FeeLeg.QUOTE (pipeline-quote-fees)", () => {
    const quote = fixture("pipeline-quote-fees.json");
    const canonical = quote.expected.canonical;

    const { session } = BacktestRunner.run(
      new ScriptedStrategy(roundTrip()),
      ticksOf(quote.signals),
      config({ feeRate: quote.config.feeRate, feeLeg: FeeLeg.QUOTE }),
    );

    expect(session.fills.map((f) => f.feeAsset)).toEqual(["USDT", "USDT"]);
    expect(session.fills[0].fee).toBeCloseTo(canonical.fills[0].feeQuote, 6);
    expect(session.fills[0].baseAmount).toBeCloseTo(canonical.fills[0].baseNet, 6);
    expect(session.fills[1].fee).toBeCloseTo(canonical.fills[1].feeQuote, 6);
    expect(session.trades[0].output).toBeCloseTo(canonical.yield.output, 6);
  });

  it("stamps a market order the fill policy deferred with the tick it filled on", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });
    const ticks = [100, 101, 110, 112].map((price, i) => tick(price, START + i * MINUTE));

    const { session } = BacktestRunner.run(strategy, ticks, config({ fillPolicy: new NextBarOpenFill() }));

    // No open on the ticks: the deferred orders fill at their signal prices, one tick later
    expect(session.fills.map((f) => [f.side, f.orderKind, f.price, f.timestamp])).toEqual([
      ["buy", "market", 100, START + MINUTE],
      ["sell", "market", 110, START + 3 * MINUTE],
    ]);
    expect(session.markers.map((m) => m.timestamp)).toEqual([START, START + 2 * MINUTE]);
    expect(session.trades[0]).toMatchObject({ entryTime: START + MINUTE, exitTime: START + 3 * MINUTE });
  });

  it("a sell closes the whole trade whatever its sellPercent, and a second sell finds no position", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0).setSellPercent(50)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });
    const ticks = [100, 110, 120].map((price, i) => tick(price, START + i * MINUTE));

    const { session, yields } = BacktestRunner.run(strategy, ticks, config());

    // As the Java engine's long pipeline: sellPercent is read by its multi-long pipeline only
    expect(session.fills.map((f) => [f.side, f.baseAmount])).toEqual([
      ["buy", 10],
      ["sell", 10],
    ]);
    expect(session.trades.map((t) => [t.entryTime, t.entryPrice, t.exitTime, t.exitPrice])).toEqual([
      [START, 100, START + MINUTE, 110],
    ]);
    expect(session.trades.map((t) => [t.baseAmount, t.input, t.output, t.pnl])).toEqual([[10, 1000, 1100, 100]]);
    expect(yields).toHaveLength(1);
    expect(session.equity.map((p) => p.equity)).toEqual([1000, 1100]);
  });

  it("stamps the equity point with the exit fill's time, while the metrics keep the yield's own", () => {
    // The stop resolves on tick 3 before the strategy sees it: the fill is tick 3's, the yield
    // carries the last point the strategy saw, tick 2's, as the Java engine stamps it
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0).setStopPrice(90)),
    });
    const ticks = [100, 95, 89].map((price, i) => tick(price, START + i * MINUTE));

    const { session, yields, metrics } = BacktestRunner.run(strategy, ticks, config());

    expect(yields.map((y) => y.timestamp)).toEqual([START + MINUTE]);
    expect(metrics.equityPoints.map((p) => p.timestamp)).toEqual([START + MINUTE]);
    expect(session.equity.map((p) => p.timestamp)).toEqual([START, START + 2 * MINUTE]);
    expect(session.equity.map((p) => p.equity)).toEqual([1000, ...metrics.equityPoints.map((p) => p.equity)]);
    expect(session.trades.map((t) => [t.exitTime, t.exitKind])).toEqual([[START + 2 * MINUTE, "stop"]]);
  });

  it("pairs each entry with the sells that follow it, over several round trips", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
      3: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      4: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });
    const ticks = [100, 110, 100, 90].map((price, i) => tick(price, START + i * MINUTE));

    const { session } = BacktestRunner.run(strategy, ticks, config());

    expect(session.trades.map((t) => [t.entryTime, t.entryPrice, t.exitTime, t.exitPrice])).toEqual([
      [START, 100, START + MINUTE, 110],
      [START + 2 * MINUTE, 100, START + 3 * MINUTE, 90],
    ]);
    expect(session.equity.map((p) => p.timestamp)).toEqual([START, START + MINUTE, START + 3 * MINUTE]);
    expect(session.equity[2].equity).toBeCloseTo(1100 * 0.9, 9);
  });
});

describe("session output of an empty or quiet run", () => {
  it("is empty without data", () => {
    const result = BacktestRunner.run(new ScriptedStrategy(), [], config());
    expect(result.session).toEqual({ indicators: [], markers: [], equity: [], trades: [], fills: [] });
  });

  it("holds just the anchor when the strategy never trades", () => {
    const ticks = [10, 11, 12].map((price, i) => tick(price, START + i * MINUTE));
    const { session } = BacktestRunner.run(new ScriptedStrategy(), ticks, config());
    expect(session.equity).toEqual([{ timestamp: START, equity: 1000 }]);
    expect(session.trades).toEqual([]);
    expect(session.fills).toEqual([]);
    expect(session.markers).toEqual([]);
  });

  it("anchors at the first point of the whole list when it mixes instruments", () => {
    const ticks = [tick(10, START, "ETH/USDT"), tick(20, START + MINUTE, INSTRUMENT)];
    const { session } = BacktestRunner.run(new ScriptedStrategy(), ticks, config({ initialFunding: 500 }));
    expect(session.equity).toEqual([{ timestamp: START, equity: 500 }]);
  });

  it("keeps the equity points of the metrics apart from the session's", () => {
    const strategy = new ScriptedStrategy(roundTrip());
    const result = BacktestRunner.run(strategy, [tick(100, START), tick(110, START + MINUTE)], config());
    result.session.equity[1].equity = 0;
    expect(result.metrics.equityPoints[0].equity).toBe(1100);
  });
});

describe("timestamped equity points of the yield metrics", () => {
  it("add one point per yield next to the unchanged equity curve", () => {
    const metrics = new YieldMetrics(new ScriptedStrategy(), 1000);
    metrics.addYield(new DefaultStrategyYield(INSTRUMENT, "USDT", 1000, 1100, START));
    metrics.addYield(new DefaultStrategyYield(INSTRUMENT, "USDT", 500, 400, START + MINUTE));

    expect(metrics.getEquityCurve()).toEqual([1100, 1000]);
    expect(metrics.getEquityPoints()).toEqual([
      { timestamp: START, equity: 1100 },
      { timestamp: START + MINUTE, equity: 1000 },
    ]);
    const snapshot = metrics.snapshot();
    expect(snapshot.equityCurve).toEqual([1100, 1000]);
    expect(snapshot.equityPoints).toEqual(metrics.getEquityPoints());
  });

  it("have none before the first yield", () => {
    const metrics = new YieldMetrics(new ScriptedStrategy(), 1000);
    expect(metrics.getEquityPoints()).toEqual([]);
    expect(metrics.snapshot().equityPoints).toEqual([]);
  });
});

describe("the onFill callback", () => {
  it("reports each fill right after its filled callback, a sell's before the yield it closes", () => {
    const events: string[] = [];
    const fills: Fill[] = [];
    const pipeline = new BacktestExecutionPipeline(new ScriptedStrategy(), config(), {
      onFilledBuy: () => void events.push("filledBuy"),
      onFilledSell: () => void events.push("filledSell"),
      onFill: (fill) => {
        events.push(`fill ${fill.side}`);
        fills.push(fill);
      },
      onYield: () => void events.push("yield"),
    });
    const buy = new BuySignal("S", INSTRUMENT, 100);
    buy.timestamp = START;
    const sell = new SellSignal("S", INSTRUMENT, 110);
    sell.timestamp = START + MINUTE;

    pipeline.handle(buy);
    pipeline.handle(sell);

    expect(events).toEqual(["filledBuy", "fill buy", "filledSell", "fill sell", "yield"]);
    // No tick was fed, so the fills carry their signals' timestamps
    expect(fills.map((f) => f.timestamp)).toEqual([START, START + MINUTE]);
  });

  it("is optional: a callback without it works as before", () => {
    const yields: unknown[] = [];
    const pipeline = new BacktestExecutionPipeline(new ScriptedStrategy(), config(), {
      onFilledBuy() {},
      onFilledSell() {},
      onYield: (y) => void yields.push(y),
    });
    pipeline.handle(new BuySignal("S", INSTRUMENT, 100));
    pipeline.handle(new SellSignal("S", INSTRUMENT, 110));
    expect(yields).toHaveLength(1);
  });
});

describe("the onIgnored callback", () => {
  function watch(overrides: Partial<BacktestConfig> = {}, withCallback = true) {
    const ignored: { signal: MarketHintSignal; reason: IgnoredReason }[] = [];
    const fills: Fill[] = [];
    const pipeline = new BacktestExecutionPipeline(new ScriptedStrategy(), config(overrides), {
      onFilledBuy() {},
      onFilledSell() {},
      onFill: (fill) => void fills.push(fill),
      onYield() {},
      ...(withCallback ? { onIgnored: (signal: MarketHintSignal, reason: IgnoredReason) => void ignored.push({ signal, reason }) } : {}),
    });
    return { pipeline, ignored, fills };
  }

  const buy = (price = 100) => new BuySignal("S", INSTRUMENT, price);
  const sell = (price = 100) => new SellSignal("S", INSTRUMENT, price);

  it("reports a sell while flat as no-position and a second buy while long as already-long, with the signal itself", () => {
    const { pipeline, ignored, fills } = watch();
    const flatSell = sell();
    const entry = buy();
    const secondBuy = buy();

    pipeline.handle(flatSell);
    pipeline.handle(entry);
    pipeline.handle(secondBuy);
    pipeline.handle(sell(110));

    expect(ignored.map((i) => i.reason)).toEqual(["no-position", "already-long"]);
    expect(ignored[0].signal).toBe(flatSell);
    expect(ignored[1].signal).toBe(secondBuy);
    expect(fills.map((f) => f.side)).toEqual(["buy", "sell"]);
  });

  it("reports a buy with no balance as no-funds", () => {
    const { pipeline, ignored, fills } = watch({ initialFunding: 0 });
    const signal = buy();
    pipeline.handle(signal);
    expect(ignored).toEqual([{ signal, reason: "no-funds" }]);
    expect(fills).toEqual([]);
  });

  it("reports a buy that works out to nothing as zero-size", () => {
    const noBuy = watch({ buyPercent: 0 });
    const zeroBuy = buy();
    noBuy.pipeline.handle(zeroBuy);
    expect(noBuy.ignored).toEqual([{ signal: zeroBuy, reason: "zero-size" }]);
  });

  it("closes the position on a sell with a sellPercent of 0, which only the multi-long pipeline reads", () => {
    const { pipeline, ignored, fills } = watch();
    pipeline.handle(buy());
    pipeline.handle(sell().setSellPercent(0));
    expect(ignored).toEqual([]);
    expect(fills.map((f) => f.side)).toEqual(["buy", "sell"]);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
  });

  it("reports a trailing stop with nothing to trail by as invalid-order, at once, and queues it no more", () => {
    const { pipeline, ignored, fills } = watch();
    pipeline.handle(buy());
    const trailing = () => sell().setOrderKind(OrderKind.stopTrailing);
    const none = trailing();
    const zero = trailing().setTrailDistance(0);
    const negative = trailing().setTrailDistance(-2);
    pipeline.handle(none);
    pipeline.handle(zero);
    pipeline.handle(negative);

    expect(ignored).toEqual([
      { signal: none, reason: "invalid-order" },
      { signal: zero, reason: "invalid-order" },
      { signal: negative, reason: "invalid-order" },
    ]);

    // A fall that would trigger any of them fills nothing
    pipeline.onTicker(tick(50, START + MINUTE));
    expect(fills.map((f) => f.side)).toEqual(["buy"]);

    // One with a distance above zero or a percent is a valid order, not reported
    pipeline.handle(trailing().setTrailDistance(3));
    pipeline.handle(trailing().setTrailPercent(5));
    expect(ignored).toHaveLength(3);
  });

  it("reports a queued order when it resolves, not when it is sent (a limit buy that triggers while long)", () => {
    const { pipeline, ignored, fills } = watch();
    pipeline.handle(buy());
    const limit = buy(95).setOrderKind(OrderKind.limit);

    pipeline.handle(limit);
    pipeline.onTicker(tick(99, START));
    expect(ignored).toEqual([]);

    pipeline.onTicker(tick(94, START + MINUTE));
    expect(ignored).toEqual([{ signal: limit, reason: "already-long" }]);
    expect(fills.map((f) => f.side)).toEqual(["buy"]);
  });

  it("reports a queued sell that resolves with no position (a limit sell, and a market sell deferred by the fill policy)", () => {
    const limit = watch();
    const limitSell = sell(105).setOrderKind(OrderKind.limit);
    limit.pipeline.handle(limitSell);
    limit.pipeline.onTicker(tick(106, START));
    expect(limit.ignored).toEqual([{ signal: limitSell, reason: "no-position" }]);

    const deferred = watch({ fillPolicy: new NextBarOpenFill() });
    const marketSell = sell();
    deferred.pipeline.handle(marketSell);
    expect(deferred.ignored).toEqual([]);
    deferred.pipeline.onTicker(tick(100, START));
    expect(deferred.ignored).toEqual([{ signal: marketSell, reason: "no-position" }]);
  });

  it("reports a stop order of the strategy cancelled when the position closes, but not the stop an entry attached", () => {
    const { pipeline, ignored, fills } = watch();
    const strategyStop = sell(80).setOrderKind(OrderKind.stop);

    pipeline.handle(buy().setStopPrice(90));
    pipeline.handle(strategyStop);
    pipeline.handle(sell(110));

    expect(ignored).toEqual([{ signal: strategyStop, reason: "cancelled" }]);
    expect(fills.map((f) => f.side)).toEqual(["buy", "sell"]);
  });

  it("does not report the stop an entry attached when it resolves after another sell closed the position on the same tick", () => {
    const { pipeline, ignored, fills } = watch();
    // Queued first, so it fills before the stop the entry attaches; both fire on the same tick
    pipeline.handle(sell(100).setOrderKind(OrderKind.stopTrailing).setTrailPercent(5));
    pipeline.handle(buy().setStopPrice(90));

    pipeline.onTicker(tick(85, START + MINUTE));

    expect(fills.map((f) => [f.side, f.orderKind])).toEqual([
      ["buy", "market"],
      ["sell", "stopTrailing"],
    ]);
    expect(pipeline.getStatus()).toBe(ExecutionStatus.IDLE);
    expect(ignored).toEqual([]);
  });

  it("is optional, and reporting changes no number the pipeline computes", () => {
    const run = (withCallback: boolean) => {
      const { pipeline, fills, ignored } = watch({ feeRate: 0.001 }, withCallback);
      pipeline.handle(sell());
      pipeline.handle(buy(100).setStopPrice(90));
      pipeline.handle(buy(101));
      pipeline.handle(sell(95).setOrderKind(OrderKind.stop));
      pipeline.handle(sell(110).setSellPercent(50));
      pipeline.onTicker(tick(89, START));
      pipeline.handle(sell(120));
      return { balance: pipeline.getBalance(), status: pipeline.getStatus(), fills, fees: pipeline.getFeesByAsset(), ignored };
    };

    const plain = run(false);
    const reported = run(true);

    expect(reported.ignored.length).toBeGreaterThanOrEqual(3);
    expect(plain.ignored).toEqual([]);
    expect(reported.balance).toBe(plain.balance);
    expect(reported.status).toBe(plain.status);
    // A signal built without a tick in scope is stamped with the clock, so the two runs may differ by a millisecond
    const withoutTime = (list: typeof plain.fills) => list.map(({ timestamp: _timestamp, ...rest }) => rest);
    expect(withoutTime(reported.fills)).toEqual(withoutTime(plain.fills));
    expect(reported.fees).toEqual(plain.fees);
  });
});

describe("ignored signals on the markers", () => {
  const ticks = (prices: number[]) => prices.map((price, i) => tick(price, START + i * MINUTE));
  const buys = (session: SessionOutput) => session.markers.filter((m) => m.kind === "buy" || m.kind === "sell");
  const executed = (session: SessionOutput) => buys(session).filter((m) => m.ignored === undefined);
  const flags = (session: SessionOutput) => session.markers.map((m) => m.ignored?.reason ?? null);

  it("flags no marker of a normal round trip, and leaves the key out", () => {
    const { session } = BacktestRunner.run(new ScriptedStrategy(roundTrip()), ticks([100, 110]), config());
    expect(session.markers).toHaveLength(2);
    expect(session.markers.every((m) => !("ignored" in m))).toBe(true);
  });

  it("flags a sell while flat as no-position, on its own marker only", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 100, 110]), config());

    expect(session.markers.map((m) => m.kind)).toEqual(["sell", "buy", "sell"]);
    expect(session.markers[0].ignored).toEqual({ reason: "no-position" });
    expect(flags(session)).toEqual(["no-position", null, null]);
    expect(session.fills).toHaveLength(2);
    expect(executed(session)).toHaveLength(session.fills.length);
    expect(session.markers[0]).toMatchObject({ kind: "sell", text: "SELL @ 100", price: 100, orderKind: "market" });
  });

  it("flags the second buy while long as already-long", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 105, 110]), config());

    expect(flags(session)).toEqual([null, "already-long", null]);
    expect(executed(session)).toHaveLength(session.fills.length);
  });

  it("states the final equity as the funding plus the realized PnL, as the Java engine does", () => {
    const roundTrip = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });
    const closed = BacktestRunner.run(roundTrip, ticks([100, 110]), config());
    expect(closed.finalEquity).toBe(1100);
    expect(closed.finalBalance).toBe(1100);

    // A run that ends holding its all-in position has spent the cash, not the equity
    const held = new ScriptedStrategy({ 1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)) });
    const open = BacktestRunner.run(held, ticks([100, 110]), config());
    expect(open.finalEquity).toBe(1000);
    expect(open.finalBalance).toBe(0);
  });

  it("flags a buy with an empty balance as no-funds", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
    });

    const { session, finalBalance } = BacktestRunner.run(strategy, ticks([100, 101]), config({ initialFunding: 0 }));

    expect(flags(session)).toEqual(["no-funds"]);
    expect(session.fills).toEqual([]);
    expect(finalBalance).toBe(0);
  });

  it("flags a limit buy that triggers while already long, and only that marker", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new BuySignal("S", t.instrument, 95).setOrderKind(OrderKind.limit)),
      4: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 100, 94, 110]), config());

    expect(session.markers.map((m) => m.text)).toEqual(["BUY @ 100", "BUY limit @ 95", "SELL @ 110"]);
    expect(flags(session)).toEqual([null, "already-long", null]);
    expect(session.fills.map((f) => f.orderKind)).toEqual(["market", "market"]);
    expect(executed(session)).toHaveLength(session.fills.length);
  });

  it("flags a stop order of the strategy cancelled when the position closed", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new SellSignal("S", t.instrument, 80).setOrderKind(OrderKind.stop)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 100, 110]), config());

    expect(flags(session)).toEqual([null, "cancelled", null]);
    expect(executed(session)).toHaveLength(session.fills.length);
  });

  it("flags a trailing stop with nothing to trail by as invalid-order", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
      2: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0).setOrderKind(OrderKind.stopTrailing)),
      3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 105, 110]), config());

    expect(flags(session)).toEqual([null, "invalid-order", null]);
    expect(executed(session)).toHaveLength(session.fills.length);
  });

  it("leaves a signal that is still queued when the run ends unflagged", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new BuySignal("S", t.instrument, 50).setOrderKind(OrderKind.limit)),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 101, 102]), config());

    expect(session.markers).toHaveLength(1);
    expect(flags(session)).toEqual([null]);
    expect(session.fills).toEqual([]);
  });

  it("never flags an info marker", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => {
        s.info(t.instrument, "note", 1);
        s.send(new SellSignal("S", t.instrument, t.last ?? 0));
      },
      2: (s, t) => s.info(t.instrument, "note", 2),
    });

    const { session } = BacktestRunner.run(strategy, ticks([100, 101]), config());

    expect(session.markers.map((m) => m.kind)).toEqual(["info", "sell", "info"]);
    expect(flags(session)).toEqual([null, "no-position", null]);
  });

  it("gives the same flags over closed bars (runKlines)", () => {
    const strategy = new ScriptedKlineStrategy({
      1: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
      2: (s, k) => s.send(new BuySignal("K", k.instrument, k.close)),
      3: (s, k) => s.send(new BuySignal("K", k.instrument, k.close)),
      4: (s, k) => s.send(new SellSignal("K", k.instrument, k.close)),
    });
    const bars = [100, 100, 101, 110].map((close, i) => bar(close, START + i * MINUTE));

    const { session } = BacktestRunner.runKlines(strategy, bars, config());

    expect(flags(session)).toEqual(["no-position", null, "already-long", null]);
    expect(executed(session)).toHaveLength(session.fills.length);
  });

  describe("the unflagged buy and sell markers are the fills", () => {
    // A fill has a marker of its own, except the exit of the protective stop an entry attaches
    const FIXTURES: { name: string; attachedStopFills: number; run: () => SessionOutput }[] = [
      {
        name: "pipeline-long-roundtrip-fees",
        attachedStopFills: 0,
        run: () => {
          const long = fixture("pipeline-long-roundtrip-fees.json");
          return BacktestRunner.run(new ScriptedStrategy(roundTrip()), ticksOf(long.signals), config({ feeRate: long.config.feeRate })).session;
        },
      },
      {
        name: "pipeline-limit-fill",
        attachedStopFills: 0,
        run: () => {
          const limit = fixture("pipeline-limit-fill.json");
          const strategy = new ScriptedStrategy({
            1: (s, t) => s.send(new BuySignal("S", t.instrument, 100).setOrderKind(OrderKind.limit)),
            3: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
          });
          return BacktestRunner.run(
            strategy,
            limit.ticks.map((t: any) => tick(t.last, t.timestamp)),
            config({ feeModel: new MakerTakerFeeModel(limit.config.makerRate, limit.config.takerRate), feeLeg: FeeLeg.RECEIVED }),
          ).session;
        },
      },
      {
        name: "pipeline-stop-loss",
        attachedStopFills: 1,
        run: () => {
          const stop = fixture("pipeline-stop-loss.json");
          const strategy = new ScriptedStrategy({
            1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0).setStopPrice(stop.config.stopPrice)),
          });
          return BacktestRunner.run(strategy, stop.ticks.map((t: any) => tick(t.last, t.timestamp)), config()).session;
        },
      },
      {
        name: "pipeline-trailing-stop",
        attachedStopFills: 0,
        run: () => {
          const trailing = fixture("pipeline-trailing-stop.json");
          const strategy = new ScriptedStrategy({
            1: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
            2: (s, t) =>
              s.send(
                new SellSignal("S", t.instrument, t.last ?? 0)
                  .setOrderKind(OrderKind.stopTrailing)
                  .setTrailPercent(trailing.config.trailPercent),
              ),
          });
          return BacktestRunner.run(strategy, trailing.ticks.map((t: any) => tick(t.last, t.timestamp)), config()).session;
        },
      },
      {
        name: "pipeline-percent-lock",
        attachedStopFills: 0,
        run: () => {
          const lock = fixture("pipeline-percent-lock.json");
          return BacktestRunner.run(new ScriptedStrategy(roundTrip()), ticksOf(lock.signals), config({ buyPercent: lock.config.percentAmountToLock })).session;
        },
      },
      {
        name: "pipeline-quote-fees",
        attachedStopFills: 0,
        run: () => {
          const quote = fixture("pipeline-quote-fees.json");
          return BacktestRunner.run(
            new ScriptedStrategy(roundTrip()),
            ticksOf(quote.signals),
            config({ feeRate: quote.config.feeRate, feeLeg: FeeLeg.QUOTE }),
          ).session;
        },
      },
    ];

    it.each(FIXTURES)("holds on $name", ({ run, attachedStopFills }) => {
      const session = run();
      expect(session.fills.length).toBeGreaterThan(0);
      expect(session.markers.some((m) => m.ignored !== undefined)).toBe(false);
      expect(executed(session)).toHaveLength(session.fills.length - attachedStopFills);
    });

    it("holds on a scripted strategy with ignored signals mixed in", () => {
      const strategy = new ScriptedStrategy({
        1: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)), // flat
        2: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)), // fills
        3: (s, t) => {
          s.info(t.instrument, "note", 3);
          s.send(new BuySignal("S", t.instrument, t.last ?? 0)); // long
        },
        4: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0).setSellPercent(50)), // fills, closes it all
        5: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)), // fills
        6: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)), // fills, closes
        7: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)), // flat again
        8: (s, t) => s.send(new BuySignal("S", t.instrument, 90).setOrderKind(OrderKind.limit)), // fills later
        10: (s, t) => s.send(new BuySignal("S", t.instrument, 95).setOrderKind(OrderKind.limit)), // long when it triggers
        11: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0).setOrderKind(OrderKind.stopTrailing)), // nothing to trail by
        12: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)), // fills, closes
      });
      const prices = [100, 100, 101, 105, 106, 110, 108, 100, 89, 100, 94, 120];

      const { session, yields } = BacktestRunner.run(strategy, ticks(prices), config());

      expect(flags(session)).toEqual([
        "no-position", // 1: the sell while flat
        null, // 2: the buy that fills
        null, // 3: the info
        "already-long", // 3: the buy while long
        null, // 4: the sell, which closes the whole position whatever its sellPercent
        null, // 5: the buy that fills, flat since 4
        null, // 6: the sell that closes
        "no-position", // 7: the sell while flat again
        null, // 8: the limit buy that fills on 9
        "already-long", // 10: the limit buy that triggers on 11, long since 9
        "invalid-order", // 11: the trailing stop with nothing to trail by
        null, // 12: the sell that closes
      ]);
      expect(session.markers.filter((m) => m.kind === "info")).toHaveLength(1);
      expect(session.fills.map((f) => f.side)).toEqual(["buy", "sell", "buy", "sell", "buy", "sell"]);
      expect(yields).toHaveLength(3);
      expect(executed(session)).toHaveLength(session.fills.length);
      expect(buys(session).length - executed(session).length).toBeGreaterThanOrEqual(5);
    });
  });

  it("leaves the markers' order and count as they were, and the same with and without recording the indicators", () => {
    const script = (): ScriptedStrategy =>
      new ScriptedStrategy({
        1: (s, t) => s.send(new SellSignal("S", t.instrument, t.last ?? 0)),
        2: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
        3: (s, t) => s.send(new BuySignal("S", t.instrument, t.last ?? 0)),
        4: (s, t) => {
          s.info(t.instrument, "note", 4);
          s.send(new SellSignal("S", t.instrument, t.last ?? 0));
        },
      });
    const data = ticks([100, 100, 101, 110]);

    const plain = BacktestRunner.run(script(), data, config({ feeRate: 0.001 }));
    const recorded = BacktestRunner.run(script(), data, config({ feeRate: 0.001 }), { recordIndicators: true });

    expect(plain.session.markers.map((m) => [m.timestamp, m.kind])).toEqual([
      [START, "sell"],
      [START + MINUTE, "buy"],
      [START + 2 * MINUTE, "buy"],
      [START + 3 * MINUTE, "info"],
      [START + 3 * MINUTE, "sell"],
    ]);
    expect(flags(plain.session)).toEqual(["no-position", null, "already-long", null, null]);
    expect(recorded.session.markers).toEqual(plain.session.markers);
    expect(recorded.session.fills).toEqual(plain.session.fills);
    expect(recorded.session.trades).toEqual(plain.session.trades);
    expect(recorded.session.equity).toEqual(plain.session.equity);
    expect(recorded.yields).toEqual(plain.yields);
    expect(recorded.finalBalance).toBe(plain.finalBalance);
  });
});

describe("info markers", () => {
  const ticks = [10, 20].map((price, i) => tick(price, START + i * MINUTE));

  it("turns an info signal into a marker with no price, its data as text and as a plain object", () => {
    const strategy = new ScriptedStrategy({ 2: (s, t) => s.info(t.instrument, "note", "hello") });
    const { session } = BacktestRunner.run(strategy, ticks, config());
    expect(session.markers).toEqual([
      {
        timestamp: START + MINUTE,
        instrument: INSTRUMENT,
        kind: "info",
        price: null,
        text: "note=hello",
        data: { note: "hello" },
      },
    ]);
  });

  it("takes the price of a signal that carries one", () => {
    const strategy = new ScriptedStrategy({ 1: (s, t) => s.info(t.instrument, "price", 12.5) });
    const { session } = BacktestRunner.run(strategy, ticks, config());
    expect(session.markers[0]).toMatchObject({ kind: "info", price: 12.5, text: "price=12.5", data: { price: 12.5 } });
  });

  it("flattens a nested map into plain objects", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => {
        const signal = new InfoStrategySignal("S", t.instrument).set("levels", "lo", 1, "hi", 2);
        signal.set("deep", "inner", new Map([["a", 1]]));
        s.send(signal);
      },
    });
    const { session } = BacktestRunner.run(strategy, ticks, config());
    const [marker] = session.markers;
    expect(marker.data).toEqual({ levels: { lo: 1, hi: 2 }, deep: { inner: { a: 1 } } });
    expect(marker.text).toBe("levels={lo=1, hi=2}, deep={inner={a=1}}");
    expect(JSON.parse(JSON.stringify(marker.data))).toEqual(marker.data);
  });

  it("leaves out the per-tick indicator snapshot, which every tick of such a strategy emits", () => {
    const strategy = new ScriptedStrategy({ 2: (s, t) => s.info(t.instrument, "note", "kept") });
    strategy.enableIndicatorsSignals = true;
    const seen: InfoStrategySignal[] = [];
    strategy.onSignal((signal) => void seen.push(signal as InfoStrategySignal));

    const { session } = BacktestRunner.run(strategy, ticks, config());

    // A snapshot on each tick, and the strategy's own info signal after the second
    expect(seen.map((s) => s.indicatorSnapshot)).toEqual([true, true, false]);
    expect(session.markers.map((m) => m.text)).toEqual(["note=kept"]);
  });

  it("flags a hand-built info signal as no snapshot", () => {
    expect(new InfoStrategySignal("S", INSTRUMENT).indicatorSnapshot).toBe(false);
  });

  it("ignores the other signal types", () => {
    const strategy = new ScriptedStrategy({
      1: (s, t) => s.send(new EventTypeValueSignal("S", t.instrument, StrategyEventType.Command, "go")),
      2: (s, t) => s.send(new EventTypeValueSignal("S", t.instrument, StrategyEventType.Request, "ask")),
    });
    const { session } = BacktestRunner.run(strategy, ticks, config());
    expect(session.markers).toEqual([]);
  });
});

describe("indicator series", () => {
  const prices = [10, 20, 30, 40, 50];
  const ticks = prices.map((price, i) => tick(price, START + i * MINUTE));
  const timestamps = ticks.map((t) => t.timestamp);

  function runWith(
    recordIndicators: boolean | string[],
    setup: (indicators: InstrumentGroupRTIndicator) => void,
    data: Ticker[] = ticks,
  ): SessionOutput {
    return BacktestRunner.run(new ScriptedStrategy({}, setup), data, config(), { recordIndicators }).session;
  }

  function named(session: SessionOutput, name: string, instrument = INSTRUMENT) {
    const series = session.indicators.find((s) => s.name === name && s.instrument === instrument);
    expect(series, `series ${name} of ${instrument}`).toBeDefined();
    return series!;
  }

  it("samples an ema at every point, with the values worked out by hand", () => {
    const session = runWith(true, (i) => void i.ema(3));
    const ema = named(session, "ema3");
    // alpha = 2 / (3 + 1) = 0.5: 10, 10 + 0.5 * 10 = 15, 15 + 0.5 * 15 = 22.5, ... An ema is not
    // ready until it has seen its periods, so the first two (10 and 15) are not reported
    expect(ema.values).toEqual([null, null, 22.5, 31.25, 40.625]);
    expect(ema.timestamps).toEqual(timestamps);
    expect(ema).toMatchObject({ instrument: INSTRUMENT, id: "ema", display: "ABSOLUTE" });
  });

  it("is null until an indicator with a warm-up is ready (sma 3)", () => {
    const sma = named(runWith(true, (i) => void i.sma(3)), "sma3");
    // The default sma works on blocks of 3 points: it holds 20 until the next block closes
    expect(sma.values).toEqual([null, null, 20, 20, 20]);
    expect(sma.id).toBe("sma");
  });

  it("is null for an entry derived from indicators that are still warming up", () => {
    const session = runWith(true, (i) => {
      i.sma("fast", 2, false).sma("slow", 4, false).distance("dist", "fast", "slow");
      i.bollinger("bb", 4, 2).distanceMa("distSlow", "slow");
    });

    // The fast average is ready from the second point and the slow one from the fourth: a distance
    // between them says nothing before the fourth, and neither do the bands or the distance to the
    // slow average, whatever number they hold underneath
    expect(named(session, "fast").values.map((v) => v !== null)).toEqual([false, true, true, true, true]);
    expect(named(session, "slow").values.map((v) => v !== null)).toEqual([false, false, false, true, true]);
    for (const name of ["dist", "distSlow", "bb", "bbUpper", "bbLower"]) {
      expect(named(session, name).values.map((v) => v !== null), name).toEqual([false, false, false, true, true]);
    }
    // (35 - 25) / 25 as a percentage, and (45 - 35) / 35
    expect(named(session, "dist").values[3]).toBeCloseTo(40, 10);
    expect(named(session, "dist").values[4]).toBeCloseTo((10 / 35) * 100, 10);
  });

  it("follows a sliding sma point by point", () => {
    const sma = named(runWith(true, (i) => void i.sma("slide", 3, false)), "slide");
    expect(sma.values).toEqual([null, null, 20, 30, 40]);
  });

  it("keeps the values of a ready indicator and nulls those of an unready one", () => {
    const hold = new ValueRTIndicator();
    const session = runWith(true, (i) => void i.ema("e", 3).add("v", hold));
    expect(named(session, "e").values.slice(0, 2)).toEqual([null, null]);
    expect(named(session, "v").values).toEqual(prices);
  });

  it("carries the display hint of the indicator: percent for an rsi", () => {
    const session = runWith(true, (i) => void i.rsi(2).ema(2));
    expect(named(session, "rsi2")).toMatchObject({ id: "rsi", display: "PERCENT" });
    expect(named(session, "ema2").display).toBe("ABSOLUTE");
    for (const series of session.indicators) {
      expect(series.values).toHaveLength(series.timestamps.length);
    }
  });

  it("records the price and the other default indicators too", () => {
    const session = runWith(true, () => {});
    expect(session.indicators.map((s) => s.name)).toEqual(["price", "chg", "vwap", "volAsk", "volBid"]);
    expect(named(session, "price").values).toEqual(prices);
  });

  it("leaves out the hidden indicators, which are still updated", () => {
    const hidden = new ValueRTIndicator().hide();
    const session = runWith(true, (i) => {
      i.gain("price").add("internal", hidden).ema(3);
    });
    const names = session.indicators.map((s) => s.name);
    expect(names).toContain("ema3");
    expect(names).not.toContain("_gainprice");
    expect(names).not.toContain("internal");
    expect(hidden.getValue()).toBe(50);
  });

  it("keeps only the named indicators when given a list", () => {
    const session = runWith(["ema3", "missing"], (i) => void i.ema(3).sma(3));
    expect(session.indicators.map((s) => s.name)).toEqual(["ema3"]);
  });

  it("records nothing for false, an empty list or no option", () => {
    expect(runWith(false, (i) => void i.ema(3)).indicators).toEqual([]);
    expect(runWith([], (i) => void i.ema(3)).indicators).toEqual([]);
    const plain = BacktestRunner.run(new ScriptedStrategy({}, (i) => void i.ema(3)), ticks, config());
    expect(plain.session.indicators).toEqual([]);
  });

  it("shares the timestamps among the series of one instrument", () => {
    const session = runWith(true, (i) => void i.ema(3).sma(3));
    const [first, ...rest] = session.indicators;
    expect(rest.length).toBeGreaterThan(1);
    for (const series of rest) expect(series.timestamps).toBe(first.timestamps);
  });

  it("keeps one series per instrument over a mixed tick list", () => {
    const mixed = [
      tick(10, START, "BTC/USDT"),
      tick(100, START + 1 * MINUTE, "ETH/USDT"),
      tick(20, START + 2 * MINUTE, "BTC/USDT"),
      tick(200, START + 3 * MINUTE, "ETH/USDT"),
      tick(30, START + 4 * MINUTE, "BTC/USDT"),
    ];
    const session = runWith(["ema3"], (i) => void i.ema(3), mixed);

    const btc = named(session, "ema3", "BTC/USDT");
    const eth = named(session, "ema3", "ETH/USDT");
    expect(session.indicators).toHaveLength(2);
    // Each instrument has its own indicators, warmed up on its own points
    expect(btc.values).toEqual([null, null, 22.5]);
    expect(btc.timestamps).toEqual([START, START + 2 * MINUTE, START + 4 * MINUTE]);
    expect(eth.values).toEqual([null, null]);
    expect(eth.timestamps).toEqual([START + 1 * MINUTE, START + 3 * MINUTE]);
    expect(eth.timestamps).not.toBe(btc.timestamps);
  });

  it("aligns an indicator added after the first point with nulls before it", () => {
    const strategy = new ScriptedStrategy({
      2: (s, t) => void s.getInstrumentIndicatorGroup(t.instrument).add("late", new ValueRTIndicator()),
    });
    const { session } = BacktestRunner.run(strategy, ticks, config(), { recordIndicators: ["late"] });
    const late = named(session, "late");
    // It joins during the second tick, so it has not seen that tick yet (it holds 0) and has no first value
    expect(late.values).toEqual([null, 0, 30, 40, 50]);
    expect(late.timestamps).toEqual(timestamps);
  });

  it("samples a kline strategy by its closes", () => {
    const strategy = new ScriptedKlineStrategy({});
    const bars = prices.map((price, i) => bar(price, START + i * MINUTE));
    const { session } = BacktestRunner.runKlines(strategy, bars, config(), { recordIndicators: ["price"] });
    expect(session.indicators).toHaveLength(1);
    expect(session.indicators[0].values).toEqual(prices);
    expect(session.indicators[0].timestamps).toEqual(timestamps);
  });

  it("builds no indicators for a strategy that never updates them", () => {
    class Bare extends AbstractTickerStrategy {
      constructor() {
        super("Bare");
      }
      override update(): void {}
    }
    const { session } = BacktestRunner.run(new Bare(), ticks, config(), { recordIndicators: true });
    expect(session.indicators).toEqual([]);
  });
});

/** EMA crossover over indicators of several kinds, so recording reads many of them. */
class CrossoverStrategy extends AbstractTickerStrategy {
  private readonly cross = new CrossDetector();

  constructor() {
    super("Crossover");
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 3).ema("emaSlow", 7).rsi(5).sma(4).macd("macd", 12, 26);
  }

  override update(ticker: Ticker): void {
    super.update(ticker);
    const indicators = this.getInstrumentIndicatorGroup(ticker.instrument).indicators;
    const cross = this.cross.check(indicators.getIndicatorValue("emaFast"), indicators.getIndicatorValue("emaSlow"));
    if (cross.above) this.emitBuy(ticker.instrument, ticker.last ?? 0);
    if (cross.below) this.emitSell(ticker.instrument, ticker.last ?? 0);
  }
}

const SWINGS = [
  100, 100, 100, 100, 100, 100, 100, 110, 120, 130, 140, 150, 160, 170, 160, 140, 110, 80, 50, 30, 20, 30, 50, 80,
  110, 140, 170, 200, 180, 150, 110, 70, 40, 20, 10,
];
const SWING_TICKS = SWINGS.map((price, i) => tick(price, START + i * MINUTE));

describe("recording the indicators", () => {
  it("changes nothing a run computes", () => {
    const options = { recordIndicators: true };
    const plain = BacktestRunner.run(new CrossoverStrategy(), SWING_TICKS, config({ feeRate: 0.001 }));
    const recorded = BacktestRunner.run(new CrossoverStrategy(), SWING_TICKS, config({ feeRate: 0.001 }), options);

    // The run trades, so the comparison is not of two empty results
    expect(plain.yields.length).toBeGreaterThanOrEqual(1);
    expect(plain.session.markers.length).toBeGreaterThanOrEqual(2);

    expect(recorded.yields).toEqual(plain.yields);
    expect(recorded.metrics).toEqual(plain.metrics);
    expect(recorded.finalBalance).toBe(plain.finalBalance);
    expect(recorded.feesByAsset).toEqual(plain.feesByAsset);
    expect(recorded.totalTicks).toBe(plain.totalTicks);
    expect(recorded.session.fills).toEqual(plain.session.fills);
    expect(recorded.session.trades).toEqual(plain.session.trades);
    expect(recorded.session.markers).toEqual(plain.session.markers);
    expect(recorded.session.equity).toEqual(plain.session.equity);

    expect(plain.session.indicators).toEqual([]);
    expect(recorded.session.indicators.length).toBeGreaterThan(5);
    const fast = recorded.session.indicators.find((s) => s.name === "emaFast");
    expect(fast?.values).toHaveLength(SWINGS.length);
  });

  it("records the value the indicator holds after the last point", () => {
    const strategy = new CrossoverStrategy();
    const { session } = BacktestRunner.run(strategy, SWING_TICKS, config(), { recordIndicators: ["emaFast"] });
    const group = strategy.getInstrumentIndicatorGroup(INSTRUMENT);
    expect(session.indicators[0].values.at(-1)).toBe(group.indicators.getIndicatorValue("emaFast"));
  });
});

/** Publishes its indicators on every tick and trades nothing, with a window on one of them. */
class PublishingStrategy extends AbstractTickerStrategy {
  constructor(private readonly windowed: boolean) {
    super("Publishing");
    this.enableIndicatorsSignals = true;
  }

  protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
    super.setupIndicators(indicators);
    indicators.ema("emaFast", 3);
    if (this.windowed) indicators.window("emaFast", "m1", () => undefined);
  }
}

describe("a strategy that only publishes its indicators", () => {
  it("marks no indicator snapshot", () => {
    const strategy = new PublishingStrategy(false);
    const signals: StrategySignal[] = [];
    strategy.onSignal((signal) => void signals.push(signal));

    const { session } = BacktestRunner.run(strategy, SWING_TICKS, config());

    expect(signals.length).toBe(SWING_TICKS.length);
    expect(session.markers).toEqual([]);
  });

  it("does not record the windows, which are hidden", () => {
    const { session } = BacktestRunner.run(new PublishingStrategy(true), SWING_TICKS, config(), {
      recordIndicators: true,
    });
    const names = session.indicators.map((s) => s.name);
    expect(names).toContain("emaFast");
    expect(names.filter((name) => name.startsWith("_"))).toEqual([]);
  });
});
