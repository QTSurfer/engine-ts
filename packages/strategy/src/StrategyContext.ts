import type { Instrument } from "@qtsurfer/core";
import { MarketDataSource, VenueType } from "@qtsurfer/core";

/** The text the engine accepts as a detach reason, besides the empty string. */
const REASONS: readonly string[] = [
  "OWNER",
  "REFUSED",
  "POOL_GONE",
  "CAPACITY",
  "FUNDS",
  "STRATEGY",
];

/** What a context holds, already checked: the one argument of its constructor. */
interface ContextFields {
  readonly id: string;
  readonly venueType: VenueType;
  readonly exchange: string;
  readonly segment: string;
  readonly type: MarketDataSource;
  readonly instruments: readonly Instrument[];
  readonly warmingUp: boolean;
  readonly reason: string;
}

/** Makes a context from checked fields; set when the class is defined, so its constructor can stay private. */
let create: (fields: ContextFields) => StrategyContext;

/**
 * What a strategy is told when a market-data source is attached to it or detached from it: which
 * attachment it is, where its data comes from, which instruments it covers, whether the strategy
 * is still warming up on it and, on a detach, why it ended. On an attach the reason is empty.
 *
 * Immutable, and built with {@link StrategyContext.builder}. A strategy receives one in
 * `onAttach` and a copy of it, made with {@link StrategyContext.detached}, in `onDetach`.
 *
 * **The accessors are scalars and two enums, on purpose.** Everything a script can ask is a
 * string, a number, a boolean or one of the two enums `getVenueType()` and `getType()` return:
 * the instruments are read through `getInstrumentCount()`, `getInstrument(index)` and
 * `hasInstrument(symbol)`, and there is no accessor that returns a collection. A caller that
 * reads the context by name, a scripting layer for one, therefore never has to know a collection
 * type. `instrumentList()` is the typed view for TypeScript code.
 *
 * A caller that cannot read an enum can compare a string instead: `getVenueTypeName()` and
 * `getTypeName()` give the lower-case tokens the platform's public contract uses, for example
 * `context.getTypeName() === "kline"`. `getVenueType()` and `getType()` stay the typed accessors.
 *
 * The source is described by four fields:
 *
 * - `venueType`: the kind of venue, a {@link VenueType}: `CEX` or `DEX`. `getVenueTypeName()`
 *   gives it as the token `"cex"` or `"dex"`.
 * - `exchange`: the venue's name.
 * - `segment`: the part of the venue the data belongs to, for example `"spot"`. It is empty for a
 *   venue that has no segments.
 * - `type`: the kind of data, a {@link MarketDataSource}: `Ticker`, `KLine` or `FundingRate`.
 *   `getTypeName()` gives it as the token `"ticker"`, `"kline"` or `"funding"`.
 *
 * Two contexts are equal, by {@link StrategyContext.equals}, when all their fields are equal.
 *
 * Port of com.wualabs.qtsurfer.engine.strategy.StrategyContext
 */
export class StrategyContext {
  /** Detach reason: the owner of the run detached the source at will. */
  static readonly REASON_OWNER = "OWNER";
  /** Detach reason: the attachment was refused. */
  static readonly REASON_REFUSED = "REFUSED";
  /** Detach reason: the pool that supplied the market data is gone. */
  static readonly REASON_POOL_GONE = "POOL_GONE";
  /** Detach reason: the host has no capacity left for the attachment. */
  static readonly REASON_CAPACITY = "CAPACITY";
  /** Detach reason: the attachment ended because of the funds available to it. */
  static readonly REASON_FUNDS = "FUNDS";
  /** Detach reason: the strategy itself ended the attachment, with `detach(...)`. */
  static readonly REASON_STRATEGY = "STRATEGY";

  static {
    create = (fields) => new StrategyContext(fields);
  }

  private readonly attachmentId: string;
  private readonly venue: VenueType;
  private readonly exchangeName: string;
  private readonly segmentName: string;
  private readonly dataType: MarketDataSource;
  private readonly instruments: readonly Instrument[];
  private readonly symbols: readonly string[];
  private readonly warming: boolean;
  private readonly endReason: string;

  private constructor(fields: ContextFields) {
    this.attachmentId = fields.id;
    this.venue = fields.venueType;
    this.exchangeName = fields.exchange;
    this.segmentName = fields.segment;
    this.dataType = fields.type;
    this.instruments = fields.instruments;
    this.symbols = Object.freeze(fields.instruments.map((instrument) => instrument.symbol()));
    this.warming = fields.warmingUp;
    this.endReason = fields.reason;
  }

  /** A builder with no field set: the instruments are empty and the strategy is not warming up. */
  static builder(): StrategyContextBuilder {
    return new StrategyContextBuilder();
  }

  /** The attachment's identity: two events with the same id belong to the same attachment. */
  getId(): string {
    return this.attachmentId;
  }

  /** The kind of venue the data comes from. Never null. */
  getVenueType(): VenueType {
    return this.venue;
  }

