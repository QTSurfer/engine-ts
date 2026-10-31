import { describe, it, expect } from "vitest";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";
import { KamaRTIndicator } from "$averages/KamaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";
import { WmaIncrementalRTIndicator } from "$averages/WmaIncrementalRTIndicator";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { BollingerPercentBRTIndicator } from "$bollinger/BollingerPercentBRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import type { RichRTIndicator } from "$core/RTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { PercentVolatilityRTIndicator } from "$helpers/PercentVolatilityRTIndicator";
import { VolatilityRTIndicator } from "$helpers/VolatilityRTIndicator";
import { AtrRTIndicator } from "$indicators/AtrRTIndicator";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";
import { VarianceRTIndicator } from "$statistics/VarianceRTIndicator";

const PRICES = [10, 11, 10.5, 12, 11.5, 13, 12.5, 14, 13.2, 15, 14.1, 16, 15.3, 17, 16.2, 18, 17.4, 19, 18.1, 20];

function group(): InstrumentGroupRTIndicator {
  return new InstrumentGroupRTIndicator("BTC/USDT").addPrice();
}

/**
 * Feeds the prices to the registered indicator and to a reference one, and compares the last
 * values. The indicators are driven individually: the group's own update advances the group's
 * scalar, not its children.
 */
function sameAsByHand(g: InstrumentGroupRTIndicator, id: string, reference: RTIndicator): void {
  const registered = g.indicators.getExisting(id);
  for (const price of PRICES) {
    registered.update(price);
    reference.update(price);
  }
  expect(registered.getValue(), id).toBe(reference.getValue());
}

describe("builder methods of the free indicators", () => {
  it("the default id is the prefix and the parameters", () => {
    const g = group()
      .atr()
      .wma(5)
      .tema(4)
      .hma(6)
      .mma(7)
      .kama()
      .stdDev(5)
      .variance(5)
      .volatility(5)
      .percentVolatility(5)
      .bollingerPercentB()
      .bollingerPercentB(10, 2.5);

    for (const id of [
      "atr14",
      "wma5",
      "tema4",
      "hma6",
      "mma7",
      "kama10_2_30",
      "stdDev5",
      "variance5",
      "vol5",
      "pvol5",
      "pctB20_2",
      "pctB10_2.5",
    ]) {
      expect(g.indicators.get(id), id).toBeDefined();
    }
  });

  it("a name of your own replaces the default id", () => {
    const g = group().atr("range", 10).wma("fast", 3).kama("adaptive", 8, 2, 20);

    expect(g.indicators.get("range")).toBeDefined();
    expect(g.indicators.get("fast")).toBeDefined();
    expect(g.indicators.get("adaptive")).toBeDefined();
    expect(g.indicators.get("atr10")).toBeUndefined();
  });

  it("each gives the values of its class", () => {
    sameAsByHand(group().wma(5), "wma5", new WmaIncrementalRTIndicator(5));
    sameAsByHand(group().tema(4), "tema4", new TemaRTIndicator(4));
    sameAsByHand(group().hma(6), "hma6", new HmaRTIndicator(6));
    sameAsByHand(group().mma(7), "mma7", new MmaRTIndicator(7));
    sameAsByHand(group().kama(), "kama10_2_30", new KamaRTIndicator(10, 2, 30));
    sameAsByHand(group().stdDev(5), "stdDev5", new StandardDeviationRTIndicator(5));
    sameAsByHand(group().variance(5), "variance5", new VarianceRTIndicator(5));
  });

  it("the sourced forms read another indicator of the group", () => {
    const g = group().ema("base", 3).mma("smooth", "base", 4).stdDev("sd", "base", 4).variance("var", "base", 4);

    for (const id of ["smooth", "sd", "var"]) {
      expect(g.indicators.getExisting(id).getMeta?.().get("src"), id).toBe("base");
      expect(g.indicators.getExisting(id).getMeta?.().get("periods"), id).toBe("4");
    }
  });

  it("the parameters are recorded as meta", () => {
    const g = group().kama().bollingerPercentB(10, 2.5);

    const kama = g.indicators.getExisting("kama10_2_30").getMeta?.();
    expect([kama?.get("erPeriod"), kama?.get("fastPeriod"), kama?.get("slowPeriod")]).toEqual(["10", "2", "30"]);
    const percentB = g.indicators.getExisting("pctB10_2.5").getMeta?.();
    expect([percentB?.get("periods"), percentB?.get("k")]).toEqual(["10", "2.5"]);
  });

  it("volatility is the average of how often the price changes", () => {
    const g = group().volatility(5).percentVolatility(5);
    for (const price of PRICES) {
      g.indicators.getExisting("vol5").update(price);
      g.indicators.getExisting("pvol5").update(price);
    }
    expect(g.indicators.getExisting("vol5")).toBeInstanceOf(VolatilityRTIndicator);
    expect(g.indicators.getExisting("pvol5")).toBeInstanceOf(PercentVolatilityRTIndicator);
    expect(g.indicators.getExisting("vol5").getValue()).toBeGreaterThan(0);
    expect(g.indicators.getExisting("pvol5").getValue()).toBeGreaterThan(0);
  });

  it("percent B carries its own bands and leaves the group's Bollinger alone", () => {
    const g = group().bollinger(10, 2).bollingerPercentB(10, 2);
    const band = g.indicators.getExisting("blgr10_2") as BollingerBandsRTIndicator;
    const alone = new BollingerBandsRTIndicator(10, 2);
    for (const price of PRICES) {
      band.update(price);
      g.indicators.getExisting("pctB10_2").update(price);
      alone.update(price);
    }
    // the group's band was updated once per price: %B did not update it a second time
    expect(band.getUpper().getValue()).toBe(alone.getUpper().getValue());
    expect(g.indicators.getExisting("pctB10_2")).toBeInstanceOf(BollingerPercentBRTIndicator);
    const value = g.indicators.getExisting("pctB10_2").getValue();
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(2);
  });

  it("ATR reads whole bars and says so", () => {
    const atr = group().atr(14).indicators.getExisting("atr14") as RichRTIndicator;

    expect(atr).toBeInstanceOf(AtrRTIndicator);
    expect(atr.requiresBarData?.()).toBe(true);
    expect(atr.getMeta?.().get("periods")).toBe("14");
  });
});
