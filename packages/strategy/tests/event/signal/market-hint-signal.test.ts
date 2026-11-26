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

  it("sizePercent and sellPercent are one number, read the same from both getters", () => {
    const viaSellPercent = new SellSignal(STRATEGY, INSTRUMENT, 60000).setSellPercent(30);
    const viaSizePercent = new BuySignal(STRATEGY, INSTRUMENT, 60000).setSizePercent(30);

    expect(viaSellPercent.getSizePercent()).toBe(30);
    expect(viaSellPercent.getSellPercent()).toBe(30);
    expect(viaSizePercent.getSizePercent()).toBe(30);
    expect(viaSizePercent.getSellPercent()).toBe(30);
  });

  it("asks for no size by default: getSizePercent is undefined and getSellPercent 100", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 60000);

    expect(buy.getSizePercent()).toBeUndefined();
    expect(buy.getSellPercent()).toBe(100);
  });

  it.each([0, 0.5, 100])("setSizePercent takes %d", (percent) => {
    expect(new BuySignal(STRATEGY, INSTRUMENT, 60000).setSizePercent(percent).getSizePercent()).toBe(percent);
  });

  it.each([-1, 100.5, Number.NaN, Number.POSITIVE_INFINITY])("setSizePercent refuses %d", (percent) => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 60000);

    expect(() => buy.setSizePercent(percent)).toThrow(RangeError);
    expect(buy.getSizePercent()).toBeUndefined();
  });

  it("maxPercent is read by getMaxPercent and, for a sell, by getSellPercent", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000).setMaxPercent(40);

    expect(sell.getMaxPercent()).toBe(40);
    expect(sell.getSizePercent()).toBeUndefined();
    expect(sell.getSellPercent()).toBe(40);
  });

  it("asks for no maximum share by default", () => {
    expect(new BuySignal(STRATEGY, INSTRUMENT, 60000).getMaxPercent()).toBeUndefined();
  });

  it.each([-1, 100.5, Number.NaN])("setMaxPercent refuses %d", (percent) => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 60000);

    expect(() => buy.setMaxPercent(percent)).toThrow(RangeError);
    expect(buy.getMaxPercent()).toBeUndefined();
  });

  it("a signal has one size: the last asked for takes back the other", () => {
    const sizeThenMax = new BuySignal(STRATEGY, INSTRUMENT, 60000).setSizePercent(10).setMaxPercent(20);
    const maxThenSize = new BuySignal(STRATEGY, INSTRUMENT, 60000).setMaxPercent(20).setSizePercent(10);
    const maxThenSell = new SellSignal(STRATEGY, INSTRUMENT, 60000).setMaxPercent(20).setSellPercent(10);

    expect([sizeThenMax.getSizePercent(), sizeThenMax.getMaxPercent()]).toEqual([undefined, 20]);
    expect([maxThenSize.getSizePercent(), maxThenSize.getMaxPercent()]).toEqual([10, undefined]);
    expect([maxThenSell.getSizePercent(), maxThenSell.getMaxPercent()]).toEqual([10, undefined]);
    expect(sizeThenMax.getSellPercent()).toBe(20);
  });

  it("a refused size leaves the one the signal had", () => {
    const buy = new BuySignal(STRATEGY, INSTRUMENT, 60000).setSizePercent(10);

    expect(() => buy.setMaxPercent(101)).toThrow(RangeError);

    expect(buy.getSizePercent()).toBe(10);
    expect(buy.getMaxPercent()).toBeUndefined();
  });

  it("copy keeps the size", () => {
    const copy = new BuySignal(STRATEGY, INSTRUMENT, 60000).setMaxPercent(30).copy();

    expect(copy.getMaxPercent()).toBe(30);
  });

  it("setSellPercent does not validate, as before", () => {
    const sell = new SellSignal(STRATEGY, INSTRUMENT, 60000).setSellPercent(150);

    expect(sell.getSellPercent()).toBe(150);
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
