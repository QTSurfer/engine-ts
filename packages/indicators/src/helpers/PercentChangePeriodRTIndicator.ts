import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/** An indicator that counts the periods of its sequence, as the period counters do. */
export interface PeriodCounted {
  readonly periodCount: number;
}

/**
 * The change of a value over the periods of a sequence, as a fraction of the value the sequence
 * started at: the value of the indicator it wraps (a gain, a loss or a period counter), divided
 * by the first value of the sequence. A zero first value is taken as 100.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.PercentChangePeriodRTIndicator
 */
export class PercentChangePeriodRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  /** The baseline a zero first value is replaced with, so the ratio stays defined. */
  static readonly DEFAULT_ZERO_BASELINE = 100;

  private readonly periodCounter: RTIndicator & PeriodCounted;
  private initialValue = 0;

  constructor(indicator: RTIndicator & PeriodCounted) {
    super(indicator);
    this.periodCounter = indicator;
  }

  get periodCount(): number {
    return this.periodCounter.periodCount;
  }

  getInitialValue(): number {
    return this.initialValue;
  }

  getPercentChange(): number {
    return this.getValue() * 100;
  }

  override update(newValue: number): number {
    const change = super.update(newValue);
    if (this.periodCounter.periodCount === 0) {
      // A new sequence: its first value is the baseline
      this.initialValue = newValue;
      return this.setValue(0);
    }
    if (this.initialValue === 0) {
      this.initialValue = PercentChangePeriodRTIndicator.DEFAULT_ZERO_BASELINE;
    }
    return this.setValue(change / this.initialValue);
  }
}
