/**
 * Strategy event types.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.StrategyEventType
 */
export enum StrategyEventType {
  Info = "Info",
  Marker = "Marker",
  Hint = "Hint",
  Yield = "Yield",
  Command = "Command",
  Request = "Request",
  /** The strategy tells the platform about its own run (for example, to detach a source). */
  System = "System",
}
