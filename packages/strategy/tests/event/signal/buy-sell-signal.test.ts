import { describe, it, expect } from "vitest";
import { BuySignal } from "../../../src/event/signal/BuySignal";
import { SellSignal } from "../../../src/event/signal/SellSignal";
import { MarketHintKind, OrderKind } from "../../../src/event/signal/MarketHintSignal";
import { StrategyEventType } from "../../../src/event/StrategyEventType";

const STRATEGY = "TestStrategy";
const INSTRUMENT = "BTC/USDT";

describe("BuySignal", () => {
  it("has correct kind and type", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    expect(buy.kind).toBe(MarketHintKind.buy);
    expect(buy.type).toBe(StrategyEventType.Hint);
    expect(buy.instrument).toBe(INSTRUMENT);
    expect(buy.price).toBe(50000);
  });

  it("default orderKind is market", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    expect(buy.orderKind).toBe(OrderKind.market);
  });

  it("copy creates independent copy", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setOrderKind(OrderKind.limit);
    buy.set("reason", "signal");

    const copy = buy.copy();
    expect(copy).not.toBe(buy);
    expect(copy.price).toBe(50000);
    expect(copy.instrument).toBe(INSTRUMENT);
    expect(copy.orderKind).toBe(OrderKind.limit);
    expect(copy.get<string>("reason")).toBe("signal");
  });

  it("copy is a BuySignal", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    expect(buy.copy()).toBeInstanceOf(BuySignal);
  });
});

describe("SellSignal", () => {
  it("has correct kind and type", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000);
    expect(sell.kind).toBe(MarketHintKind.sell);
    expect(sell.type).toBe(StrategyEventType.Hint);
    expect(sell.instrument).toBe(INSTRUMENT);
    expect(sell.price).toBe(60000);
  });

  it("copy creates independent copy", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000);
    sell.setSellPercent(50);

    const copy = sell.copy();
    expect(copy).not.toBe(sell);
    expect(copy.price).toBe(60000);
    expect(copy.getSellPercent()).toBe(50);
  });

  it("copy is a SellSignal", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000);
    expect(sell.copy()).toBeInstanceOf(SellSignal);
  });
});
