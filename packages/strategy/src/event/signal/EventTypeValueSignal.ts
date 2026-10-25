import type { StrategyEventType } from "$event/StrategyEventType";
import { InfoStrategySignal } from "./InfoStrategySignal";

/**
 * Signal that stores an event type value.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.EventTypeValueSignal
 */
export class EventTypeValueSignal extends InfoStrategySignal {
  private static readonly EVENT_TYPE_VALUE_KEY = "_value";

  constructor(
    strategyName: string,
    instrument: string,
    eventType: StrategyEventType,
    eventTypeValue: string,
  ) {
    super(strategyName, eventType, instrument);
    this.set(EventTypeValueSignal.EVENT_TYPE_VALUE_KEY, eventTypeValue);
  }

  getEventTypeValue(): string | undefined {
    return this.get<string>(EventTypeValueSignal.EVENT_TYPE_VALUE_KEY);
  }
}
