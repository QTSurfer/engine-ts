import { describe, it, expect } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import { KlineValueSource, TickerValueSource } from "@qtsurfer/core";
import { DisplayHint } from "$core/DisplayHint";
import type { RTIndicator } from "$core/RTIndicator";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "$group/InstrumentMapKlineSourceRTIndicator";
import { InstrumentMapRTIndicator } from "$group/InstrumentMapRTIndicator";
import { InstrumentMapTickerSourceRTIndicator } from "$group/InstrumentMapTickerSourceRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";

const INSTRUMENT = "BTC/USDT";

function metaOf(indicator: RTIndicator | undefined): Record<string, string> {
  expect(indicator).toBeDefined();
  return Object.fromEntries(indicator!.getMeta!().asMap());
}

function hintOf(group: InstrumentGroupRTIndicator, name: string): DisplayHint {
  return group.getExisting(name).getDisplayHint!();
}

function publicNames(map: InstrumentMapRTIndicator): string[] {
  const names: string[] = [];
  map.forEachPublicable((name) => names.push(name));
  return names;
}

function tick(price: number): Ticker {
  return {
    instrument: INSTRUMENT,
    open: price,
    high: price,
    low: price,
    last: price,
    bid: price,
    bidSize: 1,
    ask: price,
    askSize: 1,
    volume: 0,
    quoteVolume: 0,
    vwap: price,
    percentageChange: 0,
    timestamp: 0,
  };
}

function kline(close: number): Kline {
  return {
    instrument: INSTRUMENT,
    open: close,
    high: close,
    low: close,
    close,
    volume: 10,
    quoteVolume: 10 * close,
    numberOfTrades: 3,
    timestamp: 0,
  };
}

describe("registered names carry no display suffix", () => {
  it("names every builder method after its inputs, with no percent sign", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("ema12", 12).sma("ma", 3);
    group.rsi(14).rsi(7, false);
    group.distance("price", "ema12").distanceMa("ma").percentChange("price");
    group.bollinger(13, 2).bollingerBandwidth("blgr13_2");

    for (const name of ["rsi14", "rsi7", "distpriceema12", "distma", "chgprice", "blgr13_2BW"]) {
      expect(group.get(name), name).toBeDefined();
    }
    const names: string[] = [];
    group.indicators.forEachPublicable((name) => names.push(name));
    expect(names.filter((name) => name.includes("%"))).toEqual([]);
  });

  it("does not register the old percent names", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("ema12", 12).sma("ma", 3).rsi(14);
    group.distance("price", "ema12").distanceMa("ma").percentChange("price");
    group.bollinger("bb", 2, 2).bollingerBandwidth("bb");

    for (const name of ["rsi14%", "distpriceema12%", "distma%", "chgprice%", "bbBW%"]) {
      expect(group.get(name), name).toBeUndefined();
    }
  });

  it("no longer has a percent suffix constant", () => {
    const statics = Object.keys(InstrumentGroupRTIndicator);
    expect(statics).not.toContain("SUBFIX_PERCENT");
    expect(statics).not.toContain("SUBFIX_BOLLINGER_BANDWIDTH");
    // The bandwidth suffix is the band's own name, not a display hint: it stays
    expect(InstrumentGroupRTIndicator.SUBFIX_BANDWIDTH).toBe("BW");
  });

  it("a lookup by the old name fails with the indicator-not-found error", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().rsi(14);
    expect(group.getExisting("rsi14")).toBeDefined();
    expect(() => group.getExisting("rsi14%")).toThrow("Indicator not found: rsi14%");
    expect(() => group.getIndicatorValue("rsi14%")).toThrow("Indicator not found: rsi14%");
  });

  it("a name that was given explicitly is used as it is", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema("ema12", 12);
    group.rsi("myRsi", 14, true).distance("d", "price", "ema12").distanceMa("dm", "ema12");
    group.percentChange("pc", "price").rateChange("rc", "price", false);
    for (const name of ["myRsi", "d", "dm", "pc", "rc"]) {
      expect(group.get(name), name).toBeDefined();
    }
  });
});

