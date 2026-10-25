import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Combines two indicators through a binary function.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.BiFunctionRTIndicator
 */
export class BiFunctionRTIndicator extends AbstractRTIndicator {
  private readonly indicatorA: RTIndicator;
  private readonly indicatorB: RTIndicator;
  private readonly fn: (a: number, b: number) => number;

  constructor(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
    fn: (a: number, b: number) => number,
  ) {
    super();
    this.indicatorA = indicatorA;
    this.indicatorB = indicatorB;
    this.fn = fn;
  }

  override update(newValue: number): number {
    return this.setValue(
      this.fn(this.indicatorA.update(newValue), this.indicatorB.update(newValue)),
    );
  }

  /** Ready when both operands are: the result combines the two of them. */
  override isReady(): boolean {
    return this.indicatorA.isReady() && this.indicatorB.isReady();
  }

  override reset(): void {
    super.reset();
    this.indicatorA.reset();
    this.indicatorB.reset();
  }

  static plus(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    return new BiFunctionRTIndicator(indicatorA, indicatorB, (a, b) => a + b);
  }

  static minus(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    return new BiFunctionRTIndicator(indicatorA, indicatorB, (a, b) => a - b);
  }

  static multiply(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    return new BiFunctionRTIndicator(indicatorA, indicatorB, (a, b) => a * b);
  }

  static divide(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    // A zero divisor gives ±Infinity and a non-finite operand NaN, both absorbing downstream: any
    // quotient that is not finite is 0, as in the Java engine
    return new BiFunctionRTIndicator(indicatorA, indicatorB, (a, b) => {
      const result = a / b;
      return Number.isFinite(result) ? result : 0;
    });
  }

  static max(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    return new BiFunctionRTIndicator(indicatorA, indicatorB, Math.max);
  }

  static min(
    indicatorA: RTIndicator,
    indicatorB: RTIndicator,
  ): BiFunctionRTIndicator {
    return new BiFunctionRTIndicator(indicatorA, indicatorB, Math.min);
  }
}
