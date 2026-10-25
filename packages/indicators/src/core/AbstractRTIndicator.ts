import type { DisplayHint } from "./DisplayHint";
import { IndicatorMeta } from "./IndicatorMeta";
import type { RTIndicator } from "./RTIndicator";

/**
 * Base RT indicator class.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.AbstractRTIndicator
 */
export abstract class AbstractRTIndicator implements RTIndicator {
  private value = 0;
  // Created on first write: most derived indicators carry no metadata and pay nothing for it
  private meta: IndicatorMeta | null = null;

  getValue(): number {
    return this.value;
  }

  /** What this indicator says about itself; `IndicatorMeta.EMPTY` when nothing was set. */
  getMeta(): IndicatorMeta {
    return this.meta ?? IndicatorMeta.EMPTY;
  }

  /**
   * The canonical type of this indicator: the explicit `IndicatorMeta.ID` entry if there is one,
   * else the class name without its `RTIndicator` suffix (`RsiRTIndicator` is `rsi`).
   */
  getId(): string {
    return this.getMeta().get(IndicatorMeta.ID) ?? IndicatorMeta.deriveId(this.constructor);
  }

  getDisplayHint(): DisplayHint {
    return this.getMeta().getDisplayHint();
  }

  /** Whether this is an internal indicator: updated every tick, but its value is not published. */
  isHidden(): boolean {
    return this.getMeta().isHidden();
  }

  /**
   * Sets one descriptive entry, so a builder can describe an indicator as it registers it. Metadata
   * is a write-only descriptor: an indicator must never read it back to compute.
   */
  withMeta(key: string, value: unknown): this {
    this.writableMeta().set(key, value);
    return this;
  }

  /** Sets how the value is presented; ABSOLUTE (or null) clears it. */
  withDisplayHint(displayHint: DisplayHint | null | undefined): this {
    this.writableMeta().setDisplayHint(displayHint);
    return this;
  }

  /** Marks this an internal indicator: updated, but not published. */
  hide(): this {
    this.writableMeta().setHidden(true);
    return this;
  }

  reset(): void {
    this.setValue(0);
  }

  update(newValue: number): number {
    return this.setValue(newValue);
  }

  isReady(): boolean {
    return true;
  }

  protected setValue(value: number): number {
    return (this.value = value);
  }

  /**
   * Whether `value` is NaN or ±Infinity: a value that must never be folded into a rolling
   * accumulator. Both are absorbing under `+ - * /`, so one of them folded into a running sum, a
   * variance, an EMA or a sorted window corrupts it until `reset()`, long after the bad tick has
   * left any window. Guard raw inputs with this and hold the previous output instead. As the Java
   * engine's `isPoison`.
   */
  protected static isPoison(value: number): boolean {
    return !Number.isFinite(value);
  }

  private writableMeta(): IndicatorMeta {
    return (this.meta ??= new IndicatorMeta());
  }
}
