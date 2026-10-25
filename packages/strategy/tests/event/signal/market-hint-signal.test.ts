import { describe, it, expect } from "vitest";
import { BuySignal } from "../../../src/event/signal/BuySignal";
import { SellSignal } from "../../../src/event/signal/SellSignal";
import { OrderKind } from "../../../src/event/signal/MarketHintSignal";

const STRATEGY = "TestStrategy";
const INSTRUMENT = "BTC/USDT";

describe("MarketHintSignal", () => {
  it("setOrderKind", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setOrderKind(OrderKind.limit);
    expect(buy.orderKind).toBe(OrderKind.limit);
  });

  it("setMaxTries and getMaxTries", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setMaxTries(3);
    expect(buy.getMaxTries()).toBe(3);
  });

  it("getMaxTries returns undefined when not set", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    expect(buy.getMaxTries()).toBeUndefined();
  });

  it("setSellPercent and getSellPercent", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000);
    sell.setSellPercent(50);
    expect(sell.getSellPercent()).toBe(50);
  });

  it("getSellPercent defaults to 100", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000);
    expect(sell.getSellPercent()).toBe(100);
  });

  it("setStopPrice and hasStopLoss", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    expect(buy.hasStopLoss()).toBe(false);

    buy.setStopPrice(48000);
    expect(buy.hasStopLoss()).toBe(true);
    expect(buy.getStopPrice()).toBe(48000);
  });

  it("setStopLimitPrice", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setStopPrice(48000).setStopLimitPrice(47900);
    expect(buy.getStopLimitPrice()).toBe(47900);
  });

  it("setFlags", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setFlags("FOK", "IOC");
    expect(buy.getFlags()).toEqual(["FOK", "IOC"]);
  });

  it("chaining works", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000)
      .setOrderKind(OrderKind.stop)
      .setMaxTries(5)
      .setStopPrice(48000);

    expect(buy.orderKind).toBe(OrderKind.stop);
    expect(buy.getMaxTries()).toBe(5);
    expect(buy.getStopPrice()).toBe(48000);
  });

  it("copy preserves orderKind and properties", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 50000);
    buy.setOrderKind(OrderKind.stopTrailing);
    buy.setStopPrice(48000);
    buy.setMaxTries(3);

    const copy = buy.copy();
    expect(copy.orderKind).toBe(OrderKind.stopTrailing);
    expect(copy.getStopPrice()).toBe(48000);
    expect(copy.getMaxTries()).toBe(3);
  });
});
