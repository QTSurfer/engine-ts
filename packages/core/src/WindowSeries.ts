/**
 * Port of com.wualabs.qtsurfer.engine.core.state.WindowSeries
 * and com.wualabs.qtsurfer.engine.core.state.WritableWindowSeries
 */
export interface WindowSeries extends Iterable<number> {
  readonly windowSize: number;
  readonly size: number;
  getValue(index: number): number;
}

export interface WritableWindowSeries extends WindowSeries {
  clear(): void;
  add(value: number): void;
}