describe("display hints", () => {
  it("is PERCENT on rsi, distance, distanceMa, percentChange and bollinger bandwidth", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema("ema12", 12).sma("ma", 3);
    group.rsi(14).distance("price", "ema12").distanceMa("ma").percentChange("price");
    group.bollinger("bb", 2, 2).bollingerBandwidth("bb");

    for (const name of ["rsi14", "distpriceema12", "distma", "chgprice", "bbBW"]) {
      expect(hintOf(group, name), name).toBe(DisplayHint.PERCENT);
      expect(metaOf(group.get(name)).dsp, name).toBe("P");
    }
  });

  it("is ABSOLUTE on sma and ema, with no dsp entry", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();
    group.sma(20).ema(9).sma("s", "price", 3).ema("e", "price", 3);
    for (const name of ["sma20", "ema9", "s", "e"]) {
      expect(hintOf(group, name), name).toBe(DisplayHint.ABSOLUTE);
      expect(metaOf(group.get(name)).dsp, name).toBeUndefined();
    }
  });

  it("is ABSOLUTE on a rate of change and PERCENT only when asked for percent", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();
    group.rateChange("price").rateChange("pct", "price", true).rateChange("raw", "price", false);
    expect(hintOf(group, "chgprice")).toBe(DisplayHint.ABSOLUTE);
    expect(hintOf(group, "raw")).toBe(DisplayHint.ABSOLUTE);
    expect(hintOf(group, "pct")).toBe(DisplayHint.PERCENT);
    expect(metaOf(group.get("raw")).dsp).toBeUndefined();
  });

  it("is ABSOLUTE on the indicators with no hint of their own", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema("ema12", 12);
    group.gain("price").loss("price").max("price").min("price").sum("price");
    group.round("price", 1).diff("price", "ema12").mul("price", "ema12").mul("price", 2);
    group.bollinger("bb", 2, 2);
    for (const name of [
      "price",
      "_gainprice",
      "_lossprice",
      "maxprice",
      "minprice",
      "sumprice",
      "roundprice",
      "diffpriceema12",
      "mulpriceema12",
      "mulprice",
      "bb",
      "bbUpper",
      "bbLower",
    ]) {
      expect(hintOf(group, name), name).toBe(DisplayHint.ABSOLUTE);
    }
  });

  describe("on a raw snapshot field", () => {
    it("follows the ticker value source", () => {
      const group = new InstrumentGroupRTIndicator(INSTRUMENT);
      const expected: [TickerValueSource, DisplayHint][] = [
        [TickerValueSource.PercentChange, DisplayHint.PERCENT],
        [TickerValueSource.BidSize, DisplayHint.VOLUME],
        [TickerValueSource.AskSize, DisplayHint.VOLUME],
        [TickerValueSource.Volume, DisplayHint.VOLUME],
        [TickerValueSource.VolumeQuote, DisplayHint.VOLUME],
        [TickerValueSource.Bid, DisplayHint.ABSOLUTE],
        [TickerValueSource.Ask, DisplayHint.ABSOLUTE],
        [TickerValueSource.Open, DisplayHint.ABSOLUTE],
        [TickerValueSource.High, DisplayHint.ABSOLUTE],
        [TickerValueSource.Low, DisplayHint.ABSOLUTE],
        [TickerValueSource.Close, DisplayHint.ABSOLUTE],
        [TickerValueSource.Vwap, DisplayHint.ABSOLUTE],
        [TickerValueSource.AutoAskClose, DisplayHint.ABSOLUTE],
      ];
      for (const [source, hint] of expected) {
        group.add(`t${source}`, source);
        expect(hintOf(group, `t${source}`), source).toBe(hint);
      }
    });

    it("follows the kline value source", () => {
      const group = new InstrumentGroupRTIndicator(new InstrumentMapKlineSourceRTIndicator(INSTRUMENT));
      const expected: [KlineValueSource, DisplayHint][] = [
        [KlineValueSource.Volume, DisplayHint.VOLUME],
        [KlineValueSource.VolumeQuote, DisplayHint.VOLUME],
        [KlineValueSource.NumberOfTrades, DisplayHint.VOLUME],
        [KlineValueSource.Open, DisplayHint.ABSOLUTE],
        [KlineValueSource.High, DisplayHint.ABSOLUTE],
        [KlineValueSource.Low, DisplayHint.ABSOLUTE],
        [KlineValueSource.Close, DisplayHint.ABSOLUTE],
      ];
      for (const [source, hint] of expected) {
        group.add(`k${source}`, source);
        expect(hintOf(group, `k${source}`), source).toBe(hint);
      }
    });
  });
});

