import { describe, it, expect } from "vitest";
import { CountRTIndicator } from "$helpers/CountRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("CountRTIndicator", () => {
  it("testUpdate", () => {
    const counter = new CountRTIndicator();
    expect(counter.updateCount).toBe(0);
    expect(counter.update(1)).toBe(1);
    expect(counter.updateCount).toBe(1);
    expect(counter.update(2)).toBe(2);
    expect(counter.updateCount).toBe(2);
  });

  it("testUpdateWithStartOffset", () => {
    const counter = new CountRTIndicator(10, null);
    expect(counter.updateCount).toBe(10);
    expect(counter.update(1)).toBe(1);
    expect(counter.updateCount).toBe(11);
  });

  it("testUpdateWithDecorator", () => {
    const counter = new CountRTIndicator(new SmaRTIndicator());
    expect(counter.updateCount).toBe(0);
    expect(counter.update(1)).toBe(1);
    expect(counter.updateCount).toBe(1);
    expect(counter.update(2)).toBe(1.5);
    expect(counter.updateCount).toBe(2);
  });

  it("testReset", () => {
    const counter = new CountRTIndicator();
    counter.update(1);
    expect(counter.updateCount).toBe(1);
    counter.reset();
    expect(counter.updateCount).toBe(0);
  });


  it("a reset returns the whole chain to its start, the decorated indicator included", () => {
    const sma = new SmaRTIndicator(3);
    const counter = new CountRTIndicator(sma);
    for (let i = 1; i <= 5; i++) counter.update(i);
    expect(counter.isReady()).toBe(true);

    counter.reset();

    expect(counter.updateCount).toBe(0);
    expect(sma.isReady()).toBe(false);
    expect(counter.isReady()).toBe(false);
    expect(counter.getValue()).toBe(0);
  });
});
