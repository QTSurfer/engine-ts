import { StateStore } from "@qtsurfer/core";
import { AbstractDecorableIncrementalRTIndicator } from "$core/AbstractDecorableIncrementalRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";

/**
 * Receives a change notification with the store already resolved.
 *
 * The store is **event data**, handed in alongside the values it belongs to — not listener state to
 * be wired up beforehand. Mirrors the Java contract after `StateStoreSupport` was retired: no init
 * ritual, no store field to hold. A fourth parameter, ignored by a listener that does not declare
 * it, is the window that is notifying (see `WindowContext`).
 */
export type OnChangeListener = (
  store: StateStore,
  prev: number,
  actual: number,
  window: WindowContext,
) => void;

/**
 * The window that is notifying a listener, so it can read the boundaries of the window that fired:
 * what Java's `AbstractWindowListener.getPrevInstant()` and `getCurrInstant()` report.
 *
 * Instants are epoch milliseconds (`number | null`), not `Instant` objects. This is the live
 * window, which moves on at its next close: read the instants inside the call and keep the
 * numbers, not the window. On an indicator that is not a window the accessors throw, as Java's
 * listener does when it is registered on a plain indicator.
 */
export interface WindowContext {
  /** When the window being reported had opened; null before its first close. */
  getPrevInstant(): number | null;
  /** When it closed, which is the instant the event is about; null before its first close. */
  getCurrInstant(): number | null;
}

const NO_WINDOW: WindowContext = {
  getPrevInstant: noWindow,
  getCurrInstant: noWindow,
};

function noWindow(): never {
  throw new Error("No window bound to this listener: window instants are only available to a listener registered on a window");
}

/**
 * Incremental indicator that fires change notifications to registered listeners.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.OnChangeRTIndicator
 */
export class OnChangeRTIndicator extends AbstractDecorableIncrementalRTIndicator {

  private stateStore: StateStore | null = null;
  private stateStoreSupplier: (() => StateStore) | null = null;
  private listeners: OnChangeListener[] = [];
  private enableEvents = true;

  constructor();
  constructor(indicator: RTIndicator);
  constructor(indicator?: RTIndicator) {
    if (indicator != null) {
      super(indicator);
    } else {
      super();
    }
  }

  setEnableEvents(enable: boolean): void {
    this.enableEvents = enable;
  }

  isEnableEvents(): boolean {
    return this.enableEvents;
  }

  addOnChangeListener(listener: OnChangeListener): void {
    this.listeners.push(listener);
  }

  removeOnChangeListener(listener: OnChangeListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  clearOnChangeListeners(): void {
    this.listeners.length = 0;
  }

  /**
   * Points this indicator at an externally owned store — typically the strategy's per-instrument
   * one, so every indicator and listener on an instrument shares a single store instead of each
   * keeping a private one.
   */
  setStateStoreSupplier(supplier: () => StateStore): void {
    this.stateStoreSupplier = supplier;
    this.stateStore = null;
  }

  /**
   * The store backing this indicator's notifications, resolved on first use.
   *
   * Lazy on purpose: an indicator nobody listens to never creates one, and where a supplier has
   * been set it is consulted rather than a private store being minted.
   */
  getStateStore(): StateStore {
    if (this.stateStore == null) {
      this.stateStore =
        this.stateStoreSupplier != null ? this.stateStoreSupplier() : new StateStore();
    }
    return this.stateStore;
  }

  protected override nextValue(prevValue: number, newValue: number): number {
    if (this.isEnableEvents()) {
      this.notifyOnChange(prevValue, newValue);
    }
    return super.nextValue(prevValue, newValue);
  }

  protected notifyOnChange(prevValue: number, newValue: number): void {
    if (this.listeners.length === 0) {
      // Nothing to notify, and resolving the store here would defeat its laziness.
      return;
    }
    const store = this.getStateStore();
    const window = this.windowContext();
    for (const listener of this.listeners) {
      listener(store, prevValue, newValue, window);
    }
  }

  /** What listeners get as their window: none here, a window gives itself. */
  protected windowContext(): WindowContext {
    return NO_WINDOW;
  }
}
