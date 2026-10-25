import type { StrategyEventType } from "./StrategyEventType";

/**
 * Strategy event is the base interface for yields and signals.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.StrategyEvent
 */
export interface StrategyEvent {
  readonly strategyName: string;
  readonly type: StrategyEventType;
  timestamp: number;
  readonly properties: Map<string, unknown>;
}
