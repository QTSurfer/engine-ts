import type { Ticker } from "@qtsurfer/core";

/**
 * Pluggable slippage model. Called once per fill to adjust the signal price
 * into the effective fill price. Return the adjusted price (not a delta).
 *
 * Buy slippage should raise the price; sell slippage should lower it — the
 * convention is that slippage is always adverse to the trader.
 */
export interface SlippageContext {
  readonly side: "buy" | "sell";
  readonly signalPrice: number;
  /** Current ticker when the fill resolves. May be null when unavailable. */
  readonly ticker: Ticker | null;
}

export interface SlippageModel {
  adjust(ctx: SlippageContext): number;
}

/** Zero slippage — returns the signal price unchanged. */
export class NoSlippage implements SlippageModel {
  adjust(ctx: SlippageContext): number {
    return ctx.signalPrice;
  }
}

/**
 * Fixed adverse slippage in basis points (1 bps = 0.01%).
 * Buy: price * (1 + bps/10000). Sell: price * (1 - bps/10000).
 */
export class FixedBpsSlippage implements SlippageModel {
  constructor(private readonly bps: number) {}

  adjust(ctx: SlippageContext): number {
    const factor = this.bps / 10_000;
    return ctx.side === "buy"
      ? ctx.signalPrice * (1 + factor)
      : ctx.signalPrice * (1 - factor);
  }
}

/**
 * Slippage bounded by the current bar's high/low.
 *
 * The `bias` parameter (0..1) interpolates between the signal price (0, best)
 * and the adverse extreme of the bar (1, worst): bar high for buys, bar low
 * for sells. A market order that sweeps a thin bar will land closer to the
 * extreme; set `bias` near 1 to simulate that.
 *
 * Falls back to the signal price when the ticker is missing high or low.
 */
export class BarRangeSlippage implements SlippageModel {
  constructor(private readonly bias: number = 0.5) {}

  adjust(ctx: SlippageContext): number {
    const t = ctx.ticker;
    if (!t) return ctx.signalPrice;

    const b = clamp01(this.bias);
    if (ctx.side === "buy") {
      if (t.high == null) return ctx.signalPrice;
      const headroom = Math.max(0, t.high - ctx.signalPrice);
      return ctx.signalPrice + b * headroom;
    }
    if (t.low == null) return ctx.signalPrice;
    const headroom = Math.max(0, ctx.signalPrice - t.low);
    return ctx.signalPrice - b * headroom;
  }
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
