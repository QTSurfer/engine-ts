/**
 * Defines the type of execution pipeline a strategy uses.
 * Port of com.wualabs.qtsurfer.engine.strategy.execution.ExecutionMode
 */
export enum ExecutionMode {
  /** Single-entry long pipeline: buy then sell */
  LONG = "LONG",
  /** Multi-entry long pipeline: multiple buys (DCA) then sell */
  LONG_MULTI = "LONG_MULTI",
  /** Single-entry short pipeline: sell then buy to cover */
  SHORT = "SHORT",
}
