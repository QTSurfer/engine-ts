import { describe, it, expect } from "vitest";
import type { Kline, Ticker } from "@qtsurfer/core";
import { BAR_DATA_ON_TICKER_PATH } from "$core/IndicatorNotice";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "$group/InstrumentMapKlineSourceRTIndicator";

const INSTRUMENT = "BTC/USDT";

function tick(last: number): Ticker {
  return {
    instrument: INSTRUMENT,
    open: last,
    high: last + 1,
    low: last - 1,
    last,
    bid: last,
    bidSize: 1,
    ask: last,
    askSize: 1,
    volume: 5,
    quoteVolume: 0,
    vwap: last,
    percentageChange: 0,
    timestamp: 0,
  };
}

function bar(close: number): Kline {
  return {
    instrument: INSTRUMENT,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 5,
    quoteVolume: 0,
    numberOfTrades: 1,
    timestamp: 0,
  };
}

describe("an indicator that needs bars, fed from a ticker", () => {
  it("is reported once, still updates, and the notice names it", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().atr(3).ema(3);

    for (let i = 0; i < 6; i++) {
      group.indicators.updateFrom(tick(100 + i));
    }

    const notices = group.getNotices();
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      level: "WARN",
      code: BAR_DATA_ON_TICKER_PATH,
      indicatorName: "atr3",
      instrument: INSTRUMENT,
    });
    expect(notices[0]!.message).toContain("'atr3'");
    expect(group.indicators.getExisting("atr3").isReady()).toBe(true);
  });

  it("is reported once per indicator", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().atr(3).atr("wide", 10);

    group.indicators.updateFrom(tick(100));
    group.indicators.updateFrom(tick(101));

    expect(group.getNotices().map((notice) => notice.indicatorName)).toEqual(["atr3", "wide"]);
  });

  it("raises nothing for indicators that read one value", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().ema(3).wma(3).stdDev(3);

    group.indicators.updateFrom(tick(100));

    expect(group.getNotices()).toEqual([]);
  });

  it("raises nothing on a kline group, where the bars are real", () => {
    const group = new InstrumentGroupRTIndicator(new InstrumentMapKlineSourceRTIndicator(INSTRUMENT)).addPrice().atr(3);

    group.indicators.updateFrom(bar(100));
    group.indicators.updateFrom(bar(101));

    expect(group.getNotices()).toEqual([]);
  });

  it("is forgotten when the group is cleared", () => {
    const group = new InstrumentGroupRTIndicator(INSTRUMENT).addPrice().atr(3);
    group.indicators.updateFrom(tick(100));
    expect(group.getNotices()).toHaveLength(1);

    group.indicators.clear();

    expect(group.getNotices()).toEqual([]);
  });
});
