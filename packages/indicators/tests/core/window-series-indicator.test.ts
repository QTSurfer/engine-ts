import { describe, it, expect } from "vitest";
import { AbstractWindowSeriesRTIndicator } from "$core/AbstractWindowSeriesRTIndicator";

/** Keeps the last `periods` values and records what its window evicts. */
class Probe extends AbstractWindowSeriesRTIndicator {
  readonly evicted: number[] = [];

  constructor(periods: number) {
    super(periods);
  }

  override update(newValue: number): number {
    this.window().add(newValue);
    return this.setValue(newValue);
  }

  protected override onEvict(evicted: number): void {
    this.evicted.push(evicted);
  }

  windowClass(): unknown {
    return this.window().constructor;
  }
}

describe("AbstractWindowSeriesRTIndicator", () => {
  it("hands each value its window evicts to the indicator, oldest first", () => {
    const probe = new Probe(3);
    [1, 2, 3, 4, 5].forEach((value) => probe.update(value));
    expect(probe.evicted).toEqual([1, 2]);
  });

  it("gives every instance a window of the same class", () => {
    // A class per instance leaves the window's call sites unoptimised once a few instances exist
    expect(new Probe(3).windowClass()).toBe(new Probe(20).windowClass());
  });
});
