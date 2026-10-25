import { describe, it, expect } from "vitest";
import { StateStore } from "../src/StateStore";

describe("StateStore", () => {
  describe("existing behaviour", () => {
    it("reads back what setState wrote", () => {
      const store = new StateStore();
      store.setState("k", { a: 1 });
      expect(store.getState("k")).toEqual({ a: 1 });
      expect(store.getState("missing")).toBeUndefined();
    });

    it("inc counts from 0 and getCounter reads the number without creating it", () => {
      const store = new StateStore();
      expect(store.getCounter("n")).toBe(0);
      expect(store.has("n")).toBe(false);
      expect(store.inc("n")).toBe(1);
      expect(store.inc("n")).toBe(2);
      expect(store.getCounter("n")).toBe(2);
    });

    it("has tells a stored key from a missing one; clear() drops everything", () => {
      const store = new StateStore();
      store.setState("a", 1);
      expect(store.has("a")).toBe(true);
      store.clear();
      expect(store.has("a")).toBe(false);
    });
  });

  describe("getState with a default", () => {
    it("returns the default only when the key holds nothing", () => {
      const store = new StateStore();
      expect(store.getState("x", 0.5)).toBe(0.5);
      store.setState("x", 0);
      expect(store.getState("x", 0.5)).toBe(0);
      store.setState("x", null);
      expect(store.getState("x", 7)).toBe(7);
    });

    it("does not store the default", () => {
      const store = new StateStore();
      store.getState("x", 1);
      expect(store.has("x")).toBe(false);
    });
  });

  describe("clear(key)", () => {
    it("removes one key and leaves the others", () => {
      const store = new StateStore();
      store.setState("a", 1);
      store.setState("b", 2);
      store.clear("a");
      expect(store.has("a")).toBe(false);
      expect(store.getState("a")).toBeUndefined();
      expect(store.getState("b")).toBe(2);
    });

    it("lets a counter start again from 0", () => {
      const store = new StateStore();
      store.inc("n");
      store.clear("n");
      expect(store.inc("n")).toBe(1);
    });
  });

  describe("dec and add", () => {
    it("dec counts down from 0 on a missing key", () => {
      const store = new StateStore();
      expect(store.dec("n")).toBe(-1);
      expect(store.dec("n")).toBe(-2);
      expect(store.inc("n")).toBe(-1);
    });

    it("add accumulates and returns the new total, starting from 0", () => {
      const store = new StateStore();
      expect(store.add("sum", 1.5)).toBe(1.5);
      expect(store.add("sum", 2)).toBe(3.5);
      expect(store.add("sum", -0.5)).toBe(3);
      expect(store.getState("sum")).toBe(3);
    });
  });

  describe("reset", () => {
    it("zeroes a counter or accumulator but keeps the entry", () => {
      const store = new StateStore();
      store.inc("n");
      store.inc("n");
      store.add("sum", 2.5);
      store.reset("n");
      store.reset("sum");
      expect(store.has("n")).toBe(true);
      expect(store.getCounter("n")).toBe(0);
      expect(store.getState("sum")).toBe(0);
      expect(store.inc("n")).toBe(1);
    });

    it("unsets a boolean to false and keeps the entry", () => {
      const store = new StateStore();
      store.set("flag");
      store.reset("flag");
      expect(store.has("flag")).toBe(true);
      expect(store.is("flag")).toBe(false);
      expect(store.getState("flag")).toBe(false);
    });

    it("leaves every other value alone, a number set with setState included", () => {
      const store = new StateStore();
      store.setState("last", 5);
      store.setState("name", "abc");
      store.setState("obj", { a: 1 });
      store.reset("last");
      store.reset("name");
      store.reset("obj");
      expect(store.getState("last")).toBe(5);
      expect(store.getState("name")).toBe("abc");
      expect(store.getState("obj")).toEqual({ a: 1 });
    });

    it("stops treating a counter as one once setState overwrote it", () => {
      const store = new StateStore();
      store.inc("n");
      store.setState("n", 9);
      store.reset("n");
      expect(store.getState("n")).toBe(9);
    });

    it("does nothing, and creates nothing, on a missing key", () => {
      const store = new StateStore();
      store.reset("missing");
      expect(store.has("missing")).toBe(false);
    });
  });

  describe("boolean flags", () => {
    it("set(key) sets true, set(key, false) and unset(key) set false", () => {
      const store = new StateStore();
      store.set("f");
      expect(store.is("f")).toBe(true);
      expect(store.getState("f")).toBe(true);
      store.set("f", false);
      expect(store.is("f")).toBe(false);
      store.set("f", true);
      store.unset("f");
      expect(store.is("f")).toBe(false);
      expect(store.getState("f")).toBe(false);
    });

    it("is() is false for a missing key and does not create it", () => {
      const store = new StateStore();
      expect(store.is("never")).toBe(false);
      expect(store.has("never")).toBe(false);
    });

    it("is() is true only for the boolean true", () => {
      const store = new StateStore();
      store.setState("n", 1);
      store.setState("s", "true");
      expect(store.is("n")).toBe(false);
      expect(store.is("s")).toBe(false);
    });
  });

  describe("getOrCreateState", () => {
    it("creates and stores the value on first access, then returns the same one", () => {
      const store = new StateStore();
      let created = 0;
      const first = store.getOrCreateState("list", () => {
        created++;
        return [1];
      });
      const second = store.getOrCreateState("list", () => {
        created++;
        return [2];
      });
      expect(second).toBe(first);
      expect(created).toBe(1);
      expect(store.getState("list")).toBe(first);
    });

    it("treats a null value as absent", () => {
      const store = new StateStore();
      store.setState("k", null);
      expect(store.getOrCreateState("k", () => 3)).toBe(3);
    });
  });
});
