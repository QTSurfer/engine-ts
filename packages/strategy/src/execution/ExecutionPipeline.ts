import type { Ticker } from "@qtsurfer/core";
import type { MarketHintSignal } from "$signal/MarketHintSignal";
import type { ExecutionStatus } from "./ExecutionStatus";

/**
 * Interface for execution pipelines that process trading signals.
 *
 * `onTicker` is optional: runners should call it before feeding the ticker to
 * the strategy so that a pipeline that depends on bar context (slippage
 * bounded by high/low, pending-order resolution, …) can update its state.
 */
export interface ExecutionPipeline {
  handle(signal: MarketHintSignal): void;
  getStatus(): ExecutionStatus;
  onTicker?(ticker: Ticker): void;
}
