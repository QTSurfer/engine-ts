import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator, RTIndicatorSource } from "$core/RTIndicator";
import type { Kline } from "@qtsurfer/core";
import { KlineValueSource, getKlineValue } from "@qtsurfer/core";

/**
 * Indicator that receives values from kline (OHLCV) data via a configurable value source.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.KlineRTIndicator
 */
export class KlineRTIndicator
  extends AbstractDecorableIncrementalRTIndicator
  implements RTIndicatorSource<Kline>
{
  private readonly klineSource: KlineValueSource;

  constructor(
    klineSource: KlineValueSource = KlineValueSource.Close,
    indicator?: RTIndicator | null,
  ) {
    if (indicator) {
      super(0, indicator);
    } else {
      super();
    }
    this.klineSource = klineSource;
  }

  updateFrom(source: Kline): void {
    const value = getKlineValue(source, this.klineSource);
    // NaN is left out, as in the Java engine's TickerRTIndicator
    if (value != null && !Number.isNaN(value)) {
      this.update(value);
    }
  }
}
