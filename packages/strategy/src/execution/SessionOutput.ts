/**
 * What a chart and a results zone draw after a run, collected while the run replays: nothing
 * here needs another pass over the data.
 */

/** Options of a single run. */
export interface RunOptions {
  /**
   * Record each public indicator per data point into {@link SessionOutput.indicators}: `false`
   * (default), `true` for every public indicator, or a list of the indicator names to keep.
   */
  recordIndicators?: boolean | string[];
}

/** One indicator of one instrument, sampled at every data point of that instrument. */
export interface IndicatorSeries {
  instrument: string;
  /** The name the indicator is registered under in the strategy. */
  name: string;
  /** The indicator's type id (`ema`, `rsi`, ...). */
  id: string;
  /** How the value should be presented: on the price axis, on a percentage axis or as a volume. */
  display: "ABSOLUTE" | "PERCENT" | "VOLUME";
  /** The data timestamps (epoch ms) of this instrument, one per point. Shared by the series of one instrument. */
  timestamps: number[];
  /** One value per timestamp: `null` while the indicator is not ready. */
  values: (number | null)[];
}

/**
 * Why the execution pipeline dropped a buy or sell signal without a fill:
 *  - `already-long`: a buy while a position is open.
 *  - `no-position`: a sell while no position is open.
 *  - `no-funds`: a buy with no balance left.
 *  - `zero-size`: a buy that works out to nothing (`buyPercent` at 0).
 *  - `invalid-order`: an order the pipeline cannot work (a trailing stop with no distance to trail by).
 *  - `cancelled`: a queued `stop` order the strategy sent, removed when its instrument's position closed.
 */
export type IgnoredReason =
  | "already-long"
  | "no-position"
  | "no-funds"
  | "zero-size"
  | "invalid-order"
  | "cancelled";

/** A signal the strategy emitted, placed on the chart. */
export interface SessionMarker {
  timestamp: number;
  instrument: string;
  kind: "buy" | "sell" | "info";
  /** The signal's price: `null` for an info signal that carries none. */
  price: number | null;
  text: string;
  /** `market`, `limit`, `stop` or `stopTrailing`, on a buy or sell. */
  orderKind?: string;
  /** The key/value data of an info signal, as a plain object. */
  data?: Record<string, unknown>;
  /**
   * Set only on the marker of a buy or sell signal that the pipeline dropped without a fill (a
   * sell while flat, a second buy while long...): the strategy emitted it, the emulator did not
   * act on it. Absent on the markers of signals that filled, that are still queued when the run
   * ends and on info markers.
   */
  ignored?: { reason: IgnoredReason };
}

/** One point of the equity curve. */
export interface EquityPoint {
  timestamp: number;
  equity: number;
}

/** One simulated fill. */
export interface Fill {
  instrument: string;
  /** When the fill happened: the data time of the point it resolved on. */
  timestamp: number;
  side: "buy" | "sell";
  price: number;
  /** Gross base amount traded, before fees. */
  baseAmount: number;
  /** Gross counter (quote) amount traded, before fees. */
  counterAmount: number;
  /** The fee, in `feeAsset`. */
  fee: number;
  /** The asset the fee was charged in. */
  feeAsset: string;
  liquidity: "maker" | "taker";
  /** The kind of the order that produced the fill, a protective stop included. */
  orderKind: string;
}

/** One closed trade: an entry fill and the exit fill that closed it (or the part of it a sell closed). */
export interface Trade {
  instrument: string;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  /** Base amount sold by the exit. */
  baseAmount: number;
  /** The cost basis of the trade. */
  input: number;
  /** The realized proceeds, fees included. */
  output: number;
  pnl: number;
  /** `pnl` as a percentage of `input`, 0-100 scale. */
  pnlPercent: number;
  /** The order kind of the exit fill. */
  exitKind: string;
}

/** Everything a run produced beyond its KPIs. */
export interface SessionOutput {
  /** Empty unless {@link RunOptions.recordIndicators} asked for them. */
  indicators: IndicatorSeries[];
  markers: SessionMarker[];
  /**
   * The equity curve: a first point at the start of the session (the first data point replayed)
   * at the initial funding, then one point per closed trade at the time of its exit fill, so the
   * times only move forward.
   * Empty when there was no data.
   */
  equity: EquityPoint[];
  trades: Trade[];
  fills: Fill[];
}
