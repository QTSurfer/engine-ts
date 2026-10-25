import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { WindowSeriesStore } from "@qtsurfer/core";

/**
 * Min value RT Indicator. With no periods it tracks the all-time minimum; with periods it tracks
 * the rolling minimum of the last `periods` inputs.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.MinRTIndicator
 */
export class MinRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private readonly window: WindowSeriesStore | null;

  constructor();
  constructor(periods: number);
  constructor(indicator: RTIndicator);
  constructor(periods: number, indicator: RTIndicator | null);
  constructor(periodsOrIndicator?: number | RTIndicator, indicator?: RTIndicator | null) {
    if (typeof periodsOrIndicator === "number") {
      super(periodsOrIndicator, indicator ?? null);
    } else if (periodsOrIndicator != null) {
      super(0, periodsOrIndicator);
    } else {
      super(0);
    }
    this.window = this.periods > 0 ? new WindowSeriesStore(this.periods) : null;
  }

  override reset(): void {
    super.reset();
    this.window?.clear();
  }

  /** Windowed mode, called on every tick including the first: the window is seeded here. */
  protected override tickValue(_tick: number, _init: boolean, _endPeriod: boolean, newValue: number): number {
    const window = this.window!;
    window.add(newValue);
    let min = window.getValue(0);
    for (let i = 1; i < window.size; i++) {
      min = Math.min(min, window.getValue(i));
    }
    return min;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    if (newValue < prevValue) {
      return this.setValue(newValue);
    }
    return this.getValue();
  }
}
