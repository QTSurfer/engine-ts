import type { RTIndicator } from "$core/RTIndicator";
import { PeriodCounterRTIndicator } from "./PeriodCounterRTIndicator";

/**
 * Tracks positive price changes (gains) between consecutive updates.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.GainRTIndicator
 */
export class GainRTIndicator extends PeriodCounterRTIndicator {
  private _resetPeriodsOnSustain = true;

  constructor(indicator?: RTIndicator | null) {
    super(indicator);
  }

  get resetPeriodsOnSustain(): boolean {
    return this._resetPeriodsOnSustain;
  }

  setResetPeriodsOnSustain(value: boolean): this {
    this._resetPeriodsOnSustain = value;
    return this;
  }

  protected override initValue(_initValue: number): number {
    return 0;
  }

  protected override getPrevValue(): number {
    return this.lastUpdateValue;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    if (newValue > prevValue) {
      this.incPeriods();
      return newValue - prevValue;
    }
    if (newValue === prevValue) {
      if (this._resetPeriodsOnSustain) {
        this.resetPeriods();
      }
    } else {
      this.resetPeriods();
    }
    return 0;
  }
}
