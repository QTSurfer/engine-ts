import { AbstractIncrementalRTIndicator } from "./AbstractIncrementalRTIndicator";
import type { RTIndicator } from "./RTIndicator";

/**
 * Incremental indicator that optionally decorates (wraps) another indicator.
 * When a decorated indicator is present, incoming values are first passed through it
 * before being processed by this indicator's incremental logic.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractDecorableIncrementalRTIndicator
 */
export abstract class AbstractDecorableIncrementalRTIndicator extends AbstractIncrementalRTIndicator {
  private readonly _indicator: RTIndicator | null;

  constructor();
  constructor(periods: number);
  constructor(indicator: RTIndicator);
  constructor(periods: number, indicator: RTIndicator | null);
  constructor(periodsOrIndicator?: number | RTIndicator, indicator?: RTIndicator | null) {
    if (typeof periodsOrIndicator === "number") {
      super(periodsOrIndicator);
      this._indicator = indicator ?? null;
    } else if (periodsOrIndicator != null) {
      super(0);
      this._indicator = periodsOrIndicator;
    } else {
      super(0);
      this._indicator = null;
    }
  }

  override reset(): void {
    super.reset();
    this._indicator?.reset();
  }

  /**
   * Ready when this indicator's own warm-up is complete and the indicator it decorates is ready:
   * the values it is fed come from that indicator, so they are not meaningful until it is. Without
   * a decorated indicator this is just the own warm-up.
   */
  override isReady(): boolean {
    return super.isReady() && (this._indicator == null || this._indicator.isReady());
  }

  /** Hands the clock to the decorated indicator, as the Java engine does. */
  setClockFn(clockFn: () => number): void {
    const clockAware = this._indicator as { setClockFn?: (fn: () => number) => void } | null;
    clockAware?.setClockFn?.(clockFn);
  }

  getIndicator<T extends RTIndicator>(): T {
    return this._indicator as T;
  }

  override update(newValue: number): number {
    if (this._indicator == null) {
      return super.update(newValue);
    }
    const value = this._indicator.update(newValue);
    if (!this.consumes(this._indicator)) {
      return this.getValue();
    }
    return super.update(value);
  }

  /**
   * Whether the value the decorated indicator has just produced is fed into this indicator. Always,
   * by default. An accumulator whose first value seeds everything after it (a running minimum or
   * maximum) overrides it to wait for the decorated indicator to be ready, so the warm-up values of
   * its source never enter it. While it holds back, this indicator keeps the value it had.
   *
   * @param decorated the decorated indicator, after it processed the new value
   * @returns `true` to feed its value into this indicator
   */
  protected consumes(_decorated: RTIndicator): boolean {
    return true;
  }

  protected override nextValue(_prevValue: number, newValue: number): number {
    return newValue;
  }
}