describe("metadata keys", () => {
  it("sma and ema record their periods; with a source indicator they record it too", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();
    group.sma(20).ema("e", 12).sma("sOfP", "price", 3).ema("eOfP", "price", 5);
    expect(metaOf(group.get("sma20"))).toEqual({ periods: "20" });
    expect(metaOf(group.get("e"))).toEqual({ periods: "12" });
    expect(metaOf(group.get("sOfP"))).toEqual({ periods: "3", src: "price" });
    expect(metaOf(group.get("eOfP"))).toEqual({ periods: "5", src: "price" });
  });

  it("rsi records its periods and the percent hint", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().rsi(14);
    expect(metaOf(group.get("rsi14"))).toEqual({ periods: "14", dsp: "P" });
    expect(group.getExisting("rsi14").getId!()).toBe("rsi");
  });

  it("bollinger describes each band with its id, periods, k and band", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().bollinger(13, 2);
    const base = { id: "bollinger", periods: "13", k: "2" };
    expect(metaOf(group.get("blgr13_2"))).toEqual({ ...base, band: "middle" });
    expect(metaOf(group.get("blgr13_2Upper"))).toEqual({ ...base, band: "upper" });
    expect(metaOf(group.get("blgr13_2Lower"))).toEqual({ ...base, band: "lower" });
    expect(group.getExisting("blgr13_2Upper").getId!()).toBe("bollinger");
  });

  it("bollinger describes itself wherever it is built", () => {
    const bands = new BollingerBandsRTIndicator();
    expect(Object.fromEntries(bands.getMeta().asMap())).toEqual({
      id: "bollinger",
      periods: "20",
      k: "2",
      band: "middle",
    });
    expect(Object.fromEntries(bands.getUpper().getMeta!().asMap()).band).toBe("upper");
    expect(Object.fromEntries(bands.getLower().getMeta!().asMap()).band).toBe("lower");
    expect(Object.fromEntries(new BollingerBandsRTIndicator(5, 2.5).getMeta().asMap())).toMatchObject({
      periods: "5",
      k: "2.5",
    });
  });

  it("bollinger bandwidth records its id, its source band and the percent hint", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().bollinger("bb", 2, 2).bollingerBandwidth("bb");
    expect(metaOf(group.get("bbBW"))).toEqual({ id: "bollingerBandwidth", src: "bb", dsp: "P" });
    expect(group.getExisting("bbBW").getId!()).toBe("bollingerBandwidth");
  });

  it("bollinger bandwidth names the requested band as its source even when it had to add one", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).bollingerBandwidth("nope");
    expect(metaOf(group.get("nopeBW")).src).toBe("nope");
  });

  it("distance records both of its inputs", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema("ema12", 12).distance("price", "ema12");
    expect(metaOf(group.get("distpriceema12"))).toEqual({
      id: "distance",
      src: "price",
      base: "ema12",
      dsp: "P",
    });
  });

  it("distanceMa records its moving average", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().sma("ma", 3).distanceMa("ma");
    expect(metaOf(group.get("distma"))).toEqual({ id: "distanceMa", src: "ma", dsp: "P" });
  });

  it("percentChange and rateChange share the rateChange id", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice();
    group.percentChange("pc", "price").rateChange("rc", "price", false);
    expect(metaOf(group.get("pc"))).toEqual({ id: "rateChange", src: "price", dsp: "P" });
    expect(metaOf(group.get("rc"))).toEqual({ id: "rateChange", src: "price" });
  });

  it("the indicators with no parameters of their own carry no metadata", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema("ema12", 12);
    group.max("price").min("price").sum("price").round("price", 1);
    group.diff("price", "ema12").mul("price", "ema12").mul("price", 2);
    for (const name of ["maxprice", "minprice", "sumprice", "roundprice", "diffpriceema12", "mulpriceema12", "mulprice"]) {
      expect(metaOf(group.get(name)), name).toEqual({});
    }
    expect(group.getExisting("maxprice").getId!()).toBe("max");
    expect(group.getExisting("sumprice").getId!()).toBe("sum");
  });

  it("describes a stored column from its metadata alone, with no name parsing", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().bollinger(13, 2);
    const column = group.getExisting("blgr13_2Upper");
    expect(column.getId!()).toBe("bollinger");
    expect(column.getMeta!().get("band")).toBe("upper");
    expect(column.getMeta!().get("periods")).toBe("13");
  });

  it("a read-only view of a registered indicator reads the same descriptor", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().rsi(14);
    const view = group.getReadOnlyExisting("rsi14");
    expect(view).not.toBe(group.getExisting("rsi14"));
    expect(metaOf(view)).toEqual({ periods: "14", dsp: "P" });
    expect(view.getId!()).toBe("rsi");
    expect(view.getDisplayHint!()).toBe(DisplayHint.PERCENT);
  });

  it("a derived indicator keeps the descriptor of the one it reads", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().rsi(14);
    group.sma("rsiAvg", "rsi14", 3);
    expect(metaOf(group.get("rsiAvg"))).toEqual({ periods: "3", src: "rsi14" });
    expect(metaOf(group.get("rsi14"))).toEqual({ periods: "14", dsp: "P" });
  });
});

