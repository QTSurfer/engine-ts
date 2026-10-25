import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Read-only wrapper that does not update the wrapped indicator.
 * Port of com.wualabs.qtsurfer.engine.indicators.numeric.ReadOnlyRTIndicator
 */
export class ReadOnlyRTIndicator extends AbstractRTIndicator {
  readonly indicator: RTIndicator;

  constructor(indicator: RTIndicator) {
    super();
    this.indicator = indicator;
  }

  override isReady(): boolean {
    return this.indicator.isReady();
  }

  // A view describes the same indicator, so the descriptor is read from, and written to, the
  // wrapped one: read-only guards the value, not the description. A view of an indicator that
  // cannot carry metadata drops what is written to it.
  override getMeta(): IndicatorMeta {
    return this.indicator.getMeta?.() ?? IndicatorMeta.EMPTY;
  }

  // Delegated too, or a view would report "readOnly" for what is really an rsi or an ema
  override getId(): string {
    return this.indicator.getId?.() ?? IndicatorMeta.deriveId(this.indicator.constructor);
  }

  override withMeta(key: string, value: unknown): this {
    if (this.indicator instanceof AbstractRTIndicator) {
      this.indicator.withMeta(key, value);
    }
    return this;
  }

  override withDisplayHint(displayHint: DisplayHint | null | undefined): this {
    if (this.indicator instanceof AbstractRTIndicator) {
      this.indicator.withDisplayHint(displayHint);
    }
    return this;
  }

  override getValue(): number {
    return this.indicator.getValue();
  }

  override update(_newValue: number): number {
    return this.setValue(this.indicator.getValue());
  }
}
