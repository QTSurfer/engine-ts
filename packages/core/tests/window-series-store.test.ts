import { describe, it, expect } from "vitest";
import { WindowSeriesStore } from "../src/WindowSeriesStore";

describe("WindowSeriesStore", () => {
  it("refuses a window that cannot hold a value, as the Java engine does", () => {
    expect(() => new WindowSeriesStore(0)).toThrow(RangeError);
    expect(() => new WindowSeriesStore(-3)).toThrow(RangeError);
    expect(() => new WindowSeriesStore(NaN)).toThrow(RangeError);
  });

  it("keeps the last values, oldest first", () => {
    const store = new WindowSeriesStore(3);
    [1, 2, 3, 4].forEach((v) => store.add(v));
    expect(store.size).toBe(3);
    expect([0, 1, 2].map((i) => store.getValue(i))).toEqual([2, 3, 4]);
  });
});
