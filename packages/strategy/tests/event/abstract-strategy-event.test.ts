import { describe, it, expect } from "vitest";
import { AbstractStrategyEvent } from "../../src/event/AbstractStrategyEvent";
import { StrategyEventType } from "../../src/event/StrategyEventType";

class TestEvent extends AbstractStrategyEvent {
  constructor() {
    super("TestStrategy", StrategyEventType.Info);
  }
}

describe("AbstractStrategyEvent", () => {
  it("has strategyName and type", () => {
    const event = new TestEvent();
    expect(event.strategyName).toBe("TestStrategy");
    expect(event.type).toBe(StrategyEventType.Info);
  });

  it("has timestamp", () => {
    const before = Date.now();
    const event = new TestEvent();
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("set and get single property", () => {
    const event = new TestEvent();
    event.set("key", "value");
    expect(event.get<string>("key")).toBe("value");
  });

  it("set and get nested properties", () => {
    const event = new TestEvent();
    event.set("meta", "position", "aboveBar", "color", "green");
    const meta = event.get<Map<string, unknown>>("meta");
    expect(meta).toBeDefined();
    expect(meta!.get("position")).toBe("aboveBar");
    expect(meta!.get("color")).toBe("green");
  });

  it("has returns false for missing key", () => {
    const event = new TestEvent();
    expect(event.has("missing")).toBe(false);
  });

  it("has returns true for set key", () => {
    const event = new TestEvent();
    event.set("key", 42);
    expect(event.has("key")).toBe(true);
  });

  it("get returns undefined for unset key", () => {
    const event = new TestEvent();
    expect(event.get("missing")).toBeUndefined();
  });

  it("set returns this for chaining", () => {
    const event = new TestEvent();
    const result = event.set("a", 1).set("b", 2);
    expect(result).toBe(event);
    expect(event.get<number>("a")).toBe(1);
    expect(event.get<number>("b")).toBe(2);
  });
});
