import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { VarianceRTIndicator, type VariancePrecision } from "./VarianceRTIndicator";

/**
 * Standard Deviation RT Indicator — sqrt(variance).
 * Port of com.wualabs.qtsurfer.engine.indicators.statistics.StandardDeviationRTIndicator
 */
export class StandardDeviationRTIndicator extends AbstractRTIndicator {
  private readonly _variance: VarianceRTIndicator;

  constructor();
  constructor(periods: number);
  constructor(indicator: RTIndicator | null, periods: number);
  constructor(indicatorOrPeriods?: RTIndicator | number | null, periods?: number) {
    super();
    if (typeof indicatorOrPeriods === "number") {
      this._variance = new VarianceRTIndicator(null, indicatorOrPeriods);
    } else if (indicatorOrPeriods != null || periods != null) {
      this._variance = new VarianceRTIndicator(
        indicatorOrPeriods ?? null,
        periods ?? 0,
      );
    } else {
      this._variance = new VarianceRTIndicator();
    }
  }

  get variance(): VarianceRTIndicator {
    return this._variance;
  }

  get sma() {
    return this._variance.sma;
  }

  override isReady(): boolean {
    return this._variance.isReady();
  }

  override reset(): void {
    super.reset();
    this._variance.reset();
  }

  withAverageSample(averageSample: boolean): this {
    this._variance.withAverageSample(averageSample);
    return this;
  }

  /** Chooses how the variance behind the deviation is worked out: `"exact"` (the default) or the O(1) `"fast"`. */
  withPrecision(precision: VariancePrecision): this {
    this._variance.withPrecision(precision);
    return this;
  }

  get precision(): VariancePrecision {
    return this._variance.precision;
  }

  override update(newValue: number): number {
    let v = this._variance.update(newValue);
    if (v < 0) {
      v = 0;
    }
    return this.setValue(v === 0 ? 0 : Math.sqrt(v));
  }
}
