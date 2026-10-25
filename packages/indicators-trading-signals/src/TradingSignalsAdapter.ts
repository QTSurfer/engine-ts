import type { RTIndicator } from "@qtsurfer/indicators";

/**
 * Minimal interface matching trading-signals TechnicalIndicator.
 */
interface TechnicalIndicator {
  update(value: number, replace: boolean): unknown;
  getResult(): unknown;
  isStable: boolean;
}

/**
 * Generic adapter wrapping any trading-signals indicator into RTIndicator.
 * Allows direct comparison in tests and benchmarks.
 *
 * @param factory - creates a fresh indicator instance (used for reset)
 * @param extractValue - extracts a number from the indicator result
 *   (default: Number(result), override for compound results like MACD/Bollinger)
 */
export class TradingSignalsAdapter implements RTIndicator {
  private ts: TechnicalIndicator;
  private value = 0;
  private ready = false;

  constructor(
    private readonly factory: () => TechnicalIndicator,
    private readonly extractValue: (result: unknown) => number = (r) =>
      Number(r),
  ) {
    this.ts = factory();
  }

  update(newValue: number): number {
    const result = this.ts.update(newValue, false);
    if (result != null) {
      this.value = this.extractValue(result);
      this.ready = this.ts.isStable;
    } else {
      this.value = 0;
      this.ready = false;
    }
    return this.value;
  }

  getValue(): number {
    return this.value;
  }

  isReady(): boolean {
    return this.ready;
  }

  reset(): void {
    this.ts = this.factory();
    this.value = 0;
    this.ready = false;
  }
}
