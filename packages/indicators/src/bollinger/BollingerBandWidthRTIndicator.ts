import { AbstractDecorableRTIndicator } from "$core/AbstractDecorableRTIndicator";
import type { BollingerBandsRTIndicator } from "./BollingerBandsRTIndicator";

/**
 * Bollinger BandWidth RT Indicator.
 * BandWidth = 100 × (upper - lower) / middle.
 * Port of com.wualabs.qtsurfer.engine.indicators.bollinger.BollingerBandWidthRTIndicator
 */
export class BollingerBandWidthRTIndicator extends AbstractDecorableRTIndicator {
  /** The canonical type, set as an explicit id where the class name would give a different one. */
  static readonly ID = "bollingerBandwidth";

  private readonly bollingerBands: BollingerBandsRTIndicator;

  constructor(bollingerBands: BollingerBandsRTIndicator) {
    super(bollingerBands);
    this.bollingerBands = bollingerBands;
  }

  override isReady(): boolean {
    return this.bollingerBands.isReady();
  }

  /**
   * This indicator is a view of the bands, which it never updates and so does not own: resetting it
   * only clears its own value, and the bands go back to their start when their owner resets them.
   */
  override reset(): void {
    this.setValue(0);
  }

  override getValue(): number {
    const med = this.bollingerBands.getValue();
    const upper = this.bollingerBands.getUpper().getValue();
    const lower = this.bollingerBands.getLower().getValue();
    // A zero middle band (a series crossing zero with some volatility) would make the ratio
    // ±Infinity: 0, a collapsed width, as BollingerPercentB does and as the Java engine does
    return this.setValue(med !== 0 ? 100 * ((upper - lower) / med) : 0);
  }

  override update(_newValue: number): number {
    return this.getValue();
  }
}
