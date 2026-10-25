import type { StateStore } from "@qtsurfer/core";
import { Duration } from "$core/Duration";
import type { RTIndicator } from "$core/RTIndicator";
import type { OnChangeListener } from "$helpers/OnChangeRTIndicator";
import {
  WindowTime,
  WindowTimeRTIndicator,
  resolveWindowPeriod,
  type WindowPeriod,
} from "$helpers/WindowTimeRTIndicator";
import type { InstrumentMapRTIndicator } from "./InstrumentMapRTIndicator";

/**
 * WindowTimeRTIndicator builder: the window of the source it is given, for the period it is given,
 * handed to `onBuilt` under the name it is given (null when it has none).
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.group.WindowTimeRTIndicatorBuilder, with
 * the base class `InstrumentMapRTIndicatorBuilder` folded in: Java has no other builder.
 */
export class WindowTimeRTIndicatorBuilder {
  private windowTime: Duration = WindowTime.s1.getDuration();
  private indicator: RTIndicator | null = null;
  private windowName: string | null = null;
  private listener: OnChangeListener | null = null;
  private delay = false;
  private storeSupplier: (() => StateStore) | null = null;

  constructor(
    private readonly indicators: InstrumentMapRTIndicator,
    private readonly onBuilt: (name: string | null, window: WindowTimeRTIndicator) => void,
  ) {}

  /** The length of the window; a number is whole seconds, as in `InstrumentGroupRTIndicator.window()`. */
  duration(period: WindowPeriod): this {
    this.windowTime = resolveWindowPeriod(period);
    return this;
  }

  durationMinutes(minutes: number): this {
    return this.duration(Duration.ofMinutes(minutes));
  }

  durationSeconds(seconds: number): this {
    return this.duration(Duration.ofSeconds(seconds));
  }

  durationMillis(millis: number): this {
    return this.duration(Duration.ofMillis(millis));
  }

  /** The listener the window notifies when it closes; a second call replaces the first. */
  onChangeListener(listener: OnChangeListener): this {
    this.listener = listener;
    return this;
  }

  /** Not in Java's builder: the window updates its source only when it closes. */
  delayUpdates(delayUpdates = true): this {
    this.delay = delayUpdates;
    return this;
  }

  stateStoreSupplier(supplier: () => StateStore): this {
    this.storeSupplier = supplier;
    return this;
  }

  /** The name the built window is registered under; without one it gets a hidden name. */
  name(windowName: string): this {
    this.windowName = windowName;
    return this;
  }

  /** The source to window: a registered indicator, seen through a read-only view unless asked otherwise. */
  of(name: string, readOnly?: boolean): this;
  of(indicator: RTIndicator): this;
  of(nameOrIndicator: string | RTIndicator, readOnly = true): this {
    if (typeof nameOrIndicator === "string") {
      this.indicator = readOnly
        ? this.indicators.getReadOnlyExisting(nameOrIndicator)
        : this.indicators.getExisting(nameOrIndicator);
    } else {
      this.indicator = nameOrIndicator;
    }
    return this;
  }

  build(): WindowTimeRTIndicator {
    if (this.indicator == null) {
      throw new Error("indicator not set");
    }
    const window = new WindowTimeRTIndicator(this.windowTime, this.indicator);
    if (this.delay) {
      window.setDelayUpdates(true);
    }
    if (this.listener != null) {
      window.addOnChangeListener(this.listener);
    }
    if (this.storeSupplier != null) {
      window.setStateStoreSupplier(this.storeSupplier);
    }
    this.onBuilt(this.windowName, window);
    return window;
  }
}
