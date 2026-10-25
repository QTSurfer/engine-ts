import { FeeLeg } from "./FeeLeg";
import type { FeeModel } from "./simulation/FeeModel";
import type { FillPolicy } from "./simulation/FillPolicy";
import type { SlippageModel } from "./simulation/SlippageModel";

/**
 * Configuration for backtest execution.
 *
 * The core fields (`initialFunding`, `feeRate`, `currency`) drive the canonical
 * both-side fee model: `feeRate` is the shared rate applied to BOTH the buy and
 * the sell side unless a per-side override is set. The remaining fields are
 * opt-in simulation knobs: when omitted, behavior is unchanged.
 *
 * Advanced users can supply their own `feeModel` / `slippageModel` instances
 * to plug in richer logic (maker/taker, volume-tiered fees, bar-range
 * slippage). When set, they take precedence over the flat-rate shortcuts.
 */
export interface BacktestConfig {
  /** Initial funding in counter currency (e.g., USD) */
  initialFunding: number;
  /**
   * Shared fee rate as a decimal (e.g., 0.001 = 0.1%). Applied to BOTH sides
   * unless a per-side override (`feeRateBuy` / `feeRateSell`) is set — the
   * canonical contract charges every fill (engine parity).
   */
  feeRate: number;
  /** Counter currency identifier */
  currency: string;

  /**
   * Buy-side fee rate. Defaults to {@link feeRate} when omitted, so single-rate
   * configs charge buy == sell (canonical both-side fees). Set to model an
   * exchange whose buy/sell rates differ.
   * Ignored when `feeModel` is supplied.
   */
  feeRateBuy?: number;
  /**
   * Sell-side fee rate. Defaults to {@link feeRate} when omitted (buy == sell).
   * Ignored when `feeModel` is supplied.
   */
  feeRateSell?: number;
  /**
   * Which leg of the pair fees are charged on. Defaults to
   * {@link FeeLeg.RECEIVED}: buy fee in BASE, sell fee in QUOTE (the everyday
   * spot mechanic). {@link FeeLeg.QUOTE} charges both sides in QUOTE
   * (perps / cash-PnL) and reserves the buy fee out of the all-in cash at
   * sizing so the balance never goes negative. {@link FeeLeg.BASE} is reserved
   * and throws.
   */
  feeLeg?: FeeLeg;
  /**
   * Fixed slippage in basis points (1 bps = 0.01%).
   * Buy fills at price * (1 + bps/10000), sell fills at price * (1 - bps/10000).
   * Omit (or 0) to fill exactly at signal price.
   * Ignored when `slippageModel` is supplied.
   */
  slippageBps?: number;
  /**
   * Percentage of available balance spent on a buy signal (0–100).
   * Defaults to 100 (all-in). Residual cash stays in balance.
   */
  buyPercent?: number;

  /**
   * Custom fee model. When provided, replaces the legacy `feeRate*` fields.
   */
  feeModel?: FeeModel;
  /**
   * Custom slippage model. When provided, replaces `slippageBps`.
   * Models that consult bar high/low require the runner to call
   * `pipeline.onTicker(ticker)` before each `strategy.update(ticker)` —
   * `BacktestRunner` already does this.
   */
  slippageModel?: SlippageModel;
  /**
   * Fill timing policy. Defaults to `ImmediateFill` (legacy: fill on the bar
   * that produced the signal at `signal.price`). Use `NextBarOpenFill` to
   * defer every signal to the next bar's open and remove the look-ahead bias
   * of bar-close strategies.
   */
  fillPolicy?: FillPolicy;
}
