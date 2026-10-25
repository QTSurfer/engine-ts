import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { BollingerBandsRTIndicator } from "./BollingerBandsRTIndicator";

/**
 * Bollinger %B: where the price sits relative to the Bollinger Bands.
 *
 *   %B = (price - lowerBand) / (upperBand - lowerBand)
 *
 * 0 is the lower band, 0.5 the middle and 1 the upper band; a value above 1 or below 0 means the
 * price is outside the bands. A zero-width band (a flat series) gives 0.
 *
 * Wraps a {@link BollingerBandsRTIndicator} and updates it.
 * Port of com.wualabs.qtsurfer.engine.indicators.bollinger.BollingerPercentBRTIndicator
 */
export class BollingerPercentBRTIndicator extends AbstractRTIndicator {
  private readonly bollinger: BollingerBandsRTIndicator;

  constructor(bollinger: BollingerBandsRTIndicator) {
    super();
    this.bollinger = bollinger;
  }

  override isReady(): boolean {
    return this.bollinger.isReady();
  }

  override reset(): void {
    super.reset();
    this.bollinger.reset();
  }

  override update(newValue: number): number {
    this.bollinger.update(newValue);
    const upper = this.bollinger.getUpper().getValue();
    const lower = this.bollinger.getLower().getValue();
    const bandwidth = upper - lower;
    return this.setValue(bandwidth !== 0 ? (newValue - lower) / bandwidth : 0);
  }
}
