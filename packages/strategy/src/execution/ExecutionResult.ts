/**
 * Simplified execution result for backtest fills.
 * Represents the outcome of a simulated order fill.
 */
export class ExecutionResult {
  /** Fill price per unit */
  readonly price: number;
  /** Gross amount of base asset traded (e.g., BTC), before fees */
  readonly baseAmount: number;
  /** Gross amount of counter/quote asset traded (e.g., USD), before fees */
  readonly counterAmount: number;
  /**
   * Fee amount, expressed in the leg the fee actually landed on: under
   * {@link FeeLeg.RECEIVED} this is BASE currency on buys and QUOTE currency on
   * sells; under {@link FeeLeg.QUOTE} it is always QUOTE.
   */
  readonly feeAmount: number;

  constructor(
    price: number,
    baseAmount: number,
    counterAmount: number,
    feeAmount: number,
  ) {
    this.price = price;
    this.baseAmount = baseAmount;
    this.counterAmount = counterAmount;
    this.feeAmount = feeAmount;
  }

  /**
   * Net counter amount after fees — meaningful when the fee is QUOTE-denominated
   * (RECEIVED sells, and both QUOTE-mode sides).
   */
  getNetCounterAmount(): number {
    return this.counterAmount - this.feeAmount;
  }

  /**
   * Net base amount after fees — meaningful ONLY when the fee is BASE-denominated
   * (RECEIVED buys), where the position holds `baseAmount - feeAmount`. When the
   * fee is on the quote leg the position holds the full gross `baseAmount`, so
   * callers must not use this helper there (the pipeline guards on `feeLeg`).
   */
  getNetBaseAmount(): number {
    return this.baseAmount - this.feeAmount;
  }
}
