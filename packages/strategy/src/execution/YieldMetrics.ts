import type { AbstractStrategy } from "../AbstractStrategy";
import type { StrategyYield } from "$yield/StrategyYield";
import type { EquityPoint } from "./SessionOutput";

const MILLIS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Span, in years, below which {@link YieldMetrics.getCagr} does not annualize. Raising the
 * equity ratio to `1 / years` grows without bound as the window shrinks (a 2-day window already
 * gives an exponent near 182), so a sub-year window reports the plain equity return instead.
 */
const MIN_CAGR_ANNUALIZATION_YEARS = 1;

/** Fixed 7-day window length, in milliseconds, used to bucket per-yield PnL into {@link YieldMetricsSnapshot.weeklyReturns}. */
const MILLIS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Bucket widths tried by {@link YieldMetrics.getAdaptivePeriodReturns}, coarsest first: the
 * coarsest that still gives {@link MIN_TARGET_BUCKETS} over the range, else the finest. A backtest
 * window of a few days gives one or two weekly buckets, too few to say anything about a
 * distribution. As in the Java engine.
 */
const ADAPTIVE_BUCKET_WIDTHS_MS = [MILLIS_PER_WEEK, 86_400_000, 3_600_000, 60_000];

/** Bucket count the adaptive width aims for. */
const MIN_TARGET_BUCKETS = 20;

function adaptiveBucketWidth(spanMillis: number): number {
  for (const width of ADAPTIVE_BUCKET_WIDTHS_MS) {
    if (Math.floor(spanMillis / width) + 1 >= MIN_TARGET_BUCKETS) {
      return width;
    }
  }
  return ADAPTIVE_BUCKET_WIDTHS_MS[ADAPTIVE_BUCKET_WIDTHS_MS.length - 1];
}

/**
 * Snapshot of computed metrics at a point in time.
 *
 * Scales: a field whose name ends in `Percent` is on a 0-100 scale; `winRate` and `cagr` are
 * ratios (0.15 means 15%); `sharpeRatio` and `sortinoRatio` are unitless.
 */
export interface YieldMetricsSnapshot {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  /** Ratio, 0-1. A trade is a win when its yield is strictly greater than zero. */
  winRate: number;
  pnlTotal: number;
  /** `pnlTotal` as a percentage of the initial equity, 0 when there is no initial equity. */
  pnlTotalPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  /**
   * Compound annual growth rate as a ratio (0.15 for 15%). Windows shorter than one year are
   * not annualized: they report the plain equity return.
   */
  cagr: number;
  maxDrawdown: number;
  /** Largest peak-to-trough fall of the equity, 0-100. */
  maxDrawdownPercent: number;
  /**
   * Running equity after each yield (initialEquity + cumulative PnL), one point
   * per trade.
   */
  equityCurve: number[];
  /**
   * `equityCurve` with the timestamp of each yield: the same running equity, one point per trade.
   * It starts at the first trade, with no point for the start of the session.
   */
  equityPoints: EquityPoint[];
  /**
   * Per-yield PnL bucketed into fixed 7-day windows measured from the first
   * yield's timestamp (not ISO calendar weeks, so the vector is timezone-
   * independent and reproducible bit-for-bit from the yields alone). Dense:
   * empty windows are 0, and the vector sums back to `pnlTotal`. Empty when
   * no yields have been received.
   */
  weeklyReturns: number[];
}

/**
 * Accumulates strategy yields and computes performance metrics.
 * Port of com.wualabs.qtsurfer.engine.strategy.execution.YieldMetrics
 */
export class YieldMetrics {
  private readonly returns: number[] = [];
  private winCount = 0;
  private lossCount = 0;
  private readonly yields: StrategyYield[] = [];
  private readonly equityCurve: number[] = [];
  private readonly equityPoints: EquityPoint[] = [];
  private unsubscribe: (() => void) | null = null;

