import { Duration } from "$core/Duration";
import { OnChangeRTIndicator, type WindowContext } from "./OnChangeRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/** A member of `WindowTime`, as in Java: `WindowTime.m1.getDuration()`. */
export class WindowTimeEntry {
  constructor(private readonly duration: Duration) {}

  getDuration(): Duration {
    return this.duration;
  }
}

const entry = (millis: number) => new WindowTimeEntry(Duration.ofMillis(millis));

export const WindowTime = {
  s1: entry(1_000),
  s2: entry(2_000),
  s3: entry(3_000),
  s5: entry(5_000),
  s10: entry(10_000),
  s15: entry(15_000),
  s30: entry(30_000),
  m1: entry(60_000),
  m2: entry(120_000),
  m3: entry(180_000),
  m5: entry(300_000),
  m10: entry(600_000),
  m15: entry(900_000),
  m30: entry(1_800_000),
  h1: entry(3_600_000),
} as const;

export type WindowTimeKey = keyof typeof WindowTime;

/** The members of the Java `WindowTime` enum; the other keys are only offered here. */
export const JAVA_WINDOW_TIMES = ["s1", "s5", "s10", "s30", "m1", "m3", "m5"] as const satisfies readonly WindowTimeKey[];

/**
 * How a window length can be given: a key or entry of `WindowTime`, a `Duration`, or a number of
 * whole seconds, which is Java's `int windowTimeSeconds`.
 */
export type WindowPeriod = WindowTimeKey | WindowTimeEntry | Duration | number;

/**
 * The length a period stands for. Java's windows accept any `Duration`, zero and negative ones
 * included; here a window must last at least a millisecond, and seconds are a whole number of at
 * least 1.
 */
export function resolveWindowPeriod(period: WindowPeriod): Duration {
  if (typeof period === "string") {
    if (!Object.hasOwn(WindowTime, period)) {
      throw new Error(`Unknown window time "${period}"; use one of ${Object.keys(WindowTime).join(", ")}`);
    }
    return WindowTime[period].getDuration();
  }
  if (typeof period === "number") {
    if (!Number.isSafeInteger(period) || period < 1) {
      throw new Error(`A window of ${period} seconds: seconds must be a whole number of at least 1`);
    }
    return Duration.ofSeconds(period);
  }
  const duration = period instanceof WindowTimeEntry ? period.getDuration() : period;
  if (!(duration instanceof Duration)) {
    throw new Error("A window length is a WindowTime key, a number of seconds or a Duration");
  }
  if (duration.toMillis() < 1) {
    throw new Error(`A window must last at least 1 ms, got ${duration.toMillis()} ms`);
  }
  return duration;
}

// The window's boundaries used to be written into the state store under "prvInstnt"/"curInstnt".
// They are the window's own property, not shared state, and going through the store made them
// unaddressable for an auto-named window — so they are reported by getPrevInstant()/getCurrInstant()
// instead. Mirrors the Java contract.

/**
 * Time-based windowed indicator that batches updates over a configurable duration.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.WindowTimeRTIndicator
 */
export class WindowTimeRTIndicator extends OnChangeRTIndicator implements WindowContext {
  private windowTimeDuration: number; // ms
  /** When the window currently filling opened. Internal bookkeeping, not the reported boundary. */
  private prevInstant: number | null = null;
  private currInstant: number | null = null;
  private clockFn: () => number = Date.now;
  private clockOffset = 0;
  private delayUpdates = false;

  /**
   * A bare number is milliseconds here, as it always was; `InstrumentGroupRTIndicator.window()`
   * and its builder take seconds, as Java's `WindowTimeRTIndicator(long)` does.
   */
  constructor(windowTime: WindowTimeKey | WindowTimeEntry | Duration | number, indicator?: RTIndicator) {
    if (indicator != null) {
      super(indicator);
    } else {
      super();
    }
    this.windowTimeDuration = typeof windowTime === "number"
      ? windowTime
      : resolveWindowPeriod(windowTime).toMillis();
  }

  getWindowTimeDuration(): number {
    return this.windowTimeDuration;
  }

  /** Advance internal clock by the window duration. Useful for tests. */
  tickClock(): void {
    this.clockOffset += this.windowTimeDuration;
  }

  /** When the window that just fired had opened, or null before its first close. */
  getPrevInstant(): number | null {
    return this.prevInstant;
  }

  /** When it closed — the instant the current notification is about. */
  getCurrInstant(): number | null {
    return this.currInstant;
  }

  protected override windowContext(): WindowContext {
    return this;
  }

  override setClockFn(fn: () => number): void {
    this.clockFn = fn;
    super.setClockFn(fn);
  }

  setDelayUpdates(delayUpdates: boolean): void {
    this.delayUpdates = delayUpdates;
  }

  override isEnableEvents(): boolean {
    return false;
  }

  override setEnableEvents(_enable: boolean): void {
    // no-op
  }

  override update(newValue: number): number {
    const now = this.clockFn() + this.clockOffset;

    const opened = this.currInstant;
    if (opened === null) {
      // The first update opens the first window, as in the Java engine
      this.currInstant = now;
      return super.update(newValue);
    }

    const prevValue = this.getValue();
    let nextValue = this.delayUpdates ? 0 : super.update(newValue);

    if (now - opened >= this.windowTimeDuration) {
      // Report the boundaries of the window that just closed, then open the next one.
      this.prevInstant = opened;
      this.currInstant = now;
      if (this.delayUpdates) {
        nextValue = super.update(newValue);
      }
      this.notifyOnChange(prevValue, nextValue);
      return nextValue;
    }

    return this.setValue(prevValue);
  }

  /** As in the Java engine, the window boundaries survive a reset; the next update continues them. */
  override reset(): void {
    super.reset();
  }
}
