import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Update counter RT Indicator.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.CountRTIndicator
 */
export class CountRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private _updateCount: number;

  constructor();
  constructor(indicator: RTIndicator);
  constructor(updateCount: number, indicator: RTIndicator | null);
  constructor(
    updateCountOrIndicator?: number | RTIndicator,
    indicator?: RTIndicator | null,
  ) {
    if (typeof updateCountOrIndicator === "number") {
      super(0, indicator ?? null);
      this._updateCount = updateCountOrIndicator;
    } else {
      super(updateCountOrIndicator as RTIndicator);
      this._updateCount = 0;
    }
  }

  get updateCount(): number {
    return this._updateCount;
  }

  override reset(): void {
    super.reset();
    this._updateCount = 0;
  }

  override update(newValue: number): number {
    this._updateCount++;
    return super.update(newValue);
  }
}
