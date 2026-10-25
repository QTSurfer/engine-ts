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
    return super.update(this._indicator.update(newValue));
  }

  protected override nextValue(_prevValue: number, newValue: number): number {
    return newValue;
  }
}
