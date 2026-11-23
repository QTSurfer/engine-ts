import type { StrategyContext } from "./StrategyContext";
import type { StrategyPropertyDef } from "./StrategyPropertyDef";
import type { StrategyStats } from "./StrategyStats";
import type { ExecutionMode } from "$execution/ExecutionMode";

/**
 * Strategy interface — simplified for TypeScript (no RxJava).
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

  /**
   * Called when a market-data source is attached to this strategy at the owner's will, before the
   * strategy sees any event from it. The context says which source it is, which instruments it
   * covers and whether the strategy is still warming up on it.
   *
   * In a backtest the engine calls it once, before the first event, with its own source: a venue
   * of type `VenueType.CEX`, the `"spot"` segment, and data of type `MarketDataSource.Ticker` or
   * `MarketDataSource.KLine` according to what the run replays. A strategy that relies on this
   * hook therefore behaves the same in a backtest. A strategy that has instruments of its own
   * before the first event is reported with those; otherwise the context has none, because the
   * engine does not read the data ahead of the run.
   *
   * It runs synchronously, in order with `update`: no event is being processed while it runs.
   * Like `update`, it may emit signals, and they are handled the same way. In a backtest a signal
   * emitted here carries the time of the first event (for a bar, its close time), because that is
   * the only time the run has before the data starts.
   *
   * Optional, as the default method of the Java interface is: a strategy that implements `Strategy`
   * directly need not declare it. The default, in `AbstractStrategy`, does nothing.
   *
   * @param context the attachment that started; `getReason()` is empty
   */
  onAttach?(context: StrategyContext): void;

  /**
   * Called when a market-data source that was attached to this strategy is detached, after the
   * last event it delivered. The context describes the attachment that `onAttach` received, with
   * the reason it ended, and is never warming up.
   *
   * In a backtest the engine calls it once, after the last event, with
   * `StrategyContext.REASON_OWNER`. It is also called when an event fails, so the run ends with
   * the failure and not with the hook's. It is not called if `onAttach` did not return normally.
   *
   * It runs synchronously, in order with `update`. Like `update`, it may emit signals, for example
   * to close a position, and they are handled the same way. In a backtest a signal emitted here
   * carries the time of the last event that was replayed.
   *
   * Optional, as the default method of the Java interface is: a strategy that implements `Strategy`
   * directly need not declare it. The default, in `AbstractStrategy`, does nothing.
   *
   * @param context the attachment that ended, with the reason it ended in `getReason()` (empty if
   *   none was given)
   */
  onDetach?(context: StrategyContext): void;
}
