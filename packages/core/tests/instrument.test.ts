import { describe, it, expect } from "vitest";
import {
  Instrument,
  SpotInstrument,
  PerpetualInstrument,
  DatedFutureInstrument,
} from "../src/index";

describe("Instrument.parse", () => {
  it("reads a spot pair", () => {
    const instrument = Instrument.parse("BTC/USDT");
    expect(instrument).toBeInstanceOf(SpotInstrument);
    expect(instrument.base()).toBe("BTC");
    expect(instrument.quote()).toBe("USDT");
    expect(instrument.symbol()).toBe("BTC/USDT");
    expect(instrument.toString()).toBe("BTC/USDT");
    expect(instrument.isDerivative()).toBe(false);
    expect(instrument.isDated()).toBe(false);
  });

  it("reads a perpetual, margined in the quote or in the base", () => {
    const linear = Instrument.parse("BTC/USDT:USDT");
    expect(linear).toBeInstanceOf(PerpetualInstrument);
    expect(linear).toBeInstanceOf(PerpetualInstrument);
    const perpetual = linear as PerpetualInstrument;
    expect([perpetual.base(), perpetual.quote(), perpetual.settle()]).toEqual([
      "BTC",
      "USDT",
      "USDT",
    ]);
    expect(linear.isDerivative()).toBe(true);
    expect(linear.isDated()).toBe(false);

    const inverse = Instrument.parse("BTC/USD:BTC");
    const coinMargined = inverse as PerpetualInstrument;
    expect([coinMargined.base(), coinMargined.quote(), coinMargined.settle()]).toEqual([
      "BTC",
      "USD",
      "BTC",
    ]);
    expect(inverse.symbol()).toBe("BTC/USD:BTC");
  });

  it("reads a dated delivery contract, with the expiry as an ISO date", () => {
    const instrument = Instrument.parse("BTC/USDT:USDT-240628");
    expect(instrument).toBeInstanceOf(DatedFutureInstrument);
    const dated = instrument as DatedFutureInstrument;
    expect(dated.settle()).toBe("USDT");
    expect(dated.expiry()).toBe("2024-06-28");
    expect(instrument.isDerivative()).toBe(true);
    expect(instrument.isDated()).toBe(true);
    expect(instrument.symbol()).toBe("BTC/USDT:USDT-240628");
  });

  it("accepts a leap day only in a leap year", () => {
    expect(Instrument.parse("BTC/USDT:USDT-240229")).toBeInstanceOf(DatedFutureInstrument);
    expect(Instrument.parse("BTC/USDT:USDT-250229")).toBeInstanceOf(PerpetualInstrument);
  });

  it.each(["240631", "250229", "241301", "240001", "240600", "24062", "2406288", "24O628"])(
    "leaves a tail that is not a date inside the settlement currency: %s",
    (token) => {
      const instrument = Instrument.parse(`BTC/USDT:USDT-${token}`);
      expect(instrument).toBeInstanceOf(PerpetualInstrument);
      expect((instrument as PerpetualInstrument).settle()).toBe(`USDT-${token}`);
      expect(instrument.symbol()).toBe(`BTC/USDT:USDT-${token}`);
    },
  );

  it("keeps a hyphenated settlement currency that is not an expiry", () => {
    const instrument = Instrument.parse("BTC/USDT:USDT-ABC");
    expect(instrument).toBeInstanceOf(PerpetualInstrument);
    expect((instrument as PerpetualInstrument).settle()).toBe("USDT-ABC");
  });

  it("splits a dated settlement at the last hyphen", () => {
    const instrument = Instrument.parse("BTC/USDT:A-B-240628");
    expect(instrument).toBeInstanceOf(DatedFutureInstrument);
    expect((instrument as DatedFutureInstrument).settle()).toBe("A-B");
  });

  it("splits the pair at the first slash", () => {
    const instrument = Instrument.parse("A/B/C");
    expect([instrument.base(), instrument.quote()]).toEqual(["A", "B/C"]);
  });

  it("keeps the case it is given", () => {
    expect(Instrument.parse("btc/usdt").symbol()).toBe("btc/usdt");
  });

  it.each([
    ["no slash", "BTCUSDT", /Malformed instrument symbol: "BTCUSDT"/],
    ["empty", "", /Malformed instrument symbol: ""/],
    ["a colon and no slash", "BTCUSDT:USDT", /Malformed instrument symbol/],
    ["a blank base", "/USDT", /base must not be blank/],
    ["a blank quote", "BTC/", /quote must not be blank/],
    ["a blank settlement", "BTC/USDT:", /settle must not be blank/],
    ["a blank settlement before an expiry", "BTC/USDT:-240628", /settle must not be blank/],
    ["a whitespace base", " /USDT", /base must not be blank/],
  ])("rejects a malformed symbol: %s", (_name, symbol, message) => {
    expect(() => Instrument.parse(symbol)).toThrow(message);
  });

  it("rejects a symbol that is not a string", () => {
    expect(() => Instrument.parse(null as unknown as string)).toThrow(
      new TypeError("symbol must not be null"),
    );
    expect(() => Instrument.parse(undefined as unknown as string)).toThrow(
      new TypeError("symbol must not be null"),
    );
  });

  it.each(["BTC/USDT", "BTC/USDT:USDT", "BTC/USD:BTC", "BTC/USDT:USDT-240628", "ETH/EUR:EUR-991231"])(
    "symbol() is the exact inverse of parse: %s",
    (symbol) => {
      expect(Instrument.parse(symbol).symbol()).toBe(symbol);
    },
  );
});

