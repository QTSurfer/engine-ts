import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapTickerSourceRTIndicator } from "$group/InstrumentMapTickerSourceRTIndicator";

describe("InstrumentGroupRTIndicator", () => {
  const INSTRUMENT = "BTC/USDT";

  it("stores instrument", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    expect(group.instrument).toBe(INSTRUMENT);
  });

  it("addPrice creates a price indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice();
    expect(group.get("price")).toBeDefined();
  });

  it("ema adds an EMA indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("testEma", 12);
    expect(group.get("testEma")).toBeDefined();
  });

  it("sma adds an SMA indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.sma(20);
    expect(group.get("sma20")).toBeDefined();
  });

  it("rsi adds an RSI indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.rsi(14);
    expect(group.get("rsi14")).toBeDefined();
    expect(group.get("rsi14%")).toBeUndefined();
  });

  it("bollinger adds bands with upper and lower", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.bollinger(20, 2);
    expect(group.get("blgr20_2")).toBeDefined();
    expect(group.get("blgr20_2Upper")).toBeDefined();
    expect(group.get("blgr20_2Lower")).toBeDefined();
  });

  it("gain and loss from existing indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice();
    group.gain("price");
    group.loss("price");
    expect(group.get("_gainprice")).toBeDefined();
    expect(group.get("_lossprice")).toBeDefined();
  });

  it("max and min from existing indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice();
    group.max("price");
    group.min("price");
    expect(group.get("maxprice")).toBeDefined();
    expect(group.get("minprice")).toBeDefined();
  });

  it("sum from existing indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice();
    group.sum("price");
    expect(group.get("sumprice")).toBeDefined();
  });

  it("builder chaining works", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    const result = group
      .addPrice()
      .ema("ema12", 12)
      .sma("sma20", 20)
      .rsi(14);
    expect(result).toBe(group);
    expect(group.indicators.size()).toBe(4);
  });

  it("clear removes all indicators", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("e", 12);
    expect(group.indicators.size()).toBe(2);
    group.clear();
    expect(group.indicators.size()).toBe(0);
  });

  it("remove removes a single indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice();
    group.remove("price");
    expect(group.get("price")).toBeUndefined();
  });

  it("getExisting throws for missing", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    expect(() => group.getExisting("nope")).toThrow();
  });

  it("distance between two indicators", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT);
    group.addPrice().ema("ema12", 12);
    group.distance("price", "ema12");
    expect(group.get("distpriceema12")).toBeDefined();
    expect(group.get("distpriceema12%")).toBeUndefined();
  });

  describe("over a ticker feed", () => {
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

    function setup() {
      const map = new InstrumentMapTickerSourceRTIndicator(INSTRUMENT);
      const group = new InstrumentGroupRTIndicator(map).addPrice();
      const run = (prices: number[], key: string): number[] =>
        prices.map((p) => {
          map.updateFrom(tick(p));
          return group.getIndicatorValue(key);
        });
      return { group, run };
    }

    it("distanceMa registers the percent distance from a moving average", () => {
      const { group, run } = setup();
      group.sma("ma", 3).distanceMa("dist", "ma");
      // sma(3), discrete: 10, 10, 20 (the average only moves when a period closes)
      // 100 * (close - ma) / ma:
      //   (10 - 10) / 10 = 0;  (20 - 10) / 10 = 1 -> 100;  (30 - 20) / 20 = 0.5 -> 50
      expect(run([10, 20, 30], "dist")).toEqual([0, 100, 50]);
    });

    it("rateChange is the raw ratio, percentChange the same ratio times 100", () => {
      const { group, run } = setup();
      group.rateChange("rc", "price", false).percentChange("pc", "price");
      // (20 - 10) / |10| = 1;  (10 - 20) / |20| = -0.5;  the first tick has no previous value -> 0
      expect(run([10, 20, 10], "rc")).toEqual([0, 1, -0.5]);
      expect(group.getIndicatorValue("pc")).toBe(-50);
    });

    it("rateChange percent flag scales by 100", () => {
      const { group, run } = setup();
      group.rateChange("rc", "price", true);
      // (20 - 10) / |10| = 1 -> 100;  (5 - 20) / |20| = -0.75 -> -75
      expect(run([10, 20, 5], "rc")).toEqual([0, 100, -75]);
    });

    it("rateChange with one argument is named after the source", () => {
      const { group } = setup();
      group.rateChange("price");
      expect(group.get("chgprice")).toBeDefined();
      expect(group.get("chgprice%")).toBeUndefined();
    });

    it("round rounds the source to the given decimals", () => {
      const { group, run } = setup();
      group.round("r2", "price", 2).round("price", 1);
      // 3.14159 * 100 = 314.159 -> 314 -> 3.14;  2.71828 * 100 = 271.828 -> 272 -> 2.72
      expect(run([3.14159, 2.71828], "r2")).toEqual([3.14, 2.72]);
      // one decimal: 31.4159 -> 31 -> 3.1;  27.1828 -> 27 -> 2.7
      expect(group.getIndicatorValue("roundprice")).toBe(2.7);
    });

    it("bollingerBandwidth registers under the source name plus BW", () => {
      const { group, run } = setup();
      group.bollinger("bb", 2, 2).bollingerBandwidth("bb");
      expect(group.get("bbBW")).toBeDefined();
      expect(group.get("bbBW%")).toBeUndefined();
      // The first tick has no spread yet, so the bands collapse onto the middle: 0.
      // With 10, 20 and period 2: middle = (10 + 20) / 2 = 15; sample variance =
      // ((10 - 15)^2 + (20 - 15)^2) / (2 - 1) = 50; stddev = sqrt(50); band half-width = 2 * sqrt(50).
      // bandwidth = 100 * (upper - lower) / middle = 100 * 4 * sqrt(50) / 15 = 2000 * sqrt(2) / 15
      const [first, second] = run([10, 20], "bbBW");
      expect(first).toBe(0);
      expect(second).toBeCloseTo((2000 * Math.SQRT2) / 15, 9);
    });

    it("bollingerBandwidth without a bollinger registers a hidden default one", () => {
      const { group } = setup();
      group.bollingerBandwidth("nope");
      expect(group.get("nopeBW")).toBeDefined();
      expect(group.get("_nopeblgr")).toBeInstanceOf(BollingerBandsRTIndicator);
      // The default bollinger it derives from carries a "_" prefix, so it is never published
      const published: string[] = [];
      group.indicators.forEachPublicable((name) => published.push(name));
      expect(published).toEqual(["price", "nopeBW"]);
    });

    it("bollingerBandwidth ignores a source that is not a bollinger", () => {
      const { group } = setup();
      group.bollingerBandwidth("price");
      expect(group.get("priceBW")).toBeUndefined();
    });

    it("ema over another indicator averages that indicator, not the price", () => {
      const { group, run } = setup();
      group.gain("gain", "price").ema("emaPrice", 3).ema("emaGain", "gain", 3);
      // alpha = 2 / (3 + 1) = 0.5, seeded with the first value, then ema += 0.5 * (x - ema)
      // price 10, 12, 11, 15 -> ema: 10; 10 + 0.5 * 2 = 11; 11 + 0.5 * 0 = 11; 11 + 0.5 * 4 = 13
      // gain 0, 2, 0, 4      -> ema: 0; 0 + 0.5 * 2 = 1; 1 + 0.5 * (0 - 1) = 0.5; 0.5 + 0.5 * 3.5 = 2.25
      const prices = [10, 12, 11, 15];
      const emaGain: number[] = [];
      const emaPrice: number[] = [];
      for (const p of prices) {
        emaGain.push(run([p], "emaGain")[0]);
        emaPrice.push(group.getIndicatorValue("emaPrice"));
      }
      expect(emaPrice).toEqual([10, 11, 11, 13]);
      expect(emaGain).toEqual([0, 1, 0.5, 2.25]);
    });

    it("sma over another indicator averages that indicator", () => {
      const { group, run } = setup();
      group.gain("gain", "price").sma("smaGain", "gain", 2);
      // gain 0, 2, 0, 4; sma(2) discrete: 0 (init); (0 + 2) / 2 = 1; 1 (period open); (0 + 4) / 2 = 2
      expect(run([10, 12, 11, 15], "smaGain")).toEqual([0, 1, 1, 2]);
    });

    it("ema and sma over a missing source throw", () => {
      const { group } = setup();
      expect(() => group.ema("e", "missing", 3)).toThrow("Indicator not found: missing");
      expect(() => group.sma("s", "missing", 3)).toThrow("Indicator not found: missing");
    });
  });
});

describe("InstrumentGroupRTIndicator.reset", () => {
  function last(price: number): Ticker {
    return {
      instrument: "BTC/USDT",
      open: price,
      high: price,
      low: price,
      last: price,
      bid: price,
      bidSize: 1,
      ask: price,
      askSize: 1,
      volume: 5,
      quoteVolume: 0,
      vwap: price,
      percentageChange: 0,
      timestamp: 0,
    };
  }

  it("resets every indicator the group registered, as the Java engine's group does", () => {
    const group = new InstrumentGroupRTIndicator("BTC/USDT").addPrice().ema(3);
    const run = () =>
      [10, 20, 15].map((price) => {
        group.indicators.updateFrom(last(price));
        return group.getIndicatorValue("ema3");
      });
    const first = run();
    group.reset();
    expect(group.getIndicatorValue("ema3")).toBe(0);
    expect(run()).toEqual(first);
  });
});
