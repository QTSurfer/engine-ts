import { describe, it, expect } from "vitest";
import { OnChangeRTIndicator, type WindowContext } from "$helpers/OnChangeRTIndicator";

describe("OnChangeRTIndicator", () => {
  it("testOnChangeListener", () => {
    const instance = new OnChangeRTIndicator();
    let updates = 0;
    instance.addOnChangeListener((_state, _prev, _actual) => {
      updates++;
    });
    instance.update(1);
    expect(updates).toBe(0); // first update = init, no prev to compare
    instance.update(100);
    expect(updates).toBe(1);
  });

  it("hands the listener a resolved store, not something to resolve", () => {
    const instance = new OnChangeRTIndicator();
    instance.addOnChangeListener((store, _prev, _actual) => {
      store.inc("updates");
    });
    instance.update(1);
    expect(instance.getStateStore().getCounter("updates")).toBe(0);
    instance.update(10);
    expect(instance.getStateStore().getCounter("updates")).toBe(1);
    instance.update(100);
    expect(instance.getStateStore().getCounter("updates")).toBe(2);
  });

  it("hands the listener a window that has no instants to give when the indicator is not a window", () => {
    const instance = new OnChangeRTIndicator();
    const handed: WindowContext[] = [];
    instance.addOnChangeListener((_store, _prev, _actual, window) => handed.push(window));
    instance.addOnChangeListener((_store, _prev, _actual) => {});
    instance.update(1);
    instance.update(10);
    expect(handed).toHaveLength(1);
    expect(() => handed[0].getPrevInstant()).toThrow(/only available to a listener registered on a window/);
    expect(() => handed[0].getCurrInstant()).toThrow(/No window bound/);
  });

  it("testReset", () => {
    const instance = new OnChangeRTIndicator();
    const values = [1, 10, 100];
    const firstRunResults: number[] = [];
    for (const v of values) {
      firstRunResults.push(instance.update(v));
    }
    instance.reset();
    expect(instance.getValue()).toBe(0);
    for (let i = 0; i < values.length; i++) {
      expect(instance.update(values[i])).toBe(firstRunResults[i]);
    }
  });
});
