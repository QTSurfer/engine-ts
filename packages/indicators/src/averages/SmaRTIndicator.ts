import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { MovingAverage } from "$statistics/MovingAverage";

/**
 * Simple Moving Average — supports discrete and moving modes.
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.SmaRTIndicator
 */
export class SmaRTIndicator extends AbstractDecorableIncrementalRTIndicator {
  private sum = 0;
  private _discreteMode = true;
  private movingAverage: MovingAverage | null = null;

  constructor();
  constructor(periods: number);
  constructor(indicator: RTIndicator);
  constructor(periods: number, indicator: RTIndicator);
  constructor(periodsOrIndicator?: number | RTIndicator, indicator?: RTIndicator) {
    if (typeof periodsOrIndicator === "number") {
      super(periodsOrIndicator, indicator ?? null);
    } else if (periodsOrIndicator != null) {
      super(0, periodsOrIndicator);
    } else {
      super(0);
    }
  }

  withDiscreteMode(discreteMode: boolean): this {
    this._discreteMode = discreteMode;
    if (discreteMode) {
      this.movingAverage = null;
    } else {
      this.movingAverage = new MovingAverage(this.periods);
    }
    return this;
  }

  override reset(): void {
    super.reset();
    this.sum = 0;
    this.movingAverage?.reset();
  }

  protected override tickValue(
    tick: number,
    init: boolean,
    endPeriod: boolean,
    newValue: number,
  ): number {
    return this._discreteMode
      ? this.tickValueDiscrete(tick, init, endPeriod, newValue)
      : this.tickValueMoving(tick, init, endPeriod, newValue);
  }

  /**
   * Non-periodic (2-period) SMA: simple average of previous and new values.
   */
  protected override nextValue(prevValue: number, newValue: number): number {
    return (prevValue + newValue) / 2;
  }

  private tickValueDiscrete(
    tick: number,
    init: boolean,
    endPeriod: boolean,
    newValue: number,
  ): number {
    if (tick === 1) {
      this.sum = 0;
    }
    this.sum += newValue;
    if (init) {
      return newValue;
    }
    return endPeriod ? this.sum / this.periods : this.getPrevValue();
  }

  private tickValueMoving(
    _tick: number,
    init: boolean,
    endPeriod: boolean,
    newValue: number,
  ): number {
    this.movingAverage!.update(newValue);
    if (init) {
      return newValue;
    }
    return this.periodCycles > 0 || endPeriod
      ? this.movingAverage!.average
      : this.getPrevValue();
  }
}
