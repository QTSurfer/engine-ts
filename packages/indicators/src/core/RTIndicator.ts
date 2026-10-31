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

/**
 * An indicator that reads a whole data point (a bar or a ticker) and not one value.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.RichRTIndicator
 *
 * Unlike the Java interface, `updateFrom` returns nothing: read the value with `getValue()`.
 */
export interface RichRTIndicator<T = unknown> extends RTIndicator, RTIndicatorSource<T> {
  /**
   * Whether its result only means something over per-bar data (high, low, volume of the bar).
   *
   * A group fed from a ticker stream hands these indicators the exchange's 24-hour statistics in
   * place of the bar's fields. Nothing throws and the numbers look plausible, so the group reports
   * it once per indicator (see {@link IndicatorNotice}). An indicator that does not define this
   * method does not need bars.
   */
  requiresBarData?(): boolean;
}

