import { describe, it, expect } from "vitest";
import type { Ticker } from "@qtsurfer/core";
import { BuySignal } from "../../../src/event/signal/BuySignal";
import {
  ImmediateFill,
  NextBarOpenFill,
} from "../../../src/execution/simulation/FillPolicy";

function bar(partial: Partial<Ticker>): Ticker {
  return {
    instrument: "BTC/USDT",
    open: null,
    high: null,
    low: null,
    last: null,
    bid: null,
    bidSize: null,
    ask: null,
    askSize: null,
    volume: null,
    quoteVolume: null,
    vwap: null,
    percentageChange: null,
    timestamp: 0,
    ...partial,
  };
}

describe("ImmediateFill", () => {
  it("is immediate for any signal", () => {
    const p = new ImmediateFill();
    expect(p.isImmediate(new BuySignal("S", "BTC/USDT", 100))).toBe(true);
  });

  it("never resolves pending (nothing ever gets queued)", () => {
    const p = new ImmediateFill();
    expect(p.resolvePending(new BuySignal("S", "BTC/USDT", 100), bar({ open: 99 }))).toBeNull();
  });
});

describe("NextBarOpenFill", () => {
  it("always defers on emission", () => {
    const p = new NextBarOpenFill();
    expect(p.isImmediate(new BuySignal("S", "BTC/USDT", 100))).toBe(false);
  });

  it("resolves a pending signal at the next bar open", () => {
    const p = new NextBarOpenFill();
    const signal = new BuySignal("S", "BTC/USDT", 100);
    expect(p.resolvePending(signal, bar({ open: 101.5 }))).toBe(101.5);
  });

  it("falls back to signal price when the bar lacks an open", () => {
    const p = new NextBarOpenFill();
    const signal = new BuySignal("S", "BTC/USDT", 100);
    expect(p.resolvePending(signal, bar({ open: null }))).toBe(100);
  });
});
