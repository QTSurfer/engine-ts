import type { RTIndicatorSource } from "$core/RTIndicator";
import type { Kline } from "@qtsurfer/core";
import { KlineValueSource, getKlineValue } from "@qtsurfer/core";
import { InstrumentMapRTIndicator } from "./InstrumentMapRTIndicator";

/**
 * A map of RTIndicators for an instrument that updates from Kline (OHLCV) data.
 * Only OHLCV-based indicators are supported — ticker-only sources (bid/ask/vwap/pctChange)
 * are not available on this path.
 *
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.group.InstrumentMapKlineSourceRTIndicator
 */
export class InstrumentMapKlineSourceRTIndicator
  extends InstrumentMapRTIndicator
  implements RTIndicatorSource<Kline>
{
  readonly valueSource: KlineValueSource;

  constructor(
    instrument: string,
    valueSource: KlineValueSource = KlineValueSource.Close,
  ) {
    super(instrument);
    this.valueSource = valueSource;
  }

  updateFrom(source: Kline): void {
    if (this.isBacktestEnabled()) {
      this.setClockFn(() => source.timestamp);
    }
    // A bar with a price that is not finite is corrupt: the indicators that read the whole bar would
    // fold it into an accumulator for good, so the bar is held for them. The scalar path skips only
    // a value that is not finite. As the Java engine's kline dispatch.
    const validBar = isFiniteOhlcBar(source);
    for (const indicator of this.indicatorValues()) {
      if (hasUpdateFrom(indicator)) {
        if (validBar) {
          indicator.updateFrom(source);
        }
      } else {
        const value = getKlineValue(source, this.valueSource);
        if (value != null && Number.isFinite(value)) {
          indicator.update(value);
        }
      }
    }
    const selfValue = getKlineValue(source, this.valueSource);
    if (selfValue != null && Number.isFinite(selfValue)) {
      this.update(selfValue);
    }
  }
}

function hasUpdateFrom(obj: unknown): obj is RTIndicatorSource<Kline> {
  return typeof (obj as { updateFrom?: unknown }).updateFrom === "function";
}

/** All four prices finite. Volume is left out: a legitimate bar may carry none on some feeds. */
function isFiniteOhlcBar(bar: Kline): boolean {
  return Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close);
}
