import type { Ticker } from "@qtsurfer/core";
import type { MarketHintSignal } from "$signal/MarketHintSignal";

/**
 * Pluggable fill timing policy. Controls *when* a signal turns into a fill
 * and *at what reference price* before slippage is applied.
 *
 *  - `isImmediate(signal)` — return true to fill on the current pipeline state
 *    (legacy behavior), false to defer until a later ticker.
 *  - `resolvePending(signal, ticker)` — called on every subsequent ticker while
 *    the signal is deferred. Return the reference fill price, or `null` to keep
 *    waiting.
 *
 * The pipeline's `SlippageModel` is applied on top of whichever price the
 * policy returns — policies therefore control fill timing, not the
 * microstructure adjustment.
 */
export interface FillPolicy {
  isImmediate(signal: MarketHintSignal): boolean;
  resolvePending(signal: MarketHintSignal, ticker: Ticker): number | null;
}

/**
 * Default policy: fill at `signal.price` on the bar that produced the signal.
 * Keeps the original synchronous behavior and is what the pipeline uses when
 * no custom policy is supplied.
 */
export class ImmediateFill implements FillPolicy {
  isImmediate(): boolean {
    return true;
  }

  resolvePending(): number | null {
    return null;
  }
}

/**
 * Defers every signal to the *next* ticker and fills at that ticker's open.
 * Classic defense against the look-ahead bias of "signal emitted at bar close,
 * filled at the same bar's close price".
 *
 * If a deferred bar has no `open` value, falls back to the original
 * `signal.price` rather than blocking the queue indefinitely.
 */
export class NextBarOpenFill implements FillPolicy {
  isImmediate(): boolean {
    return false;
  }

  resolvePending(signal: MarketHintSignal, ticker: Ticker): number | null {
    return ticker.open ?? signal.price;
  }
}
