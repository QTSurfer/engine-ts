import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Computes the relative distance between two indicators: (a - b) / b.
 * Port of com.wualabs.qtsurfer.engine.indicators.DistanceRTIndicator
 */
export class DistanceRTIndicator extends AbstractRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "distance";

  private readonly indicatorA: RTIndicator;
  private readonly indicatorB: RTIndicator;

  constructor(indicatorA: RTIndicator, indicatorB: RTIndicator) {
    super();
    this.indicatorA = indicatorA;
    this.indicatorB = indicatorB;
  }

  /** Ready when both of the indicators it measures are: a distance needs the two of them. */
  override isReady(): boolean {
    return this.indicatorA.isReady() && this.indicatorB.isReady();
  }

  override update(newValue: number): number {
    const a = this.indicatorA.update(newValue);
    const b = this.indicatorB.update(newValue);
    return this.setValue(b === 0 ? 0 : (a - b) / b);
  }

  override reset(): void {
    super.reset();
    this.indicatorA.reset();
    this.indicatorB.reset();
  }
}
