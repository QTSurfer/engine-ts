import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

/**
 * Measures price volatility by tracking whether consecutive values change: feeds 1 (changed) or 0
 * (unchanged) into an averaging indicator and returns the result as a percentage. An optional
 * clamp period reads 0 to suppress a noisy start.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.VolatilityRTIndicator
 */
export class VolatilityRTIndicator extends AbstractRTIndicator {
  private init = true;
  private prevValue = 0;
  protected readonly averageIndicator: RTIndicator;
  private clampUpdateCount = 0;
  private clampTotal = 0;
  private clampConfigured = false;
  private clampValues = false;

  /** @param averageIndicator the averaging indicator fed the per-update signal; an SMA by default */
  constructor(averageIndicator: RTIndicator = new SmaRTIndicator()) {
    super();
    this.averageIndicator = averageIndicator;
  }

  /** Reads 0, and is not ready, until `clampUpdateCount` values have followed the first one. */
  clampUpdates(clampUpdateCount: number): this {
    this.clampUpdateCount = clampUpdateCount;
    this.clampTotal = clampUpdateCount;
    this.clampConfigured = true;
    this.clampValues = true;
    return this;
  }

  /** Ready when the averaging indicator it feeds is, and once the clamp period is over. */
  override isReady(): boolean {
    return !this.clampValues && this.averageIndicator.isReady();
  }

  /** Back to its state before the first update, the averaging indicator and the clamp period too. */
  override reset(): void {
    super.reset();
    this.init = true;
    this.prevValue = 0;
    this.averageIndicator.reset();
    this.clampUpdateCount = this.clampTotal;
    this.clampValues = this.clampConfigured;
  }

  /** The first value is only stored. Through the clamp period the value moves but reads 0. */
  override update(newValue: number): number {
    if (this.init) {
      this.prevValue = newValue;
      this.init = false;
      return 0;
    }
    const nextValue = this.nextValue(this.averageIndicator, this.prevValue, newValue);
    this.prevValue = newValue;
    if (this.clampValues && --this.clampUpdateCount <= 0) {
      this.clampValues = false;
    }
    return super.update(nextValue);
  }

  override getValue(): number {
    if (this.clampValues) {
      return 0;
    }
    return super.getValue();
  }

  /** Feeds 1 (changed) or 0 (unchanged) into the averaging indicator, as a percentage. */
  protected nextValue(averageIndicator: RTIndicator, prevValue: number, newValue: number): number {
    return averageIndicator.update(newValue === prevValue ? 0 : 1) * 100;
  }
}
