import { AbstractRTIndicator } from "./AbstractRTIndicator";
import type { RTIndicator } from "./RTIndicator";

/**
 * Base class for an indicator whose value is derived from another one it wraps. Readiness and reset
 * follow the wrapped indicator: a value computed from a source that is still warming up is itself
 * not ready, and resetting the wrapper returns what it reads to its pre-first-update state, as every
 * other holder of an indicator does.
 *
 * A subclass that is only a view of the wrapped indicator, and so neither updates nor owns it,
 * overrides `reset` to leave the wrapped indicator alone.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractDecorableRTIndicator
 */
export class AbstractDecorableRTIndicator extends AbstractRTIndicator {
  protected readonly indicator: RTIndicator;

  constructor(indicator: RTIndicator) {
    super();
    this.indicator = indicator;
  }

  /** Ready when the wrapped indicator is: this wrapper has no warm-up of its own. */
  override isReady(): boolean {
    return this.indicator.isReady();
  }

  override reset(): void {
    super.reset();
    this.indicator.reset();
  }

  protected getIndicatorValue(): number {
    return this.indicator.getValue();
  }
}
