import { describe, it, expect } from "vitest";
import { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import { PlotSide } from "$core/PlotSide";
import { PlotStyle } from "$core/PlotStyle";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { ReadOnlyRTIndicator } from "$numeric/ReadOnlyRTIndicator";

/** The keys that tell a chart where and how to draw an output; each default is the absent entry. */
describe("the visualization keys of IndicatorMeta", () => {
  it("every default is the absence of the entry", () => {
    const meta = new IndicatorMeta();
    expect(meta.isOverlay()).toBe(false);
    expect(meta.getRange()).toBeNull();
    expect(meta.getFloor()).toBeNaN();
    expect(meta.getLevels()).toEqual([]);
    expect(meta.getPlotStyle()).toBe(PlotStyle.LINE);
    expect(meta.getPlotSide()).toBe(PlotSide.NONE);
    expect(meta.isDrawnByDefault()).toBe(true);
    expect(meta.isEmpty()).toBe(true);
  });

  it("setting the default removes the entry", () => {
    const meta = new IndicatorMeta()
      .setOverlay(true)
      .setPlotStyle(PlotStyle.DOTS)
      .setPlotSide(PlotSide.UP)
      .setDrawnByDefault(false);
    meta.setOverlay(false).setPlotStyle(PlotStyle.LINE).setPlotSide(PlotSide.NONE).setDrawnByDefault(true);
    expect(meta.isEmpty()).toBe(true);
  });

  it("the wire form is the compact spelling", () => {
    const meta = new IndicatorMeta()
      .setOverlay(true)
      .setRange(-100, 0)
      .setFloor(0)
      .setLevels(0)
      .setPlotStyle(PlotStyle.HISTOGRAM)
      .setPlotSide(PlotSide.DOWN)
      .setDrawnByDefault(false);
    expect(Object.fromEntries(meta.asMap())).toEqual({
      plc: "o",
      rng: "-100:0",
      flo: "0",
      lvl: "0",
      sty: "h",
      sde: "d",
      drw: "0",
    });
  });

  it("a range and a floor round trip with fractions", () => {
    const meta = new IndicatorMeta().setRange(-1, 1).setFloor(0.5);
    expect(meta.get("rng")).toBe("-1:1");
    expect(meta.getRange()).toEqual([-1, 1]);
    expect(meta.getFloor()).toBe(0.5);
    expect(new IndicatorMeta().setRange(0.25, 0.75).getRange()).toEqual([0.25, 0.75]);
  });

  it("levels round trip as a list", () => {
    const meta = new IndicatorMeta().setLevels(0, 50, -1.5);
    expect(meta.get("lvl")).toBe("0,50,-1.5");
    expect(meta.getLevels()).toEqual([0, 50, -1.5]);
    expect(meta.setLevels().isEmpty()).toBe(true);
  });

  it("a malformed entry reads as the default and never throws", () => {
    const meta = new IndicatorMeta()
      .set("rng", "abc")
      .set("flo", "x")
      .set("lvl", "0,,y,2")
      .set("sty", "z")
      .set("sde", "?")
      .set("plc", "x");
    expect(meta.getRange()).toBeNull();
    expect(new IndicatorMeta().set("rng", "5:1").getRange()).toBeNull();
    expect(new IndicatorMeta().set("rng", ":5").getRange()).toBeNull();
    expect(new IndicatorMeta().set("rng", "1:").getRange()).toBeNull();
    expect(meta.getFloor()).toBeNaN();
    expect(meta.getLevels()).toEqual([0, 2]);
    expect(meta.getPlotStyle()).toBe(PlotStyle.LINE);
    expect(meta.getPlotSide()).toBe(PlotSide.NONE);
    expect(meta.isOverlay()).toBe(false);
  });

  it("a setter rejects what could not be drawn", () => {
    expect(() => new IndicatorMeta().setRange(1, 1)).toThrow(RangeError);
    expect(() => new IndicatorMeta().setRange(2, 1)).toThrow(RangeError);
    expect(() => new IndicatorMeta().setRange(Number.NaN, 1)).toThrow(RangeError);
    expect(() => new IndicatorMeta().setFloor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => new IndicatorMeta().setLevels(0, Number.NaN)).toThrow(RangeError);
  });

  it("the new display units have their one-letter codes", () => {
    expect(DisplayHint.FRACTION.code).toBe("F");
    expect(DisplayHint.RATIO.code).toBe("R");
    expect(DisplayHint.INDEX.code).toBe("I");
    expect(DisplayHint.NUMBER.code).toBe("N");
    for (const hint of DisplayHint.values) {
      expect(DisplayHint.fromCode(hint.code)).toBe(hint);
    }
    expect(new IndicatorMeta().setDisplayHint(DisplayHint.RATIO).get("dsp")).toBe("R");
    expect(new IndicatorMeta().set("dsp", "F").getDisplayHint()).toBe(DisplayHint.FRACTION);
    // an older reader meets a code it does not know and falls back to the default
    expect(DisplayHint.fromCode("Q")).toBe(DisplayHint.ABSOLUTE);
  });

  it("codes are unique within an enum", () => {
    for (const all of [DisplayHint.values, PlotStyle.values, PlotSide.values]) {
      expect(new Set(all.map((entry) => entry.code)).size).toBe(all.length);
    }
  });

  it("the shared empty metadata stays immutable", () => {
    expect(() => IndicatorMeta.EMPTY.setRange(0, 1)).toThrow("IndicatorMeta.EMPTY cannot be changed");
    expect(() => IndicatorMeta.EMPTY.setOverlay(true)).toThrow();
    expect(() => IndicatorMeta.EMPTY.setDrawnByDefault(false)).toThrow();
  });

  it("the parameter keys are the literals already on the wire", () => {
    expect(IndicatorMeta.PERIODS).toBe("periods");
    expect(IndicatorMeta.K).toBe("k");
    expect(IndicatorMeta.ER_PERIOD).toBe("erPeriod");
    expect(IndicatorMeta.SHORT_PERIODS).toBe("shortPeriods");
    expect(IndicatorMeta.BAND).toBe("band");
    expect(IndicatorMeta.OUTPUT).toBe("output");
  });

  it("an indicator takes the typed keys through withMeta(editor), and a read-only view passes them on", () => {
    const sma = new SmaRTIndicator(5).withMeta((meta) => meta.setOverlay(true).setFloor(0));
    expect(sma.getMeta().get("plc")).toBe("o");
    expect(sma.getMeta().get("flo")).toBe("0");
    const view = new ReadOnlyRTIndicator(new SmaRTIndicator(5));
    view.withMeta((meta) => meta.setLevels(0));
    expect(view.getMeta().get("lvl")).toBe("0");
  });
});
