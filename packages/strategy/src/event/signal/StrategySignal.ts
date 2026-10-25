import type { StrategyEvent } from "$event/StrategyEvent";

/**
 * Strategies may emit signals: e.g. function result ema(price), a buy signal, a sell signal.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.StrategySignal
 */
export interface StrategySignal extends StrategyEvent {
  readonly instrument: string;
}
