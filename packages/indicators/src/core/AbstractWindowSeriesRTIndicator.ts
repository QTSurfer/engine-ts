import { WindowSeriesStore } from "@qtsurfer/core";
import { AbstractRTIndicator } from "./AbstractRTIndicator";

/**
 * The window of an {@link AbstractWindowSeriesRTIndicator}: hands each value it evicts to its
 * indicator.
 *
 * One class shared by every indicator, where the Java engine writes an anonymous subclass in the
 * constructor. In JavaScript a class expression is evaluated on every call, so that translation gave
 * each instance a class of its own; past a handful of instances the window's call sites stopped
 * being optimised, and CCI, WMA and HMA ran more than ten times slower.
 */
class EvictingWindowSeriesStore extends WindowSeriesStore {
  constructor(
    periods: number,
    private readonly evicted: (value: number) => void,
  ) {
    super(periods);
  }

  protected override onRollingWindow(firstValue: number): void {
    this.evicted(firstValue);
  }
}

/**
 * Base class for RT indicators that use a WindowSeriesStore.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractWindowSeriesRTIndicator
 */
export abstract class AbstractWindowSeriesRTIndicator extends AbstractRTIndicator {
  private readonly _window: WindowSeriesStore;
  private readonly _periods: number;

  protected constructor(periods: number) {
    super();
    this._periods = periods;
    this._window = new EvictingWindowSeriesStore(periods, (evicted) => this.onEvict(evicted));
  }

  get periods(): number {
    return this._periods;
  }

  override isReady(): boolean {
    return this._window.size === this._periods;
  }

  protected window(): WindowSeriesStore {
    return this._window;
  }

  protected windowSize(): number {
    return this._window.size;
  }

  protected onEvict(_evicted: number): void {}

  override reset(): void {
    super.reset();
    this._window.clear();
    this.onReset();
  }

  protected onReset(): void {}
}
