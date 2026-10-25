import { describe, it, expect } from "vitest";
import { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

describe("DisplayHint", () => {
  it("has a one-letter code for each non-default hint and none for ABSOLUTE", () => {
    expect(DisplayHint.ABSOLUTE.code).toBeNull();
    expect(DisplayHint.PERCENT.code).toBe("P");
    expect(DisplayHint.VOLUME.code).toBe("V");
  });

  it("resolves a code back to its hint", () => {
    expect(DisplayHint.fromCode("P")).toBe(DisplayHint.PERCENT);
    expect(DisplayHint.fromCode("V")).toBe(DisplayHint.VOLUME);
  });

  it("falls back to ABSOLUTE on an absent or unknown code", () => {
    expect(DisplayHint.fromCode(null)).toBe(DisplayHint.ABSOLUTE);
    expect(DisplayHint.fromCode(undefined)).toBe(DisplayHint.ABSOLUTE);
    expect(DisplayHint.fromCode("Z")).toBe(DisplayHint.ABSOLUTE);
    expect(DisplayHint.fromCode("")).toBe(DisplayHint.ABSOLUTE);
  });
});

describe("IndicatorMeta", () => {
  it("uses the short wire keys", () => {
    expect(IndicatorMeta.ID).toBe("id");
    expect(IndicatorMeta.DISPLAY).toBe("dsp");
    expect(IndicatorMeta.SOURCE).toBe("src");
    expect(IndicatorMeta.NAME).toBe("nm");
    expect(IndicatorMeta.VISIBILITY).toBe("vis");
    expect(IndicatorMeta.HIDDEN).toBe("hidden");
  });

  it("stores a value in its string form and returns undefined for a missing key", () => {
    const meta = new IndicatorMeta().set("periods", 14).set("sma", true);
    expect(meta.get("periods")).toBe("14");
    expect(meta.get("sma")).toBe("true");
    expect(meta.get("nope")).toBeUndefined();
  });

  it("is empty until something is set", () => {
    const meta = new IndicatorMeta();
    expect(meta.isEmpty()).toBe(true);
    meta.set("k", 2);
    expect(meta.isEmpty()).toBe(false);
  });

  it("exposes the entries in insertion order, as the wire form", () => {
    const meta = new IndicatorMeta()
      .set(IndicatorMeta.ID, "rsi")
      .set("periods", 14)
      .setDisplayHint(DisplayHint.PERCENT);
    expect([...meta.asMap()]).toEqual([
      ["id", "rsi"],
      ["periods", "14"],
      ["dsp", "P"],
    ]);
  });

  it("reads absence as ABSOLUTE and writes ABSOLUTE as absence", () => {
    const meta = new IndicatorMeta();
    expect(meta.getDisplayHint()).toBe(DisplayHint.ABSOLUTE);
    meta.setDisplayHint(DisplayHint.VOLUME);
    expect(meta.get("dsp")).toBe("V");
    expect(meta.getDisplayHint()).toBe(DisplayHint.VOLUME);
    meta.setDisplayHint(DisplayHint.ABSOLUTE);
    expect(meta.get("dsp")).toBeUndefined();
    expect(meta.isEmpty()).toBe(true);
  });

  it("reads an unknown display code as ABSOLUTE", () => {
    expect(new IndicatorMeta().set("dsp", "Z").getDisplayHint()).toBe(DisplayHint.ABSOLUTE);
  });

  it("marks hidden with the vis key and clears it by removing the entry", () => {
    const meta = new IndicatorMeta();
    expect(meta.isHidden()).toBe(false);
    meta.setHidden(true);
    expect(meta.get("vis")).toBe("hidden");
    expect(meta.isHidden()).toBe(true);
    meta.setHidden(false);
    expect(meta.get("vis")).toBeUndefined();
    expect(meta.isHidden()).toBe(false);
  });

  it("has a shared EMPTY that cannot be changed", () => {
    expect(IndicatorMeta.EMPTY.isEmpty()).toBe(true);
    expect(() => IndicatorMeta.EMPTY.set("k", 1)).toThrow();
    expect(() => IndicatorMeta.EMPTY.setHidden(true)).toThrow();
    expect(() => IndicatorMeta.EMPTY.setDisplayHint(DisplayHint.PERCENT)).toThrow();
    expect(IndicatorMeta.EMPTY.isEmpty()).toBe(true);
  });

  it("derives an id from a class name: no RTIndicator suffix, first letter lower-cased", () => {
    class FooBarRTIndicator {}
    class Plain {}
    expect(IndicatorMeta.deriveId(FooBarRTIndicator)).toBe("fooBar");
    expect(IndicatorMeta.deriveId(Plain)).toBe("plain");
    expect(IndicatorMeta.deriveId(RsiRTIndicator)).toBe("rsi");
  });
});

describe("AbstractRTIndicator metadata", () => {
  it("carries none until it is given some", () => {
    const sma = new SmaRTIndicator(3);
    expect(sma.getMeta()).toBe(IndicatorMeta.EMPTY);
    expect(sma.getDisplayHint()).toBe(DisplayHint.ABSOLUTE);
    expect(sma.isHidden()).toBe(false);
  });

  it("withMeta and withDisplayHint are fluent and keep the concrete type", () => {
    const rsi = new RsiRTIndicator(14, true)
      .withMeta("periods", 14)
      .withDisplayHint(DisplayHint.PERCENT);
    expect(rsi).toBeInstanceOf(RsiRTIndicator);
    expect(Object.fromEntries(rsi.getMeta().asMap())).toEqual({ periods: "14", dsp: "P" });
    expect(rsi.getDisplayHint()).toBe(DisplayHint.PERCENT);
  });

  it("does not share metadata between instances", () => {
    const a = new SmaRTIndicator(3).withMeta("periods", 3);
    const b = new SmaRTIndicator(3);
    expect(b.getMeta().isEmpty()).toBe(true);
    expect(a.getMeta().get("periods")).toBe("3");
  });

  it("hide marks the indicator hidden, and it is still updated", () => {
    const value = new ValueRTIndicator();
    expect(value.hide()).toBe(value);
    expect(value.isHidden()).toBe(true);
    expect(value.getMeta().get("vis")).toBe("hidden");
    value.update(7);
    expect(value.getValue()).toBe(7);
  });

  it("derives the id from the class name", () => {
    expect(new RsiRTIndicator(14, true).getId()).toBe("rsi");
    expect(new SmaRTIndicator(3).getId()).toBe("sma");
    expect(new ValueRTIndicator().getId()).toBe("value");
  });

  it("an explicit id wins over the derived one", () => {
    expect(new SmaRTIndicator(3).withMeta(IndicatorMeta.ID, "custom").getId()).toBe("custom");
  });

  it("is a write-only descriptor: the values do not change with it", () => {
    const plain = new RsiRTIndicator(3, true);
    const described = new RsiRTIndicator(3, true)
      .withMeta("periods", 99)
      .withMeta(IndicatorMeta.ID, "other")
      .withDisplayHint(DisplayHint.VOLUME)
      .hide();
    const prices = [10, 11, 12, 11, 13, 12, 14, 15, 14];
    for (const price of prices) {
      expect(described.update(price)).toBe(plain.update(price));
    }
  });
});

describe("ReadOnlyRTIndicator metadata", () => {
  it("reads the metadata and the id of the wrapped indicator", () => {
    const rsi = new RsiRTIndicator(14, true).withMeta("periods", 14).withDisplayHint(DisplayHint.PERCENT);
    const view = new ReadOnlyRTIndicator(rsi);
    expect(view.getMeta()).toBe(rsi.getMeta());
    expect(view.getDisplayHint()).toBe(DisplayHint.PERCENT);
    expect(view.getId()).toBe("rsi");
    expect(view.getId()).not.toBe("readOnly");
  });

  it("writes metadata and the display hint through to the wrapped indicator", () => {
    const sma = new SmaRTIndicator(3);
    const view = new ReadOnlyRTIndicator(sma);
    expect(view.withMeta("periods", 3)).toBe(view);
    expect(view.withDisplayHint(DisplayHint.PERCENT)).toBe(view);
    expect(sma.getMeta().get("periods")).toBe("3");
    expect(sma.getDisplayHint()).toBe(DisplayHint.PERCENT);
    expect(view.getMeta().get("periods")).toBe("3");
  });

  it("reads the descriptor of a wrapped indicator that carries none as empty", () => {
    const bare: RTIndicator = {
      getValue: () => 1,
      update: (value) => value,
      isReady: () => true,
      reset: () => {},
    };
    const view = new ReadOnlyRTIndicator(bare);
    expect(view.getMeta()).toBe(IndicatorMeta.EMPTY);
    expect(view.getDisplayHint()).toBe(DisplayHint.ABSOLUTE);
    expect(view.isHidden()).toBe(false);
    // Nothing to write to: the write is dropped, not thrown, and not kept on the view
    expect(() => view.withMeta("k", 1).withDisplayHint(DisplayHint.PERCENT)).not.toThrow();
    expect(view.getMeta().isEmpty()).toBe(true);
  });

  it("still guards the value", () => {
    const value = new ValueRTIndicator(5);
    const view = new ReadOnlyRTIndicator(value);
    view.update(99);
    expect(value.getValue()).toBe(5);
    expect(view.getValue()).toBe(5);
  });

  it("is an AbstractRTIndicator like any other", () => {
    expect(new ReadOnlyRTIndicator(new ValueRTIndicator())).toBeInstanceOf(AbstractRTIndicator);
  });
});
