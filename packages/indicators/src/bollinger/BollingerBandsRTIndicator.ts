import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { IndicatorMeta } from "$core/IndicatorMeta";
import type { RTIndicator } from "$core/RTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";
import type { VariancePrecision } from "$statistics/VarianceRTIndicator";
import { BollingerBandWidthRTIndicator } from "./BollingerBandWidthRTIndicator";

/**
 * A band the parent publishes: a plain value the parent updates, so it cannot tell on its own how
 * warm the parent is. It is ready exactly when the parent is — when the deviation and the middle
 * band it is computed from are — instead of the default of ready from the very first point.
 */
class Band extends ValueRTIndicator {
  constructor(private readonly parentReady: () => boolean) {
    super(0);
  }

  override isReady(): boolean {
    return this.parentReady();
  }
}

/**
 * Bollinger Bands RTIndicator.
 * Middle = SMA, Upper = SMA + k×StdDev, Lower = SMA - k×StdDev.
 * Port of com.wualabs.qtsurfer.engine.indicators.bollinger.BollingerBandsRTIndicator
 */
export class BollingerBandsRTIndicator extends AbstractRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "bollinger";

  private readonly stdDev: StandardDeviationRTIndicator;
  private readonly _upper: Band;
  private readonly _lower: Band;
  private readonly k: number;

  constructor();
  constructor(periods: number, k: number);
  constructor(indicator: RTIndicator | null, periods: number, k: number);
  constructor(indicatorOrPeriods?: RTIndicator | number | null, periodsOrK?: number, k?: number) {
    super();
    let ind: RTIndicator | null = null;
    let periods: number;
    let kVal: number;

    if (indicatorOrPeriods == null && periodsOrK == null && k == null) {
      periods = 20;
      kVal = 2;
    } else if (typeof indicatorOrPeriods === "number") {
      periods = indicatorOrPeriods;
      kVal = periodsOrK ?? 2;
    } else {
      ind = indicatorOrPeriods ?? null;
      periods = periodsOrK ?? 20;
      kVal = k ?? 2;
    }

    this.stdDev = new StandardDeviationRTIndicator(ind, periods);
    this._upper = new Band(() => this.isReady());
    this._lower = new Band(() => this.isReady());
    this.k = kVal;
    // The family describes itself here, not in the builder: getUpper() and getLower() hand out
    // views, so only this class holds the instances the bands are described on
    this.describeBand(this, periods, kVal, "middle");
    this.describeBand(this._upper, periods, kVal, "upper");
    this.describeBand(this._lower, periods, kVal, "lower");
  }

  private describeBand(indicator: AbstractRTIndicator, periods: number, k: number, band: string): void {
    indicator
      .withMeta(IndicatorMeta.ID, BollingerBandsRTIndicator.ID)
      .withMeta("periods", periods)
      .withMeta("k", k)
      .withMeta("band", band);
  }

  override isReady(): boolean {
    return this.stdDev.isReady();
  }

  override reset(): void {
    super.reset();
    this.stdDev.reset();
    this._upper.reset();
    this._lower.reset();
  }

  withAverageSample(averageSample: boolean): this {
    this.stdDev.withAverageSample(averageSample);
    return this;
  }

  /**
   * Chooses how the variance behind the bands is worked out: `"exact"` (the default; the bands keep their
   * width in quiet markets, O(periods) per tick) or the O(1) `"fast"`, which keeps the rounding of the
   * variance below about one part in a thousand million. Reconfigure before feeding the indicator.
   */
  withPrecision(precision: VariancePrecision): this {
    this.stdDev.withPrecision(precision);
    return this;
  }

  get precision(): VariancePrecision {
    return this.stdDev.precision;
  }

  getStdDev(): RTIndicator {
    return new ReadOnlyRTIndicator(this.stdDev);
  }

  getUpper(): RTIndicator {
    return new ReadOnlyRTIndicator(this._upper);
  }

  getLower(): RTIndicator {
    return new ReadOnlyRTIndicator(this._lower);
  }

  getBandWidth(): BollingerBandWidthRTIndicator {
    return new BollingerBandWidthRTIndicator(this);
  }

  override update(newValue: number): number {
    const stdv = this.stdDev.update(newValue) * this.k;
    const middle = this.stdDev.variance.sma.getValue();
    this._upper.update(middle + stdv);
    this._lower.update(middle - stdv);
    return this.setValue(middle);
  }
}