  /**
   * The kind of venue the data comes from, as the lower-case token the platform's public contract
   * uses: `"cex"` for `CEX` and `"dex"` for `DEX`. It is offered because a caller that cannot read
   * an enum can compare a string, for example `context.getVenueTypeName() === "dex"`;
   * `getVenueType()` stays the typed accessor.
   */
  getVenueTypeName(): string {
    switch (this.venue) {
      case VenueType.CEX:
        return "cex";
      case VenueType.DEX:
        return "dex";
    }
  }

  /** The name of the venue the data comes from. Never blank. */
  getExchange(): string {
    return this.exchangeName;
  }

  /**
   * The part of the venue the data belongs to, for example `"spot"`. Empty, never null, for a
   * venue that has no segments.
   */
  getSegment(): string {
    return this.segmentName;
  }

  /** The kind of data the source carries. Never null. */
  getType(): MarketDataSource {
    return this.dataType;
  }

  /**
   * The kind of data the source carries, as the lower-case token the platform's public contract
   * uses: `"ticker"` for `Ticker`, `"kline"` for `KLine` and `"funding"` for `FundingRate`. It is
   * offered because a caller that cannot read an enum can compare a string, for example
   * `context.getTypeName() === "kline"`; `getType()` stays the typed accessor.
   */
  getTypeName(): string {
    switch (this.dataType) {
      case MarketDataSource.Ticker:
        return "ticker";
      case MarketDataSource.KLine:
        return "kline";
      case MarketDataSource.FundingRate:
        return "funding";
    }
  }

  /** How many instruments the attachment covers. */
  getInstrumentCount(): number {
    return this.symbols.length;
  }

  /**
   * One instrument of the attachment, as its symbol: the same text `hasInstrument` matches. The
   * instruments keep the order they were given to the builder.
   *
   * @param index a position from `0` to `getInstrumentCount() - 1`
   * @returns the symbol of the instrument at `index`, in the CCXT form `"BTC/USDT"`
   * @throws RangeError if `index` is not an integer in range
   */
  getInstrument(index: number): string {
    if (!Number.isInteger(index) || index < 0 || index >= this.symbols.length) {
      throw new RangeError(`Index ${index} out of bounds for length ${this.symbols.length}`);
    }
    return this.symbols[index] as string;
  }

  /**
   * Whether the attachment covers an instrument.
   *
   * @param symbol an instrument symbol in the CCXT form, for example `"BTC/USDT"`
   * @returns `true` if one of the attachment's instruments has exactly this symbol; `false` for
   *   any other text, including `null` and `undefined`
   */
  hasInstrument(symbol: string | null | undefined): boolean {
    return typeof symbol === "string" && this.symbols.includes(symbol);
  }

  /**
   * Whether the strategy is still warming up on this attachment: its indicators are filling from
   * history, so what it computes is not yet reliable. Always `false` on a detach.
   */
  isWarmingUp(): boolean {
    return this.warming;
  }

  /**
   * Why the attachment ended: one of the `REASON_` constants. Empty on an attach, and on a detach
   * that was given no reason; it is never null, so a caller can compare it without a null check.
   */
  getReason(): string {
    return this.endReason;
  }

  /**
   * The instruments of the attachment as typed values, in the order they were given to the
   * builder. This is the view for TypeScript code; it is deliberately not named `getInstruments`,
   * because `getInstrumentCount()` and `getInstrument(index)` are the scalar way to read them.
   *
   * @returns a frozen array, never null
   */
  instrumentList(): readonly Instrument[] {
    return this.instruments;
  }

  /**
   * The context to hand to `onDetach`: this attachment, no longer warming up, ended for `reason`.
   *
   * @param reason one of the `REASON_` constants, or `null`, `undefined` or the empty string for a
   *   detach with no reason, which then has the empty reason
   * @returns a new context; this one is not changed
   * @throws Error if `reason` is neither empty nor one of the constants
   */
  detached(reason?: string | null): StrategyContext {
    return StrategyContext.toBuilder(this).warmingUp(false).reason(reason).build();
  }

  /** Whether `other` is a context with the same value in every field. */
  equals(other: unknown): boolean {
    if (this === other) return true;
    return (
      other instanceof StrategyContext &&
      this.warming === other.warming &&
      this.attachmentId === other.attachmentId &&
      this.venue === other.venue &&
      this.exchangeName === other.exchangeName &&
      this.segmentName === other.segmentName &&
      this.dataType === other.dataType &&
      this.instruments.length === other.instruments.length &&
      this.instruments.every((instrument, i) => instrument.equals(other.instruments[i])) &&
      this.endReason === other.endReason
    );
  }

  toString(): string {
    return (
      `StrategyContext{id=${this.attachmentId}, venueType=${this.venue}, ` +
      `exchange=${this.exchangeName}, segment=${this.segmentName}, type=${this.dataType}, ` +
      `instruments=[${this.symbols.join(", ")}], warmingUp=${this.warming}, ` +
      `reason=${this.endReason}}`
    );
  }

