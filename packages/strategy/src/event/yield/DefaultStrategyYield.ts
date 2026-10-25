import type { StrategyYield } from "./StrategyYield";

/**
 * Default implementation of StrategyYield.
 * yield = output - input, yieldPercent = (yield / input) * 100
 */
export class DefaultStrategyYield implements StrategyYield {
  readonly instrument: string;
  readonly currency: string;
  readonly input: number;
  readonly output: number;
  readonly timestamp: number;

  constructor(
    instrument: string,
    currency: string,
    input: number,
    output: number,
    timestamp: number,
  ) {
    this.instrument = instrument;
    this.currency = currency;
    this.input = input;
    this.output = output;
    this.timestamp = timestamp;
  }

  getYield(): number {
    return this.output - this.input;
  }

  getYieldPercent(): number {
    if (this.input === 0) return 0;
    return ((this.output - this.input) / this.input) * 100;
  }
}
