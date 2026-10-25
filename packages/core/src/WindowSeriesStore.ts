import type { WritableWindowSeries } from "./WindowSeries";

/**
 * Ring buffer implementation for windowed time series data.
 * Port of com.wualabs.qtsurfer.engine.core.state.WindowSeriesStore
 */
export class WindowSeriesStore implements WritableWindowSeries {
  private readonly buffer: Float64Array;
  private head = 0;
  private count = 0;

  constructor(public readonly windowSize: number) {
    // As the Java engine: a window holds at least one value
    if (!(windowSize > 0)) {
      throw new RangeError(`Invalid ${windowSize} windowSize`);
    }
    this.buffer = new Float64Array(windowSize);
  }

  get size(): number {
    return Math.min(this.count, this.windowSize);
  }

  get isEmpty(): boolean {
    return this.count === 0;
  }

  add(value: number): void {
    const firstValue = this.buffer[this.head];
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.windowSize;
    this.count++;
    if (this.count > this.windowSize) {
      this.onRollingWindow(firstValue);
    }
  }

  getValue(index: number): number {
    const actualSize = this.size;
    if (index < 0 || index >= actualSize) {
      throw new RangeError(`Index ${index} out of bounds for size ${actualSize}`);
    }
    const start = this.count <= this.windowSize
      ? 0
      : this.head;
    return this.buffer[(start + index) % this.windowSize];
  }

  clear(): void {
    this.buffer.fill(0);
    this.head = 0;
    this.count = 0;
  }

  protected onRollingWindow(_firstValue: number): void {
    // Hook for subclasses
  }

  [Symbol.iterator](): Iterator<number> {
    const size = this.size;
    let i = 0;
    return {
      next: (): IteratorResult<number> => {
        if (i < size) {
          return { value: this.getValue(i++), done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}
