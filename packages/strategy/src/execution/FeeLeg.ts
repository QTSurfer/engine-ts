/**
 * Which leg of the instrument pair a backtest fill's fee is charged on.
 * Orthogonal to the per-side fee RATE (`feeRateBuy` / `feeRateSell`) and to the
 * maker/taker distinction: the rate says *how much*, the `FeeLeg` says *in which
 * asset*.
 *
 * Port of the engine's `FeeLeg` enum — the same three modes, same semantics.
 */
export enum FeeLeg {
  /**
   * Default. The fee is charged in the asset the fill *receives*: a BUY pays its
   * fee in the BASE asset (you receive slightly less base — `baseAmount * rate`),
   * a SELL in the QUOTE asset (`baseAmount * price * rate`). This is the everyday
   * spot mechanic (Binance, Coinbase) and the canonical default the conformance
   * fixtures encode.
   */
  RECEIVED = "RECEIVED",

  /**
   * The fee is always charged in the QUOTE asset on both sides
   * (`baseAmount * price * rate`) — the convention for perpetual/derivatives
   * venues (USDT-settled) and for simplified cash-PnL backtests. The buy fee is
   * reserved out of the all-in cash at sizing (`base / (1 + feeRate)`) so the
   * balance never goes negative.
   */
  QUOTE = "QUOTE",

  /**
   * The fee is always charged in the BASE asset on both sides. RESERVED: no real
   * venue charges spot fees this way, so it is not implemented — selecting it
   * throws until a concrete need appears (kept as an enum slot so the contract is
   * closed and forward-compatible).
   */
  BASE = "BASE",
}
