import { describe, expect, it } from "vitest";
import { Instrument, MarketDataSource, VenueType } from "@qtsurfer/core";
import { StrategyContext } from "../src/StrategyContext";

/**
 * The attachment context a strategy receives in `onAttach` and `onDetach`: what the builder
 * accepts and rejects, that the value is immutable and copied defensively, and how the accessors
 * a scripting layer reads, scalars and the two enums, behave at their edges.
 */

const BTC_USDT = Instrument.of("BTC", "USDT");
const ETH_USDT = Instrument.of("ETH", "USDT");
const BTC_PERP = Instrument.of("BTC", "USDT", "USDT");

const REASONS = [
  StrategyContext.REASON_OWNER,
  StrategyContext.REASON_REFUSED,
  StrategyContext.REASON_POOL_GONE,
  StrategyContext.REASON_CAPACITY,
  StrategyContext.REASON_FUNDS,
];

function valid() {
  return StrategyContext.builder()
    .id("att-1")
    .venueType(VenueType.CEX)
    .exchange("binance")
    .segment("spot")
    .type(MarketDataSource.Ticker);
}

describe("StrategyContext", () => {
  it("a valid context reports every field it was built with", () => {
    const context = valid().instruments([BTC_USDT, ETH_USDT]).warmingUp(true).build();

    expect(context.getId()).toBe("att-1");
    expect(context.getVenueType()).toBe(VenueType.CEX);
    expect(context.getExchange()).toBe("binance");
    expect(context.getSegment()).toBe("spot");
    expect(context.getType()).toBe(MarketDataSource.Ticker);
    expect(context.getInstrumentCount()).toBe(2);
    expect(context.isWarmingUp()).toBe(true);
    expect(context.getReason()).toBe("");
  });

  /** The venue type and the data type are the enum members set, whichever member that is. */
  it("the venue type and the type are the enum members the builder was given", () => {
    for (const venueType of Object.values(VenueType)) {
      for (const type of Object.values(MarketDataSource)) {
        const context = valid().venueType(venueType).type(type).build();

        expect(context.getVenueType()).toBe(venueType);
        expect(context.getType()).toBe(type);
      }
    }
  });

  it("the type name of a ticker context is ticker", () => {
    expect(valid().type(MarketDataSource.Ticker).build().getTypeName()).toBe("ticker");
  });

  it("the type name of a kline context is kline", () => {
    expect(valid().type(MarketDataSource.KLine).build().getTypeName()).toBe("kline");
  });

  it("the type name of a funding rate context is funding", () => {
    expect(valid().type(MarketDataSource.FundingRate).build().getTypeName()).toBe("funding");
  });

  it("the venue type name of a cex context is cex", () => {
    expect(valid().venueType(VenueType.CEX).build().getVenueTypeName()).toBe("cex");
  });

  it("the venue type name of a dex context is dex", () => {
    expect(valid().venueType(VenueType.DEX).build().getVenueTypeName()).toBe("dex");
  });

  /** A detach is a copy of the attach, and its tokens are the attach's tokens. */
  it("the name accessors follow the detached copy for every venue type and type", () => {
    for (const venueType of Object.values(VenueType)) {
      for (const type of Object.values(MarketDataSource)) {
        const attach = valid().venueType(venueType).type(type).warmingUp(true).build();

        const detach = attach.detached(StrategyContext.REASON_OWNER);

        expect(detach.getTypeName()).toBe(attach.getTypeName());
        expect(detach.getVenueTypeName()).toBe(attach.getVenueTypeName());
        expect(attach.detached(null).getTypeName()).toBe(attach.getTypeName());
        expect(attach.detached(null).getVenueTypeName()).toBe(attach.getVenueTypeName());
      }
    }
  });

  it("the defaults are no instruments, not warming up and the empty reason", () => {
    const context = valid().build();

    expect(context.getInstrumentCount()).toBe(0);
    expect(context.instrumentList()).toEqual([]);
    expect(context.isWarmingUp()).toBe(false);
    expect(context.getReason()).toBe("");
  });

  it("id, venue type, exchange and type are required", () => {
    expect(() => valid().id(null).build()).toThrow(/id/);
    expect(() => valid().id(undefined).build()).toThrow(/id/);
    expect(() => valid().id("  ").build()).toThrow(/id/);
    expect(() => valid().venueType(null).build()).toThrow(/venueType/);
    expect(() => valid().exchange(null).build()).toThrow(/exchange/);
    expect(() => valid().exchange("  ").build()).toThrow(/exchange/);
    expect(() => valid().type(null).build()).toThrow(/type/);
    expect(() => StrategyContext.builder().build()).toThrow();
  });

  it("a null or undefined venue type is rejected by name", () => {
    expect(() => valid().venueType(null).build()).toThrow(new TypeError("venueType must not be null"));
    expect(() => valid().venueType(undefined).build()).toThrow(
      new TypeError("venueType must not be null"),
    );
    expect(() =>
      StrategyContext.builder().id("a").exchange("x").type(MarketDataSource.Ticker).build(),
    ).toThrow(new TypeError("venueType must not be null"));
  });

  it("a null or undefined type is rejected by name", () => {
    expect(() => valid().type(null).build()).toThrow(new TypeError("type must not be null"));
    expect(() => valid().type(undefined).build()).toThrow(new TypeError("type must not be null"));
    expect(() => StrategyContext.builder().id("a").venueType(VenueType.CEX).exchange("x").build()).toThrow(
      new TypeError("type must not be null"),
    );
  });

  /** A value that is not a member of the enum cannot reach the name accessors. */
  it("a venue type or a type that is not an enum member is rejected", () => {
    expect(() => valid().venueType("MTF" as VenueType).build()).toThrow(/venueType must be one of \[CEX, DEX\]/);
    expect(() => valid().type("Trade" as MarketDataSource).build()).toThrow(
      /type must be one of \[Ticker, KLine, FundingRate\]/,
    );
  });

  /** A venue without segments is a legitimate source; the segment is empty, never null. */
  it("the segment may be empty for a venue without segments", () => {
    expect(valid().segment("").build().getSegment()).toBe("");
    expect(valid().segment(null).build().getSegment()).toBe("");
    expect(valid().segment(undefined).build().getSegment()).toBe("");
    expect(valid().segment("   ").build().getSegment()).toBe("");

    const unset = StrategyContext.builder()
      .id("a")
      .venueType(VenueType.CEX)
      .exchange("x")
      .type(MarketDataSource.Ticker)
      .build();
    expect(unset.getSegment()).toBe("");
  });

  it("the instruments are copied and keep the order they were given", () => {
    const given = [ETH_USDT, BTC_USDT, BTC_PERP];
    const context = valid().instruments(given).build();

    given.length = 0;
    given.push(Instrument.of("SOL", "USDT"));

    expect(context.instrumentList().map((instrument) => instrument.symbol())).toEqual([
      "ETH/USDT",
      "BTC/USDT",
      "BTC/USDT:USDT",
    ]);
    expect(context.getInstrumentCount()).toBe(3);
    expect(context.getInstrument(0)).toBe("ETH/USDT");
    expect(context.getInstrument(1)).toBe("BTC/USDT");
    expect(context.getInstrument(2)).toBe("BTC/USDT:USDT");
  });

  it("any iterable of instruments is accepted", () => {
    const context = valid().instruments(new Set([BTC_USDT, ETH_USDT])).build();

    expect(context.getInstrumentCount()).toBe(2);
    expect(context.getInstrument(1)).toBe("ETH/USDT");
  });

  /** The builder copies when the setter is called, so a reused builder cannot leak into a context. */
  it("changing the source collection after the setter does not reach a built context", () => {
    const given = [BTC_USDT];
    const builder = valid().instruments(given);
    given.push(ETH_USDT);

    expect(builder.build().instrumentList().map((instrument) => instrument.symbol())).toEqual(["BTC/USDT"]);
  });

  it("the typed instrument list is unmodifiable", () => {
    const context = valid().instruments([BTC_USDT]).build();
    const list = context.instrumentList() as Instrument[];

    expect(() => list.push(ETH_USDT)).toThrow(TypeError);
    expect(() => {
      list.length = 0;
    }).toThrow(TypeError);
    expect(context.getInstrumentCount()).toBe(1);
  });

  it("a null instrument collection or element is rejected", () => {
    expect(() => valid().instruments(null)).toThrow(TypeError);
    expect(() => valid().instruments(undefined)).toThrow(TypeError);
    expect(() => valid().instruments([BTC_USDT, null as unknown as Instrument])).toThrow(TypeError);
  });

  it("hasInstrument matches the symbol exactly", () => {
    const context = valid().instruments([BTC_USDT, BTC_PERP]).build();

    expect(context.hasInstrument("BTC/USDT")).toBe(true);
    expect(context.hasInstrument("BTC/USDT:USDT")).toBe(true);
    expect(context.hasInstrument(BTC_USDT.symbol())).toBe(true);
    expect(context.hasInstrument("ETH/USDT")).toBe(false);
    expect(context.hasInstrument("btc/usdt")).toBe(false);
    expect(context.hasInstrument("BTC")).toBe(false);
    expect(context.hasInstrument("")).toBe(false);
    expect(context.hasInstrument(null)).toBe(false);
    expect(context.hasInstrument(undefined)).toBe(false);
  });

  /** The text `getInstrument` returns is the text `hasInstrument` matches. */
  it("getInstrument returns the symbol that hasInstrument matches", () => {
    const context = valid().instruments([ETH_USDT, BTC_PERP]).build();

    for (let i = 0; i < context.getInstrumentCount(); i++) {
      expect(context.hasInstrument(context.getInstrument(i))).toBe(true);
      expect(context.getInstrument(i)).toBe(context.instrumentList()[i]?.symbol());
    }
  });

  it("getInstrument out of range throws a RangeError", () => {
    const context = valid().instruments([BTC_USDT]).build();

    expect(() => context.getInstrument(-1)).toThrow(RangeError);
    expect(() => context.getInstrument(1)).toThrow(RangeError);
    expect(() => context.getInstrument(0.5)).toThrow(RangeError);
    expect(() => context.getInstrument(Number.NaN)).toThrow(RangeError);
    expect(() => valid().build().getInstrument(0)).toThrow(RangeError);
  });

  it("the reason constants have the names they carry", () => {
    expect(StrategyContext.REASON_OWNER).toBe("OWNER");
    expect(StrategyContext.REASON_REFUSED).toBe("REFUSED");
    expect(StrategyContext.REASON_POOL_GONE).toBe("POOL_GONE");
    expect(StrategyContext.REASON_CAPACITY).toBe("CAPACITY");
    expect(StrategyContext.REASON_FUNDS).toBe("FUNDS");
  });

  it("every reason constant is accepted", () => {
    for (const reason of REASONS) {
      expect(valid().reason(reason).build().getReason()).toBe(reason);
    }
  });

  /** Null, undefined and empty all mean no reason, and the reason a caller reads is the empty string. */
  it("the builder reads a null reason as the empty string", () => {
    expect(valid().reason(null).build().getReason()).toBe("");
    expect(valid().reason(undefined).build().getReason()).toBe("");
    expect(valid().reason("").build().getReason()).toBe("");
    expect(valid().build().getReason()).toBe("");
    // A later null takes back an earlier reason rather than keeping it.
    expect(valid().reason(StrategyContext.REASON_FUNDS).reason(null).build().getReason()).toBe("");
  });

  it("a reason that is not a constant is rejected", () => {
    expect(() => valid().reason("BOGUS").build()).toThrow(/BOGUS/);
    for (const bad of [" ", "   ", "owner", "Owner", "OTHER", "OWNER ", " OWNER"]) {
      expect(() => valid().reason(bad).build(), `reason '${bad}'`).toThrow(/reason/);
    }
  });

  /** The message names the empty string as an allowed value, not null. */
  it("the rejection message offers the empty string, not null", () => {
    let message = "";
    try {
      valid().reason("BOGUS").build();
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("empty");
    expect(message).not.toContain("null");
  });

  it("detached is a copy with the reason that is no longer warming up", () => {
    const attach = valid().instruments([BTC_USDT, ETH_USDT]).warmingUp(true).build();

    const detach = attach.detached(StrategyContext.REASON_CAPACITY);

    expect(detach).not.toBe(attach);
    expect(detach.getReason()).toBe("CAPACITY");
    expect(detach.isWarmingUp()).toBe(false);
    expect(detach.getId()).toBe(attach.getId());
    expect(detach.getVenueType()).toBe(attach.getVenueType());
    expect(detach.getExchange()).toBe(attach.getExchange());
    expect(detach.getSegment()).toBe(attach.getSegment());
    expect(detach.getType()).toBe(attach.getType());
    expect(detach.instrumentList()).toEqual(attach.instrumentList());
    // The original is untouched.
    expect(attach.getReason()).toBe("");
    expect(attach.isWarmingUp()).toBe(true);
  });

  /** The copy keeps the enums as they were set, also when they are not the ones valid() uses. */
  it("detached keeps the venue type and the type", () => {
    const attach = valid().venueType(VenueType.DEX).type(MarketDataSource.FundingRate).build();

    const detach = attach.detached(StrategyContext.REASON_OWNER);

    expect(detach.getVenueType()).toBe(VenueType.DEX);
    expect(detach.getType()).toBe(MarketDataSource.FundingRate);
    expect(attach.detached(null).getVenueType()).toBe(VenueType.DEX);
    expect(attach.detached(null).getType()).toBe(MarketDataSource.FundingRate);
  });

  it("detached with no reason gives the empty string", () => {
    const attach = valid().build();

    expect(attach.getReason()).toBe("");
    expect(attach.detached().getReason()).toBe("");
    expect(attach.detached(null).getReason()).toBe("");
    expect(attach.detached(undefined).getReason()).toBe("");
    expect(attach.detached("").getReason()).toBe("");
    expect(attach.detached(null).isWarmingUp()).toBe(false);
    expect(attach.detached("").isWarmingUp()).toBe(false);
  });

  it("detached accepts every reason constant", () => {
    const attach = valid().warmingUp(true).build();

    for (const reason of REASONS) {
      const detach = attach.detached(reason);
      expect(detach.getReason()).toBe(reason);
      expect(detach.isWarmingUp()).toBe(false);
    }
  });

  it("detached rejects any other reason", () => {
    const attach = valid().build();

    for (const bad of ["BOGUS", " ", "   ", "owner", "Owner", "OTHER"]) {
      expect(() => attach.detached(bad), `reason '${bad}'`).toThrow(/reason/);
    }
  });

  it("equality covers every field", () => {
    const base = valid().instruments([BTC_USDT]).build();

    expect(valid().instruments([BTC_USDT]).build().equals(base)).toBe(true);
    expect(base.equals(base)).toBe(true);
    expect(base.equals(null)).toBe(false);
    expect(base.equals("att-1")).toBe(false);

    expect(valid().id("att-2").instruments([BTC_USDT]).build().equals(base)).toBe(false);
    expect(valid().venueType(VenueType.DEX).instruments([BTC_USDT]).build().equals(base)).toBe(false);
    expect(valid().exchange("kraken").instruments([BTC_USDT]).build().equals(base)).toBe(false);
    expect(valid().segment("perp").instruments([BTC_USDT]).build().equals(base)).toBe(false);
    expect(valid().type(MarketDataSource.KLine).instruments([BTC_USDT]).build().equals(base)).toBe(false);
    expect(valid().instruments([ETH_USDT]).build().equals(base)).toBe(false);
    expect(valid().build().equals(base)).toBe(false);
    expect(valid().instruments([BTC_USDT]).warmingUp(true).build().equals(base)).toBe(false);
    expect(valid().instruments([BTC_USDT]).reason("FUNDS").build().equals(base)).toBe(false);
  });

  it("two contexts that differ only in the venue type are not equal", () => {
    const cex = valid().venueType(VenueType.CEX).build();
    const dex = valid().venueType(VenueType.DEX).build();

    expect(cex.equals(dex)).toBe(false);
    expect(dex.equals(cex)).toBe(false);
    expect(dex.equals(valid().venueType(VenueType.DEX).build())).toBe(true);
  });

  it("two contexts that differ only in the type are not equal", () => {
    const ticker = valid().type(MarketDataSource.Ticker).build();
    const kline = valid().type(MarketDataSource.KLine).build();

    expect(ticker.equals(kline)).toBe(false);
    expect(kline.equals(ticker)).toBe(false);
    expect(kline.equals(valid().type(MarketDataSource.KLine).build())).toBe(true);
  });

  /** No reason is one value, however it was spelled to the builder. */
  it("a null reason and an empty reason are equal", () => {
    const withNull = valid().instruments([BTC_USDT]).reason(null).build();
    const withEmpty = valid().instruments([BTC_USDT]).reason("").build();

    expect(withNull.equals(withEmpty)).toBe(true);
    expect(withNull.detached(null).equals(withEmpty.detached(""))).toBe(true);
  });

  it("the instrument order is part of equality", () => {
    expect(
      valid()
        .instruments([BTC_USDT, ETH_USDT])
        .build()
        .equals(valid().instruments([ETH_USDT, BTC_USDT]).build()),
    ).toBe(false);
  });

  it("toString names the fields and the instrument symbols", () => {
    const text = valid()
      .instruments([BTC_USDT, ETH_USDT])
      .build()
      .detached(StrategyContext.REASON_OWNER)
      .toString();

    expect(text).toBe(
      "StrategyContext{id=att-1, venueType=CEX, exchange=binance, segment=spot, type=Ticker, " +
        "instruments=[BTC/USDT, ETH/USDT], warmingUp=false, reason=OWNER}",
    );
  });

  it("toString prints the empty reason like the empty segment", () => {
    const text = valid().segment("").build().toString();

    expect(text).toContain("segment=,");
    expect(text.endsWith("reason=}")).toBe(true);
  });
});

/**
 * Pins the shape of the context that a layer reading it by name depends on.
 *
 * Such a layer enumerates the `get*`, `is*` and `has*` methods and binds each one to a script
 * value, so every one of them has to return, and take, a scalar. The two exceptions are
 * `getVenueType()` and `getType()`, which return an enum (`VenueType` and `MarketDataSource`);
 * every other accessor is a scalar. A caller that cannot read an enum compares the strings that
 * `getVenueTypeName()` and `getTypeName()` return instead, so those two are scalars as well: ten
 * scalar accessors in all. A new accessor, or an old one that changed its type, would be picked up
 * by that layer without anyone deciding it should be; this test is where the decision gets made.
 */
describe("StrategyContext accessor surface", () => {
  const methods = Object.getOwnPropertyNames(StrategyContext.prototype)
    .filter((name) => name !== "constructor")
    .sort();
  const accessors = methods.filter((name) => /^(get|is|has)[A-Z]/.test(name));

  it("the only accessors are ten scalars and two enums", () => {
    expect(accessors).toEqual(
      [
        "getId",
        "getVenueType",
        "getVenueTypeName",
        "getExchange",
        "getSegment",
        "getType",
        "getTypeName",
        "getInstrumentCount",
        "getInstrument",
        "hasInstrument",
        "isWarmingUp",
        "getReason",
      ].sort(),
    );
  });

  it("the whole method surface is the accessors plus four named ones", () => {
    expect(methods).toEqual([...accessors, "detached", "equals", "instrumentList", "toString"].sort());
  });

  it("the two enum accessors return the enums and every other accessor a scalar", () => {
    const context = valid().instruments([BTC_USDT]).build();
    const scalars = new Set(["string", "number", "boolean"]);

    expect(Object.values(VenueType)).toContain(context.getVenueType());
    expect(Object.values(MarketDataSource)).toContain(context.getType());
    for (const name of accessors) {
      if (name === "getVenueType" || name === "getType") continue;
      const method = (context as unknown as Record<string, (arg?: unknown) => unknown>)[name] as (
        arg?: unknown,
      ) => unknown;
      const argument = name === "getInstrument" ? 0 : name === "hasInstrument" ? "BTC/USDT" : undefined;
      expect(scalars.has(typeof method.call(context, argument)), name).toBe(true);
    }
  });

  it("no collection accessor is named like a bean property", () => {
    expect(methods).not.toContain("getInstruments");
  });
});
