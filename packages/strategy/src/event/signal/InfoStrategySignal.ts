import { StrategyEventType } from "$event/StrategyEventType";
import type { StrategyEventType as StrategyEventTypeEnum } from "$event/StrategyEventType";
import { AbstractStrategySignal } from "./AbstractStrategySignal";

/**
 * Simple StrategySignal using StrategyEvent's properties as data backend.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.InfoStrategySignal
 */
export class InfoStrategySignal extends AbstractStrategySignal {
  /**
   * Whether this is the per-tick snapshot of every public indicator that a strategy with
   * `enableIndicatorsSignals` emits. A field, not a property, so it never shows among the data.
   */
  indicatorSnapshot = false;

  constructor(strategyName: string, instrument: string);
  constructor(
    strategyName: string,
    eventType: StrategyEventTypeEnum,
    instrument: string,
  );
  constructor(
    strategyName: string,
    eventTypeOrInstrument: StrategyEventTypeEnum | string,
    instrument?: string,
  ) {
    if (instrument != null) {
      super(strategyName, eventTypeOrInstrument as StrategyEventTypeEnum, instrument);
    } else {
      super(strategyName, StrategyEventType.Info, eventTypeOrInstrument as string);
    }
  }
}
