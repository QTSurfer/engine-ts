import { describe, it, expect } from "vitest";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";

describe("SmaRTIndicator", () => {
  it("testBasic (2-period default)", () => {
    const sma = new SmaRTIndicator();
    sma.update(1);
    expect(sma.getValue()).toBe(1);
    expect(sma.periodCycles).toBe(0);
    sma.update(3);
    expect(sma.getValue()).toBe(2);
    expect(sma.periodCycles).toBe(0);
    sma.update(5);
    expect(sma.getValue()).toBe((5 + 2) / 2);
    expect(sma.periodCycles).toBe(0);
  });

  it("testBasicWithMoreThan2Periods", () => {
    const sma = new SmaRTIndicator(3);
    sma.update(1);
    expect(sma.getValue()).toBe(1);
    expect(sma.periodCycles).toBe(0);
    sma.update(3);
    expect(sma.getValue()).toBe(1);
    expect(sma.periodCycles).toBe(0);
    sma.update(5);
    expect(sma.getValue()).toBe((5 + 3 + 1) / 3);
    expect(sma.periodCycles).toBe(1);
    sma.update(1);
    expect(sma.getValue()).toBe(3);
    expect(sma.periodCycles).toBe(1);
    sma.update(3);
    expect(sma.getValue()).toBe(3);
    expect(sma.periodCycles).toBe(1);
    sma.update(5);
    expect(sma.getValue()).toBe((5 + 3 + 1) / 3);
    expect(sma.periodCycles).toBe(2);
  });

  it("testBasicWithMoreThan2PeriodsInMovingMode", () => {
    const sma = new SmaRTIndicator(3).withDiscreteMode(false);
    sma.update(1);
    expect(sma.getValue()).toBe(1);
    expect(sma.periodCycles).toBe(0);
    sma.update(3);
    expect(sma.getValue()).toBe(1);
    expect(sma.periodCycles).toBe(0);
    sma.update(5);
    expect(sma.getValue()).toBe((5 + 3 + 1) / 3);
    expect(sma.periodCycles).toBe(1);
    sma.update(1);
    expect(sma.getValue()).toBe((1 + 5 + 3) / 3);
    expect(sma.periodCycles).toBe(1);
    sma.update(3);
    expect(sma.getValue()).toBe((3 + 1 + 5) / 3);
    expect(sma.periodCycles).toBe(1);
    sma.update(5);
    expect(sma.getValue()).toBe((5 + 3 + 1) / 3);
    expect(sma.periodCycles).toBe(2);
  });

  it("testDecorated", () => {
    const sma = new SmaRTIndicator(new SmaRTIndicator());
    sma.update(1);
    expect(sma.getValue()).toBe(1);
    sma.update(3);
    expect(sma.getValue()).toBe(1.5);
    sma.update(5);
    expect(sma.getValue()).toBe(2.5);
    sma.update(5);
    expect(sma.getValue()).toBe(3.375);
  });

  it("testDiscreteModeSlidingWindow", () => {
    const sma = new SmaRTIndicator(3);
    sma.update(10);
    expect(sma.getValue()).toBe(10);
    expect(sma.periodCycles).toBe(0);

    sma.update(20);
    expect(sma.getValue()).toBe(10);
    expect(sma.periodCycles).toBe(0);

    sma.update(30);
    expect(sma.getValue()).toBe(20); // (10+20+30)/3
    expect(sma.periodCycles).toBe(1);

    sma.update(40);
    expect(sma.getValue()).toBe(20);
    expect(sma.periodCycles).toBe(1);

    sma.update(50);
    expect(sma.getValue()).toBe(20);

    sma.update(60);
    expect(sma.getValue()).toBe(50); // (40+50+60)/3
    expect(sma.periodCycles).toBe(2);

    sma.update(70);
    expect(sma.getValue()).toBe(50);
    sma.update(80);
    expect(sma.getValue()).toBe(50);
    sma.update(90);
    expect(sma.getValue()).toBe(80); // (70+80+90)/3
  });

  it("testDiscreteModeWithReset", () => {
    const sma = new SmaRTIndicator(3);
    sma.update(10);
    sma.update(20);
    sma.update(30);
    expect(sma.getValue()).toBe(20);
    expect(sma.periodCycles).toBe(1);

    sma.reset();
    expect(sma.getValue()).toBe(0);
    expect(sma.periodCycles).toBe(0);

    sma.update(100);
    expect(sma.getValue()).toBe(100);
    sma.update(200);
    expect(sma.getValue()).toBe(100);
    sma.update(300);
    expect(sma.getValue()).toBe(200); // (100+200+300)/3
    expect(sma.periodCycles).toBe(1);
  });

  it("testModeComparison", () => {
    const discreteSma = new SmaRTIndicator(3);
    const movingSma = new SmaRTIndicator(3).withDiscreteMode(false);

    const values = [10, 20, 30, 40, 50, 60];
    for (const v of values) {
      discreteSma.update(v);
      movingSma.update(v);
    }

    expect(discreteSma.getValue()).toBe(movingSma.getValue());
  });
});
