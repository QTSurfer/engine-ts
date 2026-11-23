import { Instrument, MarketDataSource, VenueType } from "@qtsurfer/core";
import type { Kline, Ticker } from "@qtsurfer/core";
import type { MarketHintSignal } from "$signal/MarketHintSignal";
import { MarketHintKind } from "$signal/MarketHintSignal";
import type { StrategyYield } from "$yield/StrategyYield";
import type { AbstractKlineStrategy } from "../AbstractKlineStrategy";
import type { AbstractSubscriptionStrategy } from "../AbstractSubscriptionStrategy";
import type { AbstractTickerStrategy } from "../AbstractTickerStrategy";
import type { Strategy } from "../Strategy";
import { StrategyContext } from "../StrategyContext";
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
    return BacktestRunner.replay(strategy, tickers, MarketDataSource.Ticker, config, options, (ticker) => {
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
    return BacktestRunner.replay(strategy, klines, MarketDataSource.KLine, config, options, (kline) => {
      strategy.update(kline);
    }, klineAsTicker);
  }

  /**
   * The one per-run body, shared by `run` and `runKlines`. Exactly two things depend on what is
   * replayed: how a data point reaches the strategy (`feedStrategy`) and how it is presented to the
   * pipeline (`asTicker`). `type` names the data for the strategy's attachment context.
   *
   * The strategy is told about its source around the loop: `onAttach` once before the first data
   * point and `onDetach` once after the last, even when the loop throws, but not when `onAttach`
   * itself threw. Both run before the result is built, so a trade they cause is part of it. See
   * {@link attachmentContext}.
   */
  private static replay<T>(
    strategy: AbstractSubscriptionStrategy<T>,
    items: readonly T[],
    type: MarketDataSource,
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

    try {
      const attachment = attachmentContext(strategy, type);
      // Before the first data point the strategy has seen no time, and a signal emitted from
      // onAttach would carry zero. The first data point's own time is the earliest deterministic
      // one, so the clock is lent to the hook. It is given back afterwards: a strategy whose
      // update() never advances the clock keeps stamping what it emits with whatever it had before.
      const clock = strategy.lastEventTimestamp;
      if (items.length > 0) {
        strategy.lastEventTimestamp = asTicker(items[0] as T).timestamp;
      }
      try {
        // If this throws the run never started, so there is nothing to detach: the exception
        // leaves through the outer finally, which only releases what this method built.
        strategy.onAttach(attachment);
      } finally {
        strategy.lastEventTimestamp = clock;
      }

      // Feed the data. The pipeline is updated *before* the strategy sees the
      // point so that any signal emitted during `strategy.update` resolves its
      // fill with the current bar already in scope (relevant for slippage
      // models that consult bar high/low).
      let sessionStart: number | undefined;
      let sessionEnd: number | undefined;
      let replayed = false;
      try {
        for (const item of items) {
          const ticker = asTicker(item);
          sessionStart ??= ticker.timestamp;
          sessionEnd = ticker.timestamp;
          pipeline.onTicker(ticker);
          feedStrategy(item);
          recorder.point(ticker.instrument, ticker.timestamp);
        }
        replayed = true;
      } finally {
        detach(strategy, attachment, replayed);
      }

      // Bucketed over the replayed data's span, as the Java engine's runner does
      const snapshot =
        sessionStart === undefined || sessionEnd === undefined ? metrics.snapshot() : metrics.snapshot(sessionStart, sessionEnd);
      // The curve starts where the session does, at the initial funding, then steps at each trade
      const anchor: EquityPoint | undefined =
        sessionStart === undefined ? undefined : { timestamp: sessionStart, equity: config.initialFunding };

      return {
        yields,
        metrics: snapshot,
        finalEquity: config.initialFunding + metrics.getPnlTotal(),
        finalBalance: pipeline.getBalance(),
        totalTicks: items.length,
        feesByAsset: pipeline.getFeesByAsset(),
        session: recorder.finish(anchor, snapshot.equityPoints),
      };
    } finally {
      // Cleanup
      unsubSignal();
      metrics.dispose();
    }
  }
}

/** The attachment id of every backtest: a replay has one source, so there is nothing to tell apart. */
const ATTACHMENT_ID = "backtest";

/** The venue a backtest says its data comes from: a replay has no venue to ask. */
const EXCHANGE = "backtest";

/** The segment a backtest says its data belongs to; a run config has no other to offer. */
const SEGMENT = "spot";

/**
 * What the strategy is told about the source of a backtest, for `onAttach` and, in its detached
 * form, `onDetach`. Built once per run, before the first data point.
 *
 * - `id`: always `"backtest"`, so a backtest names its attachment the same way every time.
 * - `venueType` and `segment`: `VenueType.CEX` and `"spot"`. The run config carries neither, and a
 *   replay has no venue to ask.
 * - `exchange`: `"backtest"`.
 * - `type`: what the run replays, `MarketDataSource.Ticker` or `MarketDataSource.KLine`, passed
 *   down by the entry point that knows it.
 * - `instruments`: those the strategy holds before it has seen any data, sorted by symbol so the
 *   order does not depend on insertion. For a strategy that discovers its instruments from the
 *   data this is empty, because the runner does not read ahead.
 * - `warmingUp`: false. A backtest replays its own warm-up as ordinary data.
 */
function attachmentContext(strategy: Strategy, type: MarketDataSource): StrategyContext {
  return StrategyContext.builder()
    .id(ATTACHMENT_ID)
    .venueType(VenueType.CEX)
    .exchange(EXCHANGE)
    .segment(SEGMENT)
    .type(type)
    .instruments(
      [...strategy.instruments]
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((symbol) => Instrument.parse(symbol)),
    )
    .warmingUp(false)
    .build();
}

/**
 * Tells the strategy its source is gone, at the owner's will.
 *
 * When the replay itself failed (`replayCompleted` is false) a failure of the hook is dropped, so
 * it cannot replace the error that ended the run.
 */
function detach(strategy: Strategy, attachment: StrategyContext, replayCompleted: boolean): void {
  try {
    strategy.onDetach?.(attachment.detached(StrategyContext.REASON_OWNER));
  } catch (error) {
    if (replayCompleted) throw error;
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
