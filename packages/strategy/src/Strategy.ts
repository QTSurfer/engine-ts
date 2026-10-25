import type { StrategyPropertyDef } from "./StrategyPropertyDef";
import type { StrategyStats } from "./StrategyStats";
import type { ExecutionMode } from "$execution/ExecutionMode";

/**
 * Strategy interface — simplified for TypeScript (no RxJava, no ExchangeSupport).
 * Port of com.wualabs.qtsurfer.engine.strategy.Strategy
 */
export interface Strategy {
  readonly name: string;
  readonly id: string | undefined;
  enabled: boolean;

  readonly stats: StrategyStats;
  readonly instruments: Set<string>;

  getExecutionMode(instrument: string): ExecutionMode;

  setProperty(key: string, value: unknown): boolean;
  applyProperty(key: string, value: unknown): boolean;
  hasProperty(key: string): boolean;
  getProperty<T>(key: string): T | undefined;
  getPropertyDefs(): readonly StrategyPropertyDef[];
  getPropertyDef(name: string): StrategyPropertyDef | undefined;

  reset(instrument: string): void;
}
