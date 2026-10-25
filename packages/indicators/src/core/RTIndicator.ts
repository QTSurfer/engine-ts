import type { Resettable } from "@qtsurfer/core";
import type { DisplayHint } from "./DisplayHint";
import type { IndicatorMeta } from "./IndicatorMeta";

/**
 * Core real-time indicator interface.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.RTIndicator
 *
 * The descriptor members are optional: `AbstractRTIndicator` implements them, and an indicator that
 * only implements this interface has no metadata, is public and displays as absolute.
 */
export interface RTIndicator extends Resettable {
  getValue(): number;
  update(newValue: number): number;
  /**
   * Whether the indicator has seen enough data to give meaningful values. An indicator derived from
   * other indicators is ready when all the indicators it reads are ready, plus its own warm-up if it
   * has one: it must not report ready from the first point while its sources are still warming up.
   */
  isReady(): boolean;
  /** What this indicator says about itself: its type, parameters, source and display. */
  getMeta?(): IndicatorMeta;
  /** The canonical type, derived from the class name unless the metadata sets one. */
  getId?(): string;
  /** Whether the indicator is internal: updated every tick, its value not published. */
  isHidden?(): boolean;
  /** How the value should be presented. */
  getDisplayHint?(): DisplayHint;
}

/**
 * Port of com.wualabs.qtsurfer.engine.indicators.core.RTIndicatorSource
 */
export interface RTIndicatorSource<T = unknown> {
  updateFrom(source: T): void;
}
