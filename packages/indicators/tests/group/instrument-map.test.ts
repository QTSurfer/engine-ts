import { describe, it, expect } from "vitest";
import { InstrumentMapRTIndicator } from "$group/InstrumentMapRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("InstrumentMapRTIndicator", () => {
  const INSTRUMENT = "BTC/USDT";

  function createMap() {
    return new InstrumentMapRTIndicator(INSTRUMENT);
  }

  it("stores instrument", () => {
    const map = createMap();
    expect(map.instrument).toBe(INSTRUMENT);
  });

  it("add and getValue", () => {
    const map = createMap();
    const ind = new ValueRTIndicator();
    ind.update(42);
    map.add("test", ind);
    expect(map.getIndicatorValue("test")).toBe(42);
  });

  it("getValue throws for missing indicator", () => {
    const map = createMap();
    expect(() => map.getIndicatorValue("missing")).toThrow("Indicator not found: missing");
  });

  it("get returns undefined for missing", () => {
    const map = createMap();
    expect(map.get("missing")).toBeUndefined();
  });

  it("getExisting throws for missing", () => {
    const map = createMap();
    expect(() => map.getExisting("missing")).toThrow();
  });

  it("getReadOnly returns read-only wrapper", () => {
    const map = createMap();
    const ind = new ValueRTIndicator();
    ind.update(10);
    map.add("price", ind);

    const ro = map.getReadOnly("price");
    expect(ro).toBeDefined();
    expect(ro!.getValue()).toBe(10);

    // Updating through read-only should not mutate original
    ro!.update(999);
    expect(ind.getValue()).toBe(10);
  });

  it("getReadOnly caches result", () => {
    const map = createMap();
    map.add("price", new ValueRTIndicator());
    const ro1 = map.getReadOnly("price");
    const ro2 = map.getReadOnly("price");
    expect(ro1).toBe(ro2);
  });

  it("add invalidates readOnly cache", () => {
    const map = createMap();
    const ind1 = new ValueRTIndicator();
    map.add("price", ind1);
    const ro1 = map.getReadOnly("price");

    const ind2 = new ValueRTIndicator();
    ind2.update(99);
    map.add("price", ind2);
    const ro2 = map.getReadOnly("price");
    expect(ro2).not.toBe(ro1);
    expect(ro2!.getValue()).toBe(99);
  });

  it("remove", () => {
    const map = createMap();
    const ind = new ValueRTIndicator();
    map.add("test", ind);
    expect(map.size()).toBe(1);

    const removed = map.remove("test");
    expect(removed).toBe(ind);
    expect(map.size()).toBe(0);
    expect(map.get("test")).toBeUndefined();
  });

  it("clear", () => {
    const map = createMap();
    map.add("a", new ValueRTIndicator());
    map.add("b", new ValueRTIndicator());
    expect(map.size()).toBe(2);
    map.clear();
    expect(map.size()).toBe(0);
  });

  it("forEachPublicable skips private indicators", () => {
    const map = createMap();
    map.add("price", new ValueRTIndicator());
    map.add("_hidden", new ValueRTIndicator());
    map.add("ema12", new ValueRTIndicator());

    const names: string[] = [];
    map.forEachPublicable((name) => names.push(name));
    expect(names).toEqual(["price", "ema12"]);
  });

  it("reset resets all indicators", () => {
    const map = createMap();
    const ind = new ValueRTIndicator();
    ind.update(42);
    map.add("test", ind);

    map.reset();
    expect(ind.getValue()).toBe(0);
  });
});
