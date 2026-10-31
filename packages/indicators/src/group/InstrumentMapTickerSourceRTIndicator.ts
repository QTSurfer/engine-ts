import { barDataOnTickerPath } from "$core/IndicatorNotice";
import type { RichRTIndicator, RTIndicatorSource } from "$core/RTIndicator";
import type { Ticker } from "@qtsurfer/core";
import { TickerValueSource, getTickerValue } from "@qtsurfer/core";
import { InstrumentMapRTIndicator } from "./InstrumentMapRTIndicator";

/**
 * A map of RTIndicators for an instrument that updates from Ticker data.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.group.InstrumentMapTickerSourceRTIndicator
 */
export class InstrumentMapTickerSourceRTIndicator
  extends InstrumentMapRTIndicator
  implements RTIndicatorSource<Ticker>
{
  readonly valueSource: TickerValueSource;

  constructor(
    instrument: string,
    valueSource: TickerValueSource = TickerValueSource.AutoAskClose,
  ) {
    super(instrument);
    this.valueSource = valueSource;
  }

  updateFrom(source: Ticker): void {
    if (this.isBacktestEnabled()) {
      this.setClockFn(() => source.timestamp);
    }
    for (const [name, indicator] of this.namedIndicators()) {
      // Check if the indicator itself can handle ticker updates
      if (hasUpdateFrom(indicator)) {
        // On the ticker path high, low and volume are the exchange's 24h statistics, not a bar's:
        // an indicator that needs bars is reported once, and still updated (its values are
        // misleading, not invalid).
        if ((indicator as RichRTIndicator<Ticker>).requiresBarData?.() === true) {
          this.raiseNotice(barDataOnTickerPath(name, this.instrument));
        }
        indicator.updateFrom(source);
      } else {
        const value = getTickerValue(source, this.valueSource);
        if (value != null && Number.isFinite(value)) {
          indicator.update(value);
        }
      }
    }
    // Update self
    const selfValue = getTickerValue(source, this.valueSource);
    if (selfValue != null && Number.isFinite(selfValue)) {
      this.update(selfValue);
    }
  }
}

function hasUpdateFrom(obj: unknown): obj is RTIndicatorSource<Ticker> {
  return typeof (obj as { updateFrom?: unknown }).updateFrom === "function";
}
