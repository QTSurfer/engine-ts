import { AbstractStrategyEvent } from "$event/AbstractStrategyEvent";
import type { StrategyEventType } from "$event/StrategyEventType";
import type { StrategySignal } from "./StrategySignal";

/**
 * Base class for a StrategySignal.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.AbstractStrategySignal
 */
export abstract class AbstractStrategySignal
  extends AbstractStrategyEvent
  implements StrategySignal
{
  readonly instrument: string;

  protected constructor(
    strategyName: string,
    eventType: StrategyEventType,
    instrument: string,
  ) {
    super(strategyName, eventType);
    this.instrument = instrument;
  }
}
