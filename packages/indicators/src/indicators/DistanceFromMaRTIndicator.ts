import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { IndicatorMeta } from "$core/IndicatorMeta";
import type { RTIndicator } from "$core/RTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { WmaRTIndicator } from "$averages/WmaRTIndicator";
import { WmaIncrementalRTIndicator } from "$averages/WmaIncrementalRTIndicator";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";
import { KamaRTIndicator } from "$averages/KamaRTIndicator";

/**
 * The ids of the moving averages. The id, not the class, is what a wrapper hands on: a read-only
 * view answers for the indicator it stands in place of.
 */
const ACCEPTED_MOVING_AVERAGES: ReadonlySet<string> = new Set(
  [
    SmaRTIndicator,
    EmaRTIndicator,
    MmaRTIndicator,
    WmaRTIndicator,
    WmaIncrementalRTIndicator,
    HmaRTIndicator,
    TemaRTIndicator,
    KamaRTIndicator,
  ].map((type) => IndicatorMeta.deriveId(type)),
);

/**
 * Computes the relative distance from the close price to a moving average:
 * (close - ma) / ma.
 *
 * The average may be any of the moving averages of the engine: `SmaRTIndicator`, `EmaRTIndicator`,
 * `MmaRTIndicator`, `WmaRTIndicator`, `WmaIncrementalRTIndicator`, `HmaRTIndicator`,
 * `TemaRTIndicator` and `KamaRTIndicator`. It is recognised by its id, which a read-only view
 * passes through, so the same call works on an indicator and on the view of one. Any other
 * indicator is refused.
 * Port of com.wualabs.qtsurfer.engine.indicators.DistanceFromMaRTIndicator
 */
export class DistanceFromMaRTIndicator extends AbstractRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "distanceMa";

  private readonly maIndicator: RTIndicator;
  private lastClosePrice = 0;

  /** @throws RangeError when `maIndicator` is not one of the moving averages */
  constructor(maIndicator: RTIndicator) {
    super();
    const id = maIndicator.getId?.() ?? IndicatorMeta.deriveId(maIndicator.constructor);
    if (!ACCEPTED_MOVING_AVERAGES.has(id)) {
      throw new RangeError(`Not a moving average indicator: ${id}`);
    }
    this.maIndicator = maIndicator;
  }

  override update(newValue: number): number {
    this.lastClosePrice = newValue;
    const maValue = this.maIndicator.update(newValue);
    return this.setValue(maValue === 0 ? 0 : (this.lastClosePrice - maValue) / maValue);
  }

  override isReady(): boolean {
    return this.maIndicator.isReady();
  }

  override reset(): void {
    super.reset();
    this.lastClosePrice = 0;
    this.maIndicator.reset();
  }

  static sma(periods: number): DistanceFromMaRTIndicator {
    return new DistanceFromMaRTIndicator(new SmaRTIndicator(periods));
  }

  static ema(periods: number): DistanceFromMaRTIndicator {
    return new DistanceFromMaRTIndicator(new EmaRTIndicator(periods));
  }
}