  private peakEquity = 0;
  private currentEquity = 0;
  private _maxDrawdown = 0;
  private _maxDrawdownPercent = 0;
  private initialEquity = 0;
  private firstTimestamp = 0;
  private lastTimestamp = 0;

  constructor(strategy: AbstractStrategy, initialEquity?: number) {
    this.initialEquity = initialEquity ?? 0;
    this.currentEquity = this.initialEquity;
    this.peakEquity = this.initialEquity;

    this.unsubscribe = strategy.onYield((y) => this.addYield(y));
  }

  addYield(y: StrategyYield): void {
    this.yields.push(y);
    this.returns.push(y.getYieldPercent());

    const pnl = y.getYield();
    // A trade is a win when its yield is strictly positive; a zero-yield trade is a loss.
    if (pnl > 0) {
      this.winCount++;
    } else {
      this.lossCount++;
    }
    this.currentEquity += pnl;
    this.equityCurve.push(this.currentEquity);
    this.equityPoints.push({ timestamp: y.timestamp, equity: this.currentEquity });

    if (this.firstTimestamp === 0) this.firstTimestamp = y.timestamp;
    this.lastTimestamp = y.timestamp;

    if (this.currentEquity > this.peakEquity) {
      this.peakEquity = this.currentEquity;
    }

    const drawdown = this.peakEquity - this.currentEquity;
    if (drawdown > this._maxDrawdown) {
      this._maxDrawdown = drawdown;
    }

    if (this.peakEquity > 0) {
      const drawdownPercent = (drawdown / this.peakEquity) * 100;
      if (drawdownPercent > this._maxDrawdownPercent) {
        this._maxDrawdownPercent = drawdownPercent;
      }
    }
  }

  getTotalTrades(): number {
    return this.yields.length;
  }

  getWinCount(): number {
    return this.winCount;
  }

  getLossCount(): number {
    return this.lossCount;
  }

  getWinRate(): number {
    if (this.yields.length === 0) return 0;
    return this.winCount / this.yields.length;
  }

  getPnlTotal(): number {
    return this.yields.reduce((sum, y) => sum + y.getYield(), 0);
  }

  getPnlTotalPercent(): number {
    return this.initialEquity === 0 ? 0 : (this.getPnlTotal() / this.initialEquity) * 100;
  }

  getSharpeRatio(): number {
    if (this.returns.length < 2) return 0;
    const mean = this.mean(this.returns);
    const std = this.stdDev(this.returns, mean);
    if (std === 0) return 0;
    return mean / std;
  }

  getSortinoRatio(): number {
    if (this.returns.length < 2) return 0;
    const mean = this.mean(this.returns);
    const downside = this.downsideStdDev(this.returns);
    if (downside === 0) return 0;
    return mean / downside;
  }

  /**
   * Compound annual growth rate, equity-based, as a ratio: `0.15` means 15%. The span runs from
   * the first to the last trade, in years of 365.25 days. Returns 0 when there is no positive
   * initial equity, the equity is not positive, or no time has passed.
   *
   * A span shorter than one year is not annualized: it returns the plain equity return
   * (`finalEquity / initialEquity - 1`), which is what the annualized formula gives at exactly
   * one year, so the two meet without a jump at the floor.
   */
  getCagr(): number {
    if (this.initialEquity <= 0 || this.currentEquity <= 0) return 0;
    if (this.firstTimestamp === 0 || this.lastTimestamp <= this.firstTimestamp) return 0;

    const durationYears = (this.lastTimestamp - this.firstTimestamp) / MILLIS_PER_YEAR;
    const totalReturn = this.currentEquity / this.initialEquity;
    if (durationYears < MIN_CAGR_ANNUALIZATION_YEARS) return totalReturn - 1;

    return Math.pow(totalReturn, 1 / durationYears) - 1;
  }

  getMaxDrawdown(): number {
    return this._maxDrawdown;
  }

  getMaxDrawdownPercent(): number {
    return this._maxDrawdownPercent;
  }

  getYields(): readonly StrategyYield[] {
    return this.yields;
  }

