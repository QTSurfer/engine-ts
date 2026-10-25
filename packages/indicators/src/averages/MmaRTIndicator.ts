import { AbstractEmaRTIndicator } from "$core/AbstractEmaRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Modified Moving Average (Wilder's smoothing).
 * Alpha = 1 / periods
 * Port of com.wualabs.qtsurfer.engine.indicators.averages.MmaRTIndicator
 */
export class MmaRTIndicator extends AbstractEmaRTIndicator {
  constructor(periods: number, indicator?: RTIndicator | null) {
    super(periods, 1 / periods, indicator ?? null);
  }
}