describe("visibility", () => {
  it("marks a name in the internal namespace hidden when it is registered", () => {
    const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
    const value = new ValueRTIndicator();
    map.add("_internal", value);
    expect(value.isHidden()).toBe(true);
    expect(value.getMeta().get("vis")).toBe("hidden");
  });

  it("marks what the builder registers in that namespace as hidden", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().gain("price").loss("price");
    group.window("price", "s1", () => {}).bollingerBandwidth("missing");
    for (const name of ["_gainprice", "_lossprice", "_win1", "_missingblgr"]) {
      expect(group.getExisting(name).isHidden!(), name).toBe(true);
    }
    expect(group.getExisting("price").isHidden!()).toBe(false);
    expect(group.getExisting("missingBW").isHidden!()).toBe(false);
  });

  it("does not publish a hidden indicator, and keeps updating it", () => {
    const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
    const internal = new ValueRTIndicator().hide();
    map.add("price", new ValueRTIndicator());
    map.add("internal", internal);
    map.add("other", new ValueRTIndicator());

    map.updateFrom(tick(42));

    expect(publicNames(map)).toEqual(["price", "other"]);
    // Hidden is not frozen: the indicator is updated every tick, it is only not emitted
    expect(internal.getValue()).toBe(42);
    expect(map.getIndicatorValue("internal")).toBe(42);
  });

  it("reads the visibility from the metadata at the time of the call", () => {
    const map = new InstrumentMapRTIndicator(INSTRUMENT);
    const value = new ValueRTIndicator().hide();
    map.add("shown", value);
    expect(publicNames(map)).toEqual([]);
    value.getMeta().setHidden(false);
    expect(publicNames(map)).toEqual(["shown"]);
  });

  it("keeps a name in the internal namespace out of the published ones", () => {
    const map = new InstrumentMapRTIndicator(INSTRUMENT);
    const bare: RTIndicator = {
      getValue: () => 1,
      update: (value) => value,
      isReady: () => true,
      reset: () => {},
    };
    map.add("price", new ValueRTIndicator());
    map.add("_view", new InstrumentGroupRTIndicator(map).getReadOnlyExisting("price"));
    map.add("_bare", bare);
    expect(publicNames(map)).toEqual(["price"]);
  });

  it("hiding a read-only view does not hide the indicator it wraps", () => {
    const map = new InstrumentMapRTIndicator(INSTRUMENT);
    const price = new ValueRTIndicator();
    map.add("price", price);
    map.add("_view", map.getReadOnlyExisting("price"));
    expect(price.isHidden()).toBe(false);
    expect(publicNames(map)).toEqual(["price"]);
  });

  it("publishes every public indicator of a group in registration order", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("ema12", 12).gain("price").rsi(14).window("price", "s1", () => {});
    expect(publicNames(group.indicators)).toEqual(["price", "ema12", "rsi14"]);
  });
});

describe("a kline feed", () => {
  it("publishes the same way and hints by the kline field", () => {
    const map = new InstrumentMapKlineSourceRTIndicator(INSTRUMENT);
    const group = new InstrumentGroupRTIndicator(map).addPrice().ema("e", 2).rsi(2).gain("price");
    map.updateFrom(kline(10));
    expect(group.getIndicatorValue("price")).toBe(10);
    expect(publicNames(map)).toEqual(["price", "e", "rsi2"]);
    expect(hintOf(group, "rsi2")).toBe(DisplayHint.PERCENT);
  });
});