  /** A static, not a method, so the instance's public surface is only what a caller may use. */
  private static toBuilder(context: StrategyContext): StrategyContextBuilder {
    return new StrategyContextBuilder()
      .id(context.attachmentId)
      .venueType(context.venue)
      .exchange(context.exchangeName)
      .segment(context.segmentName)
      .type(context.dataType)
      .instruments(context.instruments)
      .warmingUp(context.warming)
      .reason(context.endReason);
  }
}

/**
 * Builds a {@link StrategyContext}. `id`, `venueType`, `exchange` and `type` are required;
 * everything else has a default. The checks run in `build()`.
 *
 * Get one from {@link StrategyContext.builder}.
 */
export class StrategyContextBuilder {
  private idText: string | null | undefined;
  private venueKind: VenueType | null | undefined;
  private exchangeText: string | null | undefined;
  private segmentText: string | null | undefined = "";
  private dataKind: MarketDataSource | null | undefined;
  private instrumentValues: readonly Instrument[] = Object.freeze([]);
  private warmingFlag = false;
  private reasonText = "";

  /** The attachment's identity. Required, not blank. */
  id(id: string | null | undefined): this {
    this.idText = id;
    return this;
  }

  /** The kind of venue. Required, not null. */
  venueType(venueType: VenueType | null | undefined): this {
    this.venueKind = venueType;
    return this;
  }

  /** The venue's name. Required, not blank. */
  exchange(exchange: string | null | undefined): this {
    this.exchangeText = exchange;
    return this;
  }

  /**
   * The part of the venue the data belongs to, for example `"spot"`. Optional: a venue without
   * segments leaves it out, and `null`, `undefined` or blank text becomes the empty string.
   */
  segment(segment: string | null | undefined): this {
    this.segmentText = segment;
    return this;
  }

  /** The kind of data. Required, not null. */
  type(type: MarketDataSource | null | undefined): this {
    this.dataKind = type;
    return this;
  }

  /**
   * The instruments the attachment covers. They are copied when this is called, in their own
   * iteration order, so later changes to the source do not reach the builder. Duplicates are kept
   * as given.
   *
   * @param instruments the instruments; not null, with no null element
   * @throws TypeError if `instruments` is null or has a null element
   */
  instruments(instruments: Iterable<Instrument> | null | undefined): this {
    if (instruments == null) {
      throw new TypeError("instruments must not be null");
    }
    const copy = Array.from(instruments);
    if (copy.some((instrument) => instrument == null)) {
      throw new TypeError("instruments must not contain null");
    }
    this.instrumentValues = Object.freeze(copy);
    return this;
  }

  /** Whether the strategy is still warming up on the attachment. The default is `false`. */
  warmingUp(warmingUp: boolean): this {
    this.warmingFlag = warmingUp;
    return this;
  }

  /**
   * Why the attachment ended: one of the `REASON_` constants of {@link StrategyContext}.
   * Optional; the empty string, the default, means no reason, and `null` or `undefined` becomes
   * the empty string.
   */
  reason(reason: string | null | undefined): this {
    this.reasonText = reason == null ? "" : reason;
    return this;
  }

  /**
   * Builds the context.
   *
   * @throws TypeError if `id`, `exchange`, `venueType` or `type` is null or undefined
   * @throws Error if `id` or `exchange` is blank, if `venueType` or `type` is not a member of its
   *   enum, or if `reason` is neither empty nor one of the `REASON_` constants
   */
  build(): StrategyContext {
    const id = requireText(this.idText, "id");
    const venueType = requireMember(this.venueKind, VenueType, "venueType");
    const exchange = requireText(this.exchangeText, "exchange");
    const type = requireMember(this.dataKind, MarketDataSource, "type");
    if (this.reasonText !== "" && !REASONS.includes(this.reasonText)) {
      throw new Error(`reason must be one of [${REASONS.join(", ")}] or empty: ${this.reasonText}`);
    }
    const segment = this.segmentText == null || this.segmentText.trim() === "" ? "" : this.segmentText;
    return create({
      id,
      venueType,
      exchange,
      segment,
      type,
      instruments: this.instrumentValues,
      warmingUp: this.warmingFlag,
      reason: this.reasonText,
    });
  }
}

function requireText(value: string | null | undefined, name: string): string {
  if (value == null) {
    throw new TypeError(`${name} must not be null`);
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must not be blank: ${String(value)}`);
  }
  return value;
}

function requireMember<E extends string>(
  value: E | null | undefined,
  members: Record<string, E>,
  name: string,
): E {
  if (value == null) {
    throw new TypeError(`${name} must not be null`);
  }
  if (!Object.values(members).includes(value)) {
    throw new Error(`${name} must be one of [${Object.values(members).join(", ")}]: ${String(value)}`);
  }
  return value;
}
