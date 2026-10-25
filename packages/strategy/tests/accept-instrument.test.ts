import { describe, it, expect } from "vitest";
import { Asset, Instrument } from "@qtsurfer/core";
import type { Kline, Ticker } from "@qtsurfer/core";
import { AbstractTickerStrategy } from "../src/AbstractTickerStrategy";
import { AbstractKlineStrategy } from "../src/AbstractKlineStrategy";

class TickerStrategy extends AbstractTickerStrategy {
  constructor() {
    super("TickerStrategy");
  }

  setOutput(code: string | undefined): void {
    this.outputCurrency = code === undefined ? undefined : Asset.of(code);
  }

  takes(asset: string): boolean {
    return this.acceptCurrency(Asset.of(asset));
  }
}

class KlineStrategy extends AbstractKlineStrategy {
  constructor() {
    super("KlineStrategy");
  }

  setOutput(code: string): void {
    this.outputCurrency = Asset.of(code);
  }
}

function ticker(instrument: string): Ticker {
  return {
    instrument,
    open: 1,
    high: 1,
    low: 1,
    last: 1,
    bid: 1,
    bidSize: 1,
    ask: 1,
    askSize: 1,
    volume: 1,
    quoteVolume: 1,
    vwap: 1,
    percentageChange: 0,
    timestamp: 1,
  };
}

function kline(instrument: string): Kline {
  return {
    instrument,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
    quoteVolume: 1,
    numberOfTrades: 1,
    timestamp: 1,
  };
}

describe("acceptInstrument default", () => {
  it("takes every instrument while no output currency and no lists are set", () => {
    const strategy = new TickerStrategy();
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.parse("ETH/EUR"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT:USDT"))).toBe(true);
  });

  it("with an output currency, takes only the instruments quoted in it", () => {
    const strategy = new TickerStrategy();
    strategy.setOutput("USDT");
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/EUR"))).toBe(false);
  });

  it("compares the quote as written, against the upper-case output code, as Java does", () => {
    const strategy = new TickerStrategy();
    strategy.setOutput("usdt");
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.parse("btc/usdt"))).toBe(false);
  });

  it("runs the BASE through the currency filter, not the quote", () => {
    const strategy = new TickerStrategy();
    strategy.setBlacklistedCurrencies(["USDT"]);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(true);
    strategy.setBlacklistedCurrencies(["BTC"]);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(false);
  });

  it("upper-cases the base before it asks the filter", () => {
    const strategy = new TickerStrategy();
    strategy.setWhitelistedCurrencies(["BTC"]);
    expect(strategy.acceptInstrument(Instrument.parse("btc/USDT"))).toBe(true);
  });

  it("combines the output currency and the whitelist", () => {
    const strategy = new TickerStrategy();
    strategy.setOutput("USDT");
    strategy.setWhitelistedCurrencies(["BTC", "ETH"]);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USDT"))).toBe(true);
    expect(strategy.acceptInstrument(Instrument.parse("SOL/USDT"))).toBe(false);
    expect(strategy.acceptInstrument(Instrument.parse("BTC/EUR"))).toBe(false);
  });

  it("looks at base and quote of a perpetual, not at its settlement currency", () => {
    const strategy = new TickerStrategy();
    strategy.setOutput("USD");
    expect(strategy.acceptInstrument(Instrument.parse("BTC/USD:BTC"))).toBe(true);
  });

  it("acceptCurrency is the strategy's own filter", () => {
    const strategy = new TickerStrategy();
    strategy.setBlacklistedCurrencies(["¿USD"]);
    expect(strategy.takes("BUSD")).toBe(false);
    expect(strategy.takes("BTC")).toBe(true);
  });

  it("reports the output currency it was given", () => {
    const strategy = new TickerStrategy();
    expect(strategy.getOutputCurrency()).toBeUndefined();
    expect(strategy.getInputCurrency()).toBeUndefined();
    strategy.setOutput("USDT");
    expect(strategy.getOutputCurrency()?.code).toBe("USDT");
  });
});

describe("acceptInstrument override", () => {
  class OnlyEth extends AbstractTickerStrategy {
    constructor() {
      super("OnlyEth");
    }

    override acceptInstrument(instrument: Instrument): boolean {
      return instrument.base() === "ETH";
    }
  }

  it("replaces the default for accept()", () => {
    const strategy = new OnlyEth();
    expect(strategy.accept(ticker("ETH/USDT"))).toBe(true);
    expect(strategy.accept(ticker("BTC/USDT"))).toBe(false);
  });

  it("can build on the default through super", () => {
    class NoPerpetuals extends TickerStrategy {
      override acceptInstrument(instrument: Instrument): boolean {
        return !instrument.isDerivative() && super.acceptInstrument(instrument);
      }
    }
    const strategy = new NoPerpetuals();
    strategy.setBlacklistedCurrencies(["DOGE"]);
    expect(strategy.accept(ticker("BTC/USDT"))).toBe(true);
    expect(strategy.accept(ticker("BTC/USDT:USDT"))).toBe(false);
    expect(strategy.accept(ticker("DOGE/USDT"))).toBe(false);
  });
});

describe("accept", () => {
  it("hands the ticker's instrument, parsed, to acceptInstrument", () => {
    const seen: Instrument[] = [];
    class Spy extends AbstractTickerStrategy {
      constructor() {
        super("Spy");
      }

      override acceptInstrument(instrument: Instrument): boolean {
        seen.push(instrument);
        return true;
      }
    }
    const strategy = new Spy();
    strategy.accept(ticker("BTC/USDT:USDT-240628"));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.equals(Instrument.parse("BTC/USDT:USDT-240628"))).toBe(true);
  });

  it("parses a symbol once, however many data points carry it", () => {
    const seen: Instrument[] = [];
    class Spy extends AbstractTickerStrategy {
      constructor() {
        super("Spy");
      }

      override acceptInstrument(instrument: Instrument): boolean {
        seen.push(instrument);
        return true;
      }
    }
    const strategy = new Spy();
    strategy.accept(ticker("BTC/USDT"));
    strategy.accept(ticker("BTC/USDT"));
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it("is the same for a kline strategy, off the bar's instrument", () => {
    const strategy = new KlineStrategy();
    strategy.setOutput("USDT");
    strategy.setBlacklistedCurrencies(["DOGE"]);
    expect(strategy.accept(kline("BTC/USDT"))).toBe(true);
    expect(strategy.accept(kline("BTC/EUR"))).toBe(false);
    expect(strategy.accept(kline("DOGE/USDT"))).toBe(false);
  });

  it("throws on a symbol that is not BASE/QUOTE, naming it", () => {
    const strategy = new TickerStrategy();
    expect(() => strategy.accept(ticker("BTCUSDT"))).toThrow(/"BTCUSDT"/);
    expect(() => new KlineStrategy().accept(kline("BTCUSDT"))).toThrow(/"BTCUSDT"/);
  });

  it("leaves update() alone: a data point fed straight in is not asked about", () => {
    const strategy = new TickerStrategy();
    strategy.setBlacklistedCurrencies(["BTC"]);
    strategy.update(ticker("BTC/USDT"));
    strategy.update(ticker("BTCUSDT"));
    expect([...strategy.instruments]).toEqual(["BTC/USDT", "BTCUSDT"]);
  });
});
