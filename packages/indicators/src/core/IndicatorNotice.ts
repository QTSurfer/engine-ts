/**
 * A diagnostic an indicator group raises about its own wiring: it names the indicator concerned and
 * the instrument whose group raised it.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.IndicatorNotice
 *
 * A notice is data, not an exception: the group keeps computing, and the caller reads the notices
 * with `getNotices()` when it wants them.
 */
export interface IndicatorNotice {
  /** How much attention this deserves. */
  readonly level: "INFO" | "WARN" | "ERROR";
  /** Stable, greppable identifier: callers may switch on it. */
  readonly code: string;
  /** The registered name of the indicator concerned. */
  readonly indicatorName: string;
  /** The instrument whose group raised it. */
  readonly instrument: string;
  /** Human-readable explanation, safe to show to a strategy author. */
  readonly message: string;
}

/**
 * Raised when an indicator that needs per-bar data is fed from a ticker stream, where volume and
 * high/low are 24-hour rolling statistics. A warning, not an error: the indicator still produces
 * numbers, and a strategy may accept them knowingly.
 */
export const BAR_DATA_ON_TICKER_PATH = "indicator.bar-data-on-ticker-path";

/** Builds the {@link BAR_DATA_ON_TICKER_PATH} notice. */
export function barDataOnTickerPath(indicatorName: string, instrument: string): IndicatorNotice {
  return {
    level: "WARN",
    code: BAR_DATA_ON_TICKER_PATH,
    indicatorName,
    instrument,
    message:
      `indicator '${indicatorName}' needs per-bar OHLCV but is bound to a ticker stream, where volume and ` +
      "high/low are the exchange's 24h rolling statistics rather than this bar's — its values will look " +
      "plausible and mean nothing; drive it from a kline strategy (AbstractKlineStrategy) instead",
  };
}

/** What makes a notice unique: the condition and the indicator it concerns. */
export function noticeKey(notice: IndicatorNotice): string {
  return JSON.stringify([notice.code, notice.indicatorName]);
}
