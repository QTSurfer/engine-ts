import { describe, it, expect } from "vitest";
import { StateStore } from "@qtsurfer/core";
import { WindowTimeRTIndicator } from "$helpers/WindowTimeRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";

// The Java engine's window boundaries and state store, as in its WindowTimeRTIndicator and
// InstrumentGroupRTIndicator.getStateStore

describe("WindowTimeRTIndicator boundaries", () => {
  it("opens the first window on the first update", () => {
    let now = 1_000;
    const window = new WindowTimeRTIndicator("s1", new ValueRTIndicator());
    window.setClockFn(() => now);
    expect(window.getCurrInstant()).toBeNull();
    window.update(5);
    expect(window.getCurrInstant()).toBe(1_000);
    expect(window.getPrevInstant()).toBeNull();
    now = 2_000;
    window.update(6);
    expect(window.getPrevInstant()).toBe(1_000);
    expect(window.getCurrInstant()).toBe(2_000);
  });

  it("keeps the boundaries through a reset, and the next update continues them", () => {
    let now = 1_000;
    const window = new WindowTimeRTIndicator("s1", new ValueRTIndicator());
    window.setClockFn(() => now);
    window.update(5);
    now = 2_000;
    window.update(6);
    window.reset();
    expect(window.getCurrInstant()).toBe(2_000);
    expect(window.getPrevInstant()).toBe(1_000);
    now = 2_400; // still inside the window that opened at 2000
    window.update(7);
    expect(window.getCurrInstant()).toBe(2_000);
  });
});

describe("InstrumentGroupRTIndicator state store", () => {
  it("asks the supplier for the store on every call, as the Java engine does", () => {
    let asked = 0;
    const group = new InstrumentGroupRTIndicator("BTC/USDT").addPrice();
    group.setStateStoreSupplier(() => {
      asked++;
      return new StateStore();
    });
    group.getStateStore();
    group.getStateStore();
    group.getStateStore();
    expect(asked).toBe(3);
  });

  it("keeps its own store, made once, when there is no supplier", () => {
    const group = new InstrumentGroupRTIndicator("BTC/USDT").addPrice();
    expect(group.getStateStore()).toBe(group.getStateStore());
  });
});
