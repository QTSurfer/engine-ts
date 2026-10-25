import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";

/**
 * A map of RTIndicators for an instrument.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.group.InstrumentMapRTIndicator
 */
export class InstrumentMapRTIndicator extends AbstractRTIndicator {
  static readonly PRIVATE_PREFIX = "_";

  readonly instrument: string;
  private readonly indicators = new Map<string, RTIndicator>();
  private readonly readOnlyCache = new Map<string, RTIndicator>();
  private backtestEnabled = false;

  constructor(instrument: string) {
    super();
    this.instrument = instrument;
  }

  add(name: string, indicator: RTIndicator): this {
    // The "_" namespace marks an internal indicator: it is updated but not published. The name is
    // read once, here, and becomes visibility metadata the publishing side reads instead.
    if (name.startsWith(InstrumentMapRTIndicator.PRIVATE_PREFIX) && indicator instanceof AbstractRTIndicator) {
      indicator.hide();
    }
    this.indicators.set(name, indicator);
    this.readOnlyCache.delete(name);
    return this;
  }

  getIndicatorValue(name: string): number {
    const indicator = this.indicators.get(name);
    if (!indicator) {
      throw new Error(`Indicator not found: ${name}`);
    }
    return indicator.getValue();
  }

  get(name: string): RTIndicator | undefined {
    return this.indicators.get(name);
  }

  getReadOnly(name: string): RTIndicator | undefined {
    if (name == null) return undefined;
    const cached = this.readOnlyCache.get(name);
    if (cached) return cached;
    const indicator = this.indicators.get(name);
    if (!indicator) return undefined;
    const ro = new ReadOnlyRTIndicator(indicator);
    this.readOnlyCache.set(name, ro);
    return ro;
  }

  getReadOnlyExisting(name: string): RTIndicator {
    const ro = this.getReadOnly(name);
    if (!ro) {
      throw new Error(`Indicator not found: ${name}`);
    }
    return ro;
  }

  getExisting(name: string): RTIndicator {
    const indicator = this.indicators.get(name);
    if (!indicator) {
      throw new Error(`Indicator not found: ${name}`);
    }
    return indicator;
  }

  remove(name: string): RTIndicator | undefined {
    this.readOnlyCache.delete(name);
    const indicator = this.indicators.get(name);
    this.indicators.delete(name);
    return indicator;
  }

  size(): number {
    return this.indicators.size;
  }

  clear(): void {
    this.indicators.clear();
    this.readOnlyCache.clear();
  }

  /**
   * In backtest mode each update first sets the clock of every time-aware indicator (the windows)
   * to the timestamp of the data point, so a window closes after the data's time, not the
   * machine's: a fast historical run would otherwise never close one.
   */
  setBacktestEnabled(enabled: boolean): void {
    this.backtestEnabled = enabled;
  }

  isBacktestEnabled(): boolean {
    return this.backtestEnabled;
  }

  /** Sets the clock of every time-aware indicator in the map. */
  setClockFn(clockFn: () => number): void {
    for (const indicator of this.indicators.values()) {
      (indicator as { setClockFn?: (fn: () => number) => void }).setClockFn?.(clockFn);
    }
  }

  /**
   * Iterates over the public indicators: those not marked hidden in their metadata. The internal
   * ones (the "_" entries the gain, loss and window builders register, the Bollinger added behind a
   * bandwidth) are skipped, so their values are not published.
   *
   * A "_" name stays internal even where the indicator cannot carry the mark: one that implements
   * only `RTIndicator`, or a read-only view, whose metadata is its wrapped indicator's.
   */
  forEachPublicable(action: (name: string, indicator: RTIndicator) => void): void {
    this.indicators.forEach((indicator, name) => {
      if (indicator.isHidden?.() || name.startsWith(InstrumentMapRTIndicator.PRIVATE_PREFIX)) {
        return;
      }
      action(name, indicator);
    });
  }

  override reset(): void {
    super.reset();
    for (const indicator of this.indicators.values()) {
      indicator.reset();
    }
  }

  protected indicatorValues(): IterableIterator<RTIndicator> {
    return this.indicators.values();
  }
}
