import type { RTIndicator } from "$core/RTIndicator";
import { unaries } from "@qtsurfer/core";
import { TransformRTIndicator } from "./TransformRTIndicator";

/**
 * Clamps the output of a decorated indicator to a [lo, hi] range.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ClampRTIndicator
 */
export class ClampRTIndicator extends TransformRTIndicator {
  constructor(indicator: RTIndicator, lo: number, hi: number) {
    super(indicator, unaries.clamp(lo, hi));
  }
}
