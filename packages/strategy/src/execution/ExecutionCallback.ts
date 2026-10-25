import type { ExecutionResult } from "./ExecutionResult";
import type { Fill, IgnoredReason } from "./SessionOutput";
import type { MarketHintSignal } from "$signal/MarketHintSignal";
import type { StrategyYield } from "$yield/StrategyYield";

/**
 * Callback interface for execution pipeline events.
 */
export interface ExecutionCallback {
  onFilledBuy(result: ExecutionResult): void;
  onFilledSell(result: ExecutionResult): void;
  /**
   * Every fill with its side, liquidity, time, fee and order kind, right after `onFilledBuy` /
   * `onFilledSell`: a sell's fill arrives before the yield it closes.
   */
  onFill?(fill: Fill): void;
  /**
   * A buy or sell signal the pipeline drops without a fill, with the reason: a sell while flat, a
   * second buy while long, a buy with no funds or a size of zero, a trailing stop with nothing to
   * trail by, or a queued `stop` order removed when the position closed. A queued order that
   * resolves into one of those states reports it when it resolves. The stop a filled entry
   * attaches is the pipeline's own order, not a signal, and is never reported.
   */
  onIgnored?(signal: MarketHintSignal, reason: IgnoredReason): void;
  onYield(strategyYield: StrategyYield): void;
}

/** No-op callback for when no external listener is needed. */
export const NOOP_CALLBACK: ExecutionCallback = {
  onFilledBuy() {},
  onFilledSell() {},
  onYield() {},
};
