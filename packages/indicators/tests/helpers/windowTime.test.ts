import { describe, it, expect } from "vitest";
import { WindowTimeRTIndicator, WindowTime, WindowTimeEntry, JAVA_WINDOW_TIMES } from "$helpers/WindowTimeRTIndicator";
import { Duration } from "$core/Duration";
import { OnChangeRTIndicator } from "$helpers/OnChangeRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import type { WindowTimeKey } from "$helpers/WindowTimeRTIndicator";

describe("WindowTimeRTIndicator", () => {
  it("testAllWindowTimes", () => {
    for (const key of Object.keys(WindowTime) as WindowTimeKey[]) {
      const instance = new WindowTimeRTIndicator(key);
      instance.update(1);
      expect(instance.getValue()).toBe(1);
      instance.update(2);
      expect(instance.getValue()).toBe(1);
      instance.tickClock();
      instance.update(3);
      expect(instance.getValue()).toBe(3);
    }
  });

  it("offers the members of the Java WindowTime enum, each with its Duration", () => {
    expect([...JAVA_WINDOW_TIMES]).toEqual(["s1", "s5", "s10", "s30", "m1", "m3", "m5"]);
    const seconds = { s1: 1, s5: 5, s10: 10, s30: 30, m1: 60, m3: 180, m5: 300 };
    for (const key of JAVA_WINDOW_TIMES) {
      expect(WindowTime[key]).toBeInstanceOf(WindowTimeEntry);
      expect(WindowTime[key].getDuration().equals(Duration.ofSeconds(seconds[key]))).toBe(true);
    }
    // The keys that are not Java's stay
    expect(Object.keys(WindowTime)).toHaveLength(15);
    expect(WindowTime.h1.getDuration().toMillis()).toBe(3_600_000);
  });

  it("takes a Duration or a WindowTime member as its length, and a bare number as milliseconds", () => {
    expect(new WindowTimeRTIndicator(Duration.ofSeconds(900)).getWindowTimeDuration()).toBe(900_000);
    expect(new WindowTimeRTIndicator(WindowTime.m5).getWindowTimeDuration()).toBe(300_000);
    expect(new WindowTimeRTIndicator("m5").getWindowTimeDuration()).toBe(300_000);
    expect(new WindowTimeRTIndicator(3).getWindowTimeDuration()).toBe(3);
    expect(() => new WindowTimeRTIndicator("m7" as never)).toThrow(/Unknown window time/);
    expect(() => new WindowTimeRTIndicator(Duration.ofMillis(0))).toThrow(/at least 1 ms/);
  });

  it("hands its listeners itself as the window, with the instants of the clock", () => {
    const instance = new WindowTimeRTIndicator(Duration.ofSeconds(5));
    let now = 1_000;
    instance.setClockFn(() => now);
    const seen: [number | null, number | null][] = [];
    let handed: unknown = null;
    instance.addOnChangeListener((_store, _prev, _actual, window) => {
      handed = window;
      seen.push([window.getPrevInstant(), window.getCurrInstant()]);
    });
    instance.update(1);
    now = 3_000;
    instance.update(2);
    expect(seen).toEqual([]);
    now = 6_000;
    instance.update(3);
    now = 11_000;
    instance.update(4);
    expect(handed).toBe(instance);
    expect(seen).toEqual([[1_000, 6_000], [6_000, 11_000]]);
  });

  it("testOnChange", () => {
    const instance = new WindowTimeRTIndicator("m1", new OnChangeRTIndicator(new SmaRTIndicator()));
    let updateValue: number | null = null;
    let updates = 0;
    instance.getIndicator<OnChangeRTIndicator>().addOnChangeListener((_state, _prev, _actual) => {});
    instance.addOnChangeListener((_state, _prev, actual) => {
      updateValue = actual;
      updates++;
    });
    instance.update(1);
    expect(instance.getValue()).toBe(1);
    expect(updateValue).toBeNull();
    instance.update(2);
    expect(instance.getValue()).toBe(1);
    instance.update(3);
    expect(instance.getValue()).toBe(1);
    instance.tickClock();
    instance.update(4);
    expect(instance.getValue()).toBeCloseTo((4 + 2.25) / 2, 10);
    expect(updateValue).toBeCloseTo((4 + 2.25) / 2, 10);
    expect(updates).toBe(1);
  });

  it("testDelayedUpdate", () => {
    const instance = new WindowTimeRTIndicator("m1", new SmaRTIndicator());
    instance.setDelayUpdates(true);
    expect(instance.getIndicator().getValue()).toBe(0);
    instance.update(1);
    expect(instance.getValue()).toBe(1);
    expect(instance.getIndicator().getValue()).toBe(1);
    for (let i = 2; i < 10; i++) {
      instance.update(i);
      expect(instance.getValue()).toBe(1);
    }
    instance.tickClock();
    instance.update(3);
    expect(instance.getValue()).toBeCloseTo((3 + 1) / 2, 10);
  });

  it("reports the closed window's boundaries on the window itself, not through the store", () => {
    const instance = new WindowTimeRTIndicator("m1");
    let prevInstant: number | null = null;
    let currInstant: number | null = null;
    instance.addOnChangeListener((_store, _prev, _actual) => {
      prevInstant = instance.getPrevInstant();
      currInstant = instance.getCurrInstant();
    });
    expect(prevInstant).toBeNull();
    expect(currInstant).toBeNull();
    instance.update(1);
    instance.tickClock();
    instance.update(2);
    expect(prevInstant).not.toBeNull();
    expect(currInstant).not.toBeNull();
  });

  it("testReset", () => {
    const values = [1, 2, 3];
    const fresh = new WindowTimeRTIndicator(3);
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(fresh.update(v));
    }
    const wt = new WindowTimeRTIndicator(3);
    for (const v of values) wt.update(v);
    wt.reset();
    expect(wt.getValue()).toBe(0);
    const wt2 = new WindowTimeRTIndicator(3);
    for (let i = 0; i < values.length; i++) {
      const expected = wt2.update(values[i]);
      expect(expected).toBe(firstRunResults[i]);
    }
  });
});
