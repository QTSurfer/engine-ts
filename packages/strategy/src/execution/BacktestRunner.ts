import type { Kline, Ticker } from "@qtsurfer/core";
import type { MarketHintSignal } from "$signal/MarketHintSignal";
import { MarketHintKind } from "$signal/MarketHintSignal";
import type { StrategyYield } from "$yield/StrategyYield";
import type { AbstractKlineStrategy } from "../AbstractKlineStrategy";
import type { AbstractSubscriptionStrategy } from "../AbstractSubscriptionStrategy";
import type { AbstractTickerStrategy } from "../AbstractTickerStrategy";
import type { BacktestConfig } from "./BacktestConfig";
import { BacktestExecutionPipeline } from "./BacktestExecutionPipeline";
import type { EquityPoint, RunOptions, SessionOutput } from "./SessionOutput";
import { SessionRecorder } from "./SessionRecorder";
import { YieldMetrics, type YieldMetricsSnapshot } from "./YieldMetrics";

/**
 * Result of a backtest run.
 */
export interface BacktestResult {
  yields: StrategyYield[];
  metrics: YieldMetricsSnapshot;
  /** The initial funding plus the realized PnL, as the Java engine's `finalEquity`. */
  finalEquity: number;
  /** The cash at the end: near 0 when the run ends holding an all-in position. */
  finalBalance: number;
  /** Market data points replayed: tickers for `run`, bars for `runKlines`. */
  totalTicks: number;
  /**
   * Total fees charged per asset symbol: under RECEIVED, base-asset entries from
   * buy fills and quote-asset from sell fills; under QUOTE, every entry lands in
   * the quote currency.
   */
  feesByAsset: Record<string, number>;
  /**
   * What a chart and a results zone draw: markers, equity, trades and fills always, indicator
   * series when the run asked for them with {@link RunOptions.recordIndicators}.
   */
  session: SessionOutput;
}

/**
 * Orchestrates a full backtest: feeds market data to a strategy,
 * processes signals through the execution pipeline, and collects results.
 *
 * Tickers and klines run through the same execution pipeline. A kline replay
 * is the same simulation fed closed bars: pending orders resolve against the
 * bar's close, and the bar's open/high/low reach the pipeline for the fee and
 * slippage models that consult them.
 */
export class BacktestRunner {
  static run(
    strategy: AbstractTickerStrategy,
    tickers: Ticker[],
    config: BacktestConfig,
    options?: RunOptions,
  ): BacktestResult {
    return BacktestRunner.replay(strategy, tickers, config, options, (ticker) => {
      strategy.update(ticker);
    }, (ticker) => ticker);
  }

  /**
   * Replays closed klines through a kline strategy. Each bar reaches the
   * execution pipeline first (so a pending order resolves against this bar's
   * close before the strategy sees it), then the strategy.
   */
  static runKlines(
    strategy: AbstractKlineStrategy,
    klines: Kline[],
    config: BacktestConfig,
    options?: RunOptions,
  ): BacktestResult {
    return BacktestRunner.replay(strategy, klines, config, options, (kline) => {
      strategy.update(kline);
    }, klineAsTicker);
  }

  private static replay<T>(
    strategy: AbstractSubscriptionStrategy<T>,
    items: readonly T[],
    config: BacktestConfig,
    options: RunOptions | undefined,
    feedStrategy: (item: T) => void,
    asTicker: (item: T) => Ticker,
  ): BacktestResult {
    strategy.backtestEnabled = true;

    const yields: StrategyYield[] = [];
    const metrics = new YieldMetrics(strategy, config.initialFunding);
    const recorder = new SessionRecorder(options, (instrument) =>
      strategy.findInstrumentIndicatorGroup(instrument),
    );
    const pipeline = new BacktestExecutionPipeline(strategy, config, {
      onFilledBuy() {},
      onFilledSell() {},
      onFill(fill) {
        recorder.fill(fill);
      },
      onIgnored(signal, reason) {
        recorder.ignored(signal, reason);
      },
      onYield(y) {
        yields.push(y);
        metrics.addYield(y);
        recorder.yield(y);
      },
    });

    // Wire strategy signals to the pipeline
    const unsubSignal = strategy.onSignal((signal) => {
      if (isMarketHint(signal)) {
        // The marker comes first: a signal the pipeline drops at once is flagged on it
        recorder.hint(signal as MarketHintSignal);
        pipeline.handle(signal as MarketHintSignal);
      } else {
        recorder.info(signal);
      }
    });

    // Feed the data. The pipeline is updated *before* the strategy sees the
    // point so that any signal emitted during `strategy.update` resolves its
    // fill with the current bar already in scope (relevant for slippage
    // models that consult bar high/low).
    let sessionStart: number | undefined;
    let sessionEnd: number | undefined;
    for (const item of items) {
      const ticker = asTicker(item);
      sessionStart ??= ticker.timestamp;
      sessionEnd = ticker.timestamp;
      pipeline.onTicker(ticker);
      feedStrategy(item);
      recorder.point(ticker.instrument, ticker.timestamp);
    }

    // Bucketed over the replayed data's span, as the Java engine's runner does
    const snapshot =
      sessionStart === undefined || sessionEnd === undefined ? metrics.snapshot() : metrics.snapshot(sessionStart, sessionEnd);
    // The curve starts where the session does, at the initial funding, then steps at each trade
    const anchor: EquityPoint | undefined =
      sessionStart === undefined ? undefined : { timestamp: sessionStart, equity: config.initialFunding };

    const result: BacktestResult = {
      yields,
      metrics: snapshot,
      finalEquity: config.initialFunding + metrics.getPnlTotal(),
      finalBalance: pipeline.getBalance(),
      totalTicks: items.length,
      feesByAsset: pipeline.getFeesByAsset(),
      session: recorder.finish(anchor, snapshot.equityPoints),
    };

    // Cleanup
    unsubSignal();
    metrics.dispose();

    return result;
  }
}

/** A closed bar as the pipeline sees it: `last` is the close. */
function klineAsTicker(kline: Kline): Ticker {
  return {
    instrument: kline.instrument,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    last: kline.close,
    bid: null,
    bidSize: null,
    ask: null,
    askSize: null,
    volume: kline.volume,
    quoteVolume: kline.quoteVolume,
    vwap: null,
    percentageChange: null,
    timestamp: kline.timestamp,
  };
}

function isMarketHint(signal: unknown): boolean {
  return (
    typeof signal === "object" &&
    signal !== null &&
    "kind" in signal &&
    ((signal as { kind: string }).kind === MarketHintKind.buy ||
      (signal as { kind: string }).kind === MarketHintKind.sell)
  );
}
