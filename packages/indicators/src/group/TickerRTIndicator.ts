import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator, RTIndicatorSource } from "$core/RTIndicator";
import type { Ticker } from "@qtsurfer/core";
import { TickerValueSource, getTickerValue } from "@qtsurfer/core";

/**
 * Indicator that receives values from ticker data via a configurable value source.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.TickerRTIndicator
 */
export class TickerRTIndicator
  extends AbstractDecorableIncrementalRTIndicator
  implements RTIndicatorSource<Ticker>
{
  private readonly tickerSource: TickerValueSource;

  constructor(
    tickerSource: TickerValueSource = TickerValueSource.AutoAskClose,
    indicator?: RTIndicator | null,
  ) {
    if (indicator) {
      super(0, indicator);
    } else {
      super();
    }
    this.tickerSource = tickerSource;
  }

  updateFrom(source: Ticker): void {
    const value = getTickerValue(source, this.tickerSource);
    // NaN is left out, as in the Java engine's TickerRTIndicator
    if (value != null && !Number.isNaN(value)) {
      this.update(value);
    }
  }
}