describe("Instrument.of", () => {
  it("builds the variant that the argument count names", () => {
    expect(Instrument.of("BTC", "USDT")).toBeInstanceOf(SpotInstrument);
    expect(Instrument.of("BTC", "USDT", "USDT")).toBeInstanceOf(PerpetualInstrument);
    const dated = Instrument.of("BTC", "USDT", "USDT", "2024-06-28");
    expect(dated).toBeInstanceOf(DatedFutureInstrument);
    expect(dated.symbol()).toBe("BTC/USDT:USDT-240628");
  });

  it("rejects a null component and never downgrades the variant", () => {
    expect(() => Instrument.of(null as unknown as string, "USDT")).toThrow(
      new TypeError("base must not be null"),
    );
    expect(() => Instrument.of("BTC", "USDT", undefined as unknown as string)).toThrow(
      new TypeError("settle must not be null"),
    );
    expect(() =>
      Instrument.of("BTC", "USDT", "USDT", undefined as unknown as string),
    ).toThrow(new TypeError("expiry must not be null"));
  });

  it("rejects a blank component", () => {
    expect(() => Instrument.of("", "USDT")).toThrow(/base must not be blank/);
    expect(() => Instrument.of("BTC", " ")).toThrow(/quote must not be blank/);
    expect(() => Instrument.of("BTC", "USDT", "")).toThrow(/settle must not be blank/);
  });

  it.each(["2024-06-31", "2025-02-29", "240628", "2100-01-01", "1999-12-31", "2024-13-01", ""])(
    "rejects an expiry that is not a date in the symbol range: %j",
    (expiry) => {
      expect(() => Instrument.of("BTC", "USDT", "USDT", expiry)).toThrow(
        /expiry must be an ISO date \(YYYY-MM-DD\) in 2000-2099/,
      );
    },
  );

  it("rejects the wrong number of arguments", () => {
    expect(() => (Instrument.of as (...args: string[]) => unknown)("BTC")).toThrow(
      /takes 2 to 4 arguments, got 1/,
    );
  });
});

describe("Instrument equality", () => {
  it("is by components", () => {
    expect(Instrument.parse("BTC/USDT").equals(Instrument.of("BTC", "USDT"))).toBe(true);
    expect(Instrument.parse("BTC/USDT:USDT").equals(Instrument.of("BTC", "USDT", "USDT"))).toBe(
      true,
    );
    expect(
      Instrument.parse("BTC/USDT:USDT-240628").equals(
        Instrument.of("BTC", "USDT", "USDT", "2024-06-28"),
      ),
    ).toBe(true);
  });

  it("tells the variants apart even when the pair is the same", () => {
    const spot = Instrument.parse("BTC/USDT");
    const perpetual = Instrument.parse("BTC/USDT:USDT");
    const dated = Instrument.parse("BTC/USDT:USDT-240628");
    expect(spot.equals(perpetual)).toBe(false);
    expect(perpetual.equals(spot)).toBe(false);
    expect(perpetual.equals(dated)).toBe(false);
    expect(dated.equals(perpetual)).toBe(false);
  });

  it("tells two expiries on one pair apart", () => {
    expect(
      Instrument.parse("BTC/USDT:USDT-240628").equals(Instrument.parse("BTC/USDT:USDT-240927")),
    ).toBe(false);
  });

  it("is case sensitive, as the symbol is", () => {
    expect(Instrument.parse("btc/usdt").equals(Instrument.parse("BTC/USDT"))).toBe(false);
  });

  it("is false against anything that is not an instrument", () => {
    expect(Instrument.parse("BTC/USDT").equals("BTC/USDT")).toBe(false);
    expect(Instrument.parse("BTC/USDT").equals(null)).toBe(false);
  });
});
