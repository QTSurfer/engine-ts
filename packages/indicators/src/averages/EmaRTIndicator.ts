import { AbstractEmaRTIndicator } from "$core/AbstractEmaRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Exponential Moving Average.
 * Alpha = 2 / (periods + 1)
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.EmaRTIndicator
 */
export class EmaRTIndicator extends AbstractEmaRTIndicator {
  constructor(periods: number, indicator?: RTIndicator | null) {
    super(periods, 2 / (periods + 1), indicator ?? null);
  }
}
