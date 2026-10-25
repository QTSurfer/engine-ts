/**
 * Simple KV state store for indicators and window listeners.
 * Simplified port of com.wualabs.qtsurfer.engine.core.state.StateStore + MemoryStateStore.
 *
 * Two members differ from the Java interface on purpose. Java's `getCounter(key)` returns the
 * `AtomicInteger` stored under the key and `getAccumulator(key)` an `AtomicDouble`; both exist
 * only so concurrent threads can update one value safely. TypeScript is single-threaded, so here
 * a counter or accumulator is a plain number: `getCounter` returns that number (0 when absent,
 * without creating the entry) and there is no `getAccumulator` (use `add` and `getState`).
 * Consequently `getState` on a key written by `inc`/`dec`/`add` returns a number, not an atomic.
 */
export class StateStore {
  private readonly store = new Map<string, unknown>();
  // Keys last written by inc/dec/add: the numbers Java would hold as AtomicInteger/AtomicDouble,
  // the only ones `reset` zeroes. A number stored with `setState` is left alone, as in Java.
  private readonly counters = new Set<string>();

  getState<T>(key: string): T | undefined;
  getState<T>(key: string, defaultValue: T): T;
  getState<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.store.get(key) as T | undefined;
    return value == null && defaultValue !== undefined ? defaultValue : value;
  }

  setState(key: string, value: unknown): void {
    this.counters.delete(key);
    this.store.set(key, value);
  }

  /**
   * Returns the value under `key`, creating it with `factory` on first access (a missing or null
   * value counts as absent).
   */
  getOrCreateState<T>(key: string, factory: () => T): T {
    let value = this.store.get(key) as T | undefined | null;
    if (value == null) {
      value = factory();
      this.setState(key, value);
    }
    return value;
  }

  inc(key: string): number {
    return this.add(key, 1);
  }

  dec(key: string): number {
    return this.add(key, -1);
  }

  /** Adds `delta` to the number under `key` (0 when absent) and returns the new total. */
  add(key: string, delta: number): number {
    const next = ((this.store.get(key) as number | undefined) ?? 0) + delta;
    this.store.set(key, next);
    this.counters.add(key);
    return next;
  }

  getCounter(key: string): number {
    return (this.store.get(key) as number | undefined) ?? 0;
  }

  /**
   * Resets the value under `key` by its kind, keeping the entry so its type survives: a counter
   * or accumulator (written by `inc`/`dec`/`add`) goes to 0 and a boolean to false. Any other
   * value, and a missing key, are left unchanged.
   */
  reset(key: string): void {
    const state = this.store.get(key);
    if (typeof state === "boolean") {
      this.unset(key);
    } else if (typeof state === "number" && this.counters.has(key)) {
      this.store.set(key, 0);
    }
  }

  set(key: string, value = true): void {
    this.setState(key, value);
  }

  unset(key: string): void {
    this.set(key, false);
  }

  /** True only when the value under `key` is the boolean true; a missing key is false. */
  is(key: string): boolean {
    return this.store.get(key) === true;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Removes one key, or every key when called without one. */
  clear(key?: string): void {
    if (key === undefined) {
      this.store.clear();
      this.counters.clear();
    } else {
      this.store.delete(key);
      this.counters.delete(key);
    }
  }
}