  getEquityCurve(): readonly number[] {
    return this.equityCurve;
  }

  /** The equity curve with each yield's timestamp, one point per trade: see {@link YieldMetricsSnapshot.equityPoints}. */
  getEquityPoints(): readonly EquityPoint[] {
    return this.equityPoints;
  }

  /**
   * Coarse-grained PnL returns bucketed into fixed {@link MILLIS_PER_WEEK}-ms
   * (7-day) windows, measured from the first yield's timestamp. Element `i`
   * is the sum of every yield's PnL whose timestamp falls in
   * `[firstTimestamp + i*week, firstTimestamp + (i+1)*week)`. Empty windows
   * are `0` so the vector is dense and contiguous. Empty when no yields have
   * been received.
   */
  getWeeklyReturns(): number[] {
    if (this.yields.length === 0) return [];

    const span = this.lastTimestamp - this.firstTimestamp;
    const bucketCount = Math.floor(span / MILLIS_PER_WEEK) + 1;
    const buckets = new Array<number>(bucketCount).fill(0);
    for (const y of this.yields) {
      const bucket = Math.floor((y.timestamp - this.firstTimestamp) / MILLIS_PER_WEEK);
      buckets[bucket] += y.getYield();
    }
    return buckets;
  }

  /**
   * Per-period PnL over the range `[rangeStartMillis, rangeEndMillis)`, in buckets of an adaptive
   * width: the coarsest of a week, a day, an hour and a minute that still gives 20 buckets over
   * the range. The range is the replayed data's span, not this run's first and last trade, so every
   * run over the same data shares the bucket boundaries. Dense: empty buckets are 0. Empty when no
   * yields were received. As the Java engine's `getAdaptivePeriodReturns`.
   */
  getAdaptivePeriodReturns(rangeStartMillis: number, rangeEndMillis: number): number[] {
    if (this.yields.length === 0) return [];

    const span = Math.max(0, rangeEndMillis - rangeStartMillis);
    const width = adaptiveBucketWidth(span);
    const bucketCount = Math.floor(span / width) + 1;
    const buckets = new Array<number>(bucketCount).fill(0);
    for (const y of this.yields) {
      // A yield falls within the replayed range by construction; the clamp only guards its edges
      const bucket = Math.min(Math.max(Math.trunc((y.timestamp - rangeStartMillis) / width), 0), bucketCount - 1);
      buckets[bucket] += y.getYield();
    }
    return buckets;
  }

  /**
   * Every metric at this point. Given the replayed data's range, `weeklyReturns` comes from
   * {@link getAdaptivePeriodReturns} over it, as the Java engine's runner reports it; without
   * one, from the fixed 7-day buckets.
   */
  snapshot(rangeStartMillis?: number, rangeEndMillis?: number): YieldMetricsSnapshot {
    return {
      totalTrades: this.getTotalTrades(),
      winCount: this.getWinCount(),
      lossCount: this.getLossCount(),
      winRate: this.getWinRate(),
      pnlTotal: this.getPnlTotal(),
      pnlTotalPercent: this.getPnlTotalPercent(),
      sharpeRatio: this.getSharpeRatio(),
      sortinoRatio: this.getSortinoRatio(),
      cagr: this.getCagr(),
      maxDrawdown: this.getMaxDrawdown(),
      maxDrawdownPercent: this.getMaxDrawdownPercent(),
      equityCurve: [...this.equityCurve],
      equityPoints: this.equityPoints.map((point) => ({ ...point })),
      weeklyReturns:
        rangeStartMillis !== undefined && rangeEndMillis !== undefined
          ? this.getAdaptivePeriodReturns(rangeStartMillis, rangeEndMillis)
          : this.getWeeklyReturns(),
    };
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // --- Stats helpers ---

  private mean(values: number[]): number {
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private downsideStdDev(values: number[]): number {
    const negatives = values.filter((v) => v < 0);
    if (negatives.length === 0) return 0;
    const variance =
      negatives.reduce((s, v) => s + v ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
