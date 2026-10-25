/**
 * Pluggable fee model for the backtest execution pipeline.
 *
 * Called once per fill (buy or sell). Returns the fee amount to deduct in the
 * counter currency. Implementations should be stateless — any accounting
 * (tiered volume, volume-weighted maker/taker routing, …) that requires
 * tracking history must be handled inside the model itself.
 */
export interface FeeContext {
  /** Effective fill price per unit after slippage. */
  readonly price: number;
  /** Amount of base asset being traded (positive). */
  readonly baseAmount: number;
  /** Gross counter amount (price * baseAmount), before fees. */
  readonly counterAmount: number;
  /** Side of the fill. */
  readonly side: "buy" | "sell";
  /**
   * Liquidity role of the fill.
   *  - `"maker"`: passive fill at a resting price (limit orders that got
   *    their target). Does not sweep the book.
   *  - `"taker"`: active fill that consumed book liquidity (market orders,
   *    triggered stops, triggered trailing stops).
   * Models that don't care about this can ignore the field.
   */
  readonly liquidity: "maker" | "taker";
  /** Timestamp of the originating signal (ms since epoch). */
  readonly timestamp: number;
  /** Instrument being traded. */
  readonly instrument: string;
}

export interface FeeModel {
  compute(ctx: FeeContext): number;
}

/**
 * Flat per-side fee rate applied to the gross counter amount.
 * Set either side to 0 for fee-free trades on that side.
 * Ignores the maker/taker distinction.
 */
export class FixedFeeModel implements FeeModel {
  constructor(
    private readonly buyRate: number,
    private readonly sellRate: number,
  ) {}

  compute(ctx: FeeContext): number {
    const rate = ctx.side === "buy" ? this.buyRate : this.sellRate;
    return ctx.counterAmount * rate;
  }
}

/**
 * Exchange-style maker/taker fee schedule. Limit fills on the pipeline are
 * routed as maker; market, stop and trailing-stop fills are taker.
 *
 * When the schedule is symmetric across buy/sell, both rates collapse to a
 * single pair. For asymmetric schedules, wrap this model or write a custom
 * `FeeModel` that consults `ctx.side` in addition to `ctx.liquidity`.
 */
export class MakerTakerFeeModel implements FeeModel {
  constructor(
    private readonly makerRate: number,
    private readonly takerRate: number,
  ) {}

  compute(ctx: FeeContext): number {
    const rate = ctx.liquidity === "maker" ? this.makerRate : this.takerRate;
    return ctx.counterAmount * rate;
  }
}
