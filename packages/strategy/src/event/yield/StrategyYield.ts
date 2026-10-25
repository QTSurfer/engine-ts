/**
 * Represents the result of a completed trade (buy→sell cycle).
 * Port of com.wualabs.qtsurfer.engine.strategy.event.yield.StrategyYield
 */
export interface StrategyYield {
  readonly instrument: string;
  readonly currency: string;
  readonly input: number;
  readonly output: number;
  readonly timestamp: number;
  getYield(): number;
  getYieldPercent(): number;
}
