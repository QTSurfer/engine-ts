import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Incremental indicator that counts consecutive periods.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.PeriodCounterRTIndicator
 */
export class PeriodCounterRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private _periodCount = 0;

  constructor(indicator?: RTIndicator | null) {
    super(0, indicator ?? null);
  }

  get periodCount(): number {
    return this._periodCount;
  }

  resetPeriods(): void {
    this._periodCount = 0;
  }

  protected incPeriods(): void {
    this._periodCount++;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    this.incPeriods();
    return super.nextValue(prevValue, newValue);
  }
}
