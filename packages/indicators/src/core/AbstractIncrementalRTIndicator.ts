import { AbstractRTIndicator } from "./AbstractRTIndicator";

/**
 * Base class for indicators that compute values incrementally.
 * Supports periodic (fixed-period tick-based) and non-periodic (incremental) modes.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractIncrementalRTIndicator
 */
export abstract class AbstractIncrementalRTIndicator extends AbstractRTIndicator {
  private init = true;
  private _periods: number;
  private periodic: boolean;
  private tick = 0;
  private _periodCycles = 0;
  private _lastUpdateValue = 0;

  constructor(periods = 0) {
    super();
    this._periods = periods;
    this.periodic = periods > 0;
  }

  override reset(): void {
    super.reset();
    this.init = true;
    this.tick = 0;
    this._periodCycles = 0;
    this._lastUpdateValue = 0;
  }

  get periods(): number {
    return this._periods;
  }

  get isPeriodic(): boolean {
    return this.periodic;
  }

  get periodCycles(): number {
    return this._periodCycles;
  }

  override isReady(): boolean {
    return !this.periodic || this._periodCycles > 0;
  }

  get lastUpdateValue(): number {
    return this._lastUpdateValue;
  }

  /**
   * A value that is not finite (NaN or ±Infinity) is left out: the previous output is held and no
   * tick or period bookkeeping advances, so one bad tick neither poisons the accumulators nor
   * shifts every later period.
   */
  override update(newValue: number): number {
    if (AbstractRTIndicator.isPoison(newValue)) {
      return this.getValue();
    }
    if (this.init) {
      this.init = false;
      this._lastUpdateValue = newValue;
      if (this.periodic) {
        // periods == 1 ends a period on this very first tick, so the boundary is honoured here too
        const endPeriod = ++this.tick === this._periods;
        newValue = this.tickValue(this.tick, true, endPeriod, newValue);
        if (endPeriod) {
          this.tick = 0;
          this._periodCycles++;
        }
      } else {
        newValue = this.initValue(newValue);
      }
      return this.setValue(newValue);
    }
    if (this.periodic) {
      if (++this.tick === this._periods) {
        newValue = this.tickValue(this.tick, false, true, newValue);
        this.tick = 0;
        this._periodCycles++;
      } else {
        newValue = this.tickValue(this.tick, false, false, newValue);
      }
      return this.setValue(newValue);
    }
    return this.setValue(this.prevNextValue(newValue));
  }

  protected initValue(initValue: number): number {
    return initValue;
  }

  protected getPrevValue(): number {
    return this.getValue();
  }

  protected tickValue(
    _tick: number,
    init: boolean,
    _endPeriod: boolean,
    newValue: number,
  ): number {
    if (init) {
      return this.initValue(newValue);
    }
    return this.prevNextValue(newValue);
  }

  protected abstract nextValue(prevValue: number, newValue: number): number;

  protected prevNextValue(newValue: number): number {
    const next = this.nextValue(this.getPrevValue(), newValue);
    this._lastUpdateValue = newValue;
    return next;
  }

  protected setPeriods(periods: number): void {
    this._periods = periods;
    this.periodic = periods > 0;
  }
}
