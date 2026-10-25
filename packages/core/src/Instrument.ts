/**
 * Normalised instrument identity in the CCXT unified format.
 * Port of com.wualabs.qtsurfer.engine.core.instrument.Instrument and its three variants.
 *
 * - `SpotInstrument`: `BTC/USDT`
 * - `PerpetualInstrument`: `BTC/USDT:USDT` (USDT-margined), `BTC/USD:BTC` (coin-margined)
 * - `DatedFutureInstrument`: `BTC/USDT:USDT-240628`, a delivery contract with a fixed expiry
 *
 * `base()`, `quote()` and `symbol()` are methods, as in Java; `symbol()` is the exact inverse of
 * `Instrument.parse`, and is the string the rest of the port still carries as `instrument: string`. The distinction between the three variants is part
 * of identity: two delivery contracts on one pair with different expiries are different
 * instruments.
 *
 * Construct through `Instrument.of`. Each arity names exactly one variant and accepts no absent
 * component, so a missing settlement currency is never quietly turned into a spot pair.
 */
export type Instrument = SpotInstrument | PerpetualInstrument | DatedFutureInstrument;

function requireNotBlank(code: string, name: string): void {
  if (typeof code !== "string") {
    throw new TypeError(`${name} must not be null`);
  }
  if (code.trim() === "") {
    throw new Error(`${name} must not be blank`);
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Reads the `yyMMdd` token of a symbol tail as an ISO date (`YYYY-MM-DD`), or `null` when the
 * token is not one: exactly six digits, a two-digit year resolved into 2000-2099, and a date
 * that exists (`240631` and `250229` are not dated contracts).
 */
function parseExpiry(token: string): string | null {
  if (!/^[0-9]{6}$/.test(token)) return null;
  const year = 2000 + Number(token.slice(0, 2));
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Validates an ISO date (`YYYY-MM-DD`) in the 2000-2099 range the symbol grammar covers. */
function requireExpiry(expiry: string): void {
  if (typeof expiry !== "string") {
    throw new TypeError("expiry must not be null");
  }
  const match = /^(20[0-9]{2})-([0-9]{2})-([0-9]{2})$/.exec(expiry);
  const valid =
    match !== null &&
    Number(match[2]) >= 1 &&
    Number(match[2]) <= 12 &&
    Number(match[3]) >= 1 &&
    Number(match[3]) <= daysInMonth(Number(match[1]), Number(match[2]));
  if (!valid) {
    throw new Error(`expiry must be an ISO date (YYYY-MM-DD) in 2000-2099: ${expiry}`);
  }
}

/** A spot pair, settled in nothing: `BTC/USDT`. */
export class SpotInstrument {
  constructor(
    private readonly baseCode: string,
    private readonly quoteCode: string,
  ) {
    requireNotBlank(baseCode, "base");
    requireNotBlank(quoteCode, "quote");
  }

  base(): string {
    return this.baseCode;
  }

  quote(): string {
    return this.quoteCode;
  }

  symbol(): string {
    return `${this.baseCode}/${this.quoteCode}`;
  }

  isDerivative(): boolean {
    return false;
  }

  isDated(): boolean {
    return false;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof SpotInstrument &&
      other.baseCode === this.baseCode &&
      other.quoteCode === this.quoteCode
    );
  }

  toString(): string {
    return this.symbol();
  }
}

/** A perpetual contract, a derivative with no expiry: `BTC/USDT:USDT`, `BTC/USD:BTC`. */
export class PerpetualInstrument {
  constructor(
    private readonly baseCode: string,
    private readonly quoteCode: string,
    private readonly settleCode: string,
  ) {
    requireNotBlank(baseCode, "base");
    requireNotBlank(quoteCode, "quote");
    requireNotBlank(settleCode, "settle");
  }

  base(): string {
    return this.baseCode;
  }

  quote(): string {
    return this.quoteCode;
  }

  settle(): string {
    return this.settleCode;
  }

  symbol(): string {
    return `${this.baseCode}/${this.quoteCode}:${this.settleCode}`;
  }

  isDerivative(): boolean {
    return true;
  }

  isDated(): boolean {
    return false;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof PerpetualInstrument &&
      other.baseCode === this.baseCode &&
      other.quoteCode === this.quoteCode &&
      other.settleCode === this.settleCode
    );
  }

  toString(): string {
    return this.symbol();
  }
}

/**
 * A delivery contract that expires on a fixed date: `BTC/USDT:USDT-240628`.
 * `expiry()` is an ISO date (`YYYY-MM-DD`), rendered into the symbol as `yyMMdd`.
 */
export class DatedFutureInstrument {
  constructor(
    private readonly baseCode: string,
    private readonly quoteCode: string,
    private readonly settleCode: string,
    private readonly expiryDate: string,
  ) {
    requireNotBlank(baseCode, "base");
    requireNotBlank(quoteCode, "quote");
    requireNotBlank(settleCode, "settle");
    requireExpiry(expiryDate);
  }

  base(): string {
    return this.baseCode;
  }

  quote(): string {
    return this.quoteCode;
  }

  settle(): string {
    return this.settleCode;
  }

  expiry(): string {
    return this.expiryDate;
  }

  symbol(): string {
    const [year, month, day] = this.expiryDate.split("-") as [string, string, string];
    return `${this.baseCode}/${this.quoteCode}:${this.settleCode}-${year.slice(2)}${month}${day}`;
  }

  isDerivative(): boolean {
    return true;
  }

  isDated(): boolean {
    return true;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof DatedFutureInstrument &&
      other.baseCode === this.baseCode &&
      other.quoteCode === this.quoteCode &&
      other.settleCode === this.settleCode &&
      other.expiryDate === this.expiryDate
    );
  }

  toString(): string {
    return this.symbol();
  }
}

function malformed(symbol: string): Error {
  return new Error(`Malformed instrument symbol: ${JSON.stringify(symbol)}`);
}

/**
 * `of(base, quote)` is a spot pair, `of(base, quote, settle)` a perpetual and
 * `of(base, quote, settle, expiry)` a dated contract; the variant follows the argument count.
 *
 * @throws TypeError if a component is null, Error if one is blank or the expiry is not a date
 */
function of(...args: [base: string, quote: string]): SpotInstrument;
function of(...args: [base: string, quote: string, settle: string]): PerpetualInstrument;
function of(
  ...args: [base: string, quote: string, settle: string, expiry: string]
): DatedFutureInstrument;
function of(...args: string[]): Instrument {
  const [base, quote, settle, expiry] = args as [string, string, string, string];
  switch (args.length) {
    case 2:
      return new SpotInstrument(base, quote);
    case 3:
      return new PerpetualInstrument(base, quote, settle);
    case 4:
      return new DatedFutureInstrument(base, quote, settle, expiry);
    default:
      throw new Error(`Instrument.of takes 2 to 4 arguments, got ${args.length}`);
  }
}

/**
 * Parses a CCXT symbol back into the variant it denotes.
 *
 * The dated form is recognised only when the tail after the settlement currency is a hyphen
 * followed by exactly six digits forming a valid date; anything else stays part of the
 * settlement currency.
 *
 * @throws Error if the symbol has no `/`, or a component is blank
 */
function parse(symbol: string): Instrument {
  if (typeof symbol !== "string") {
    throw new TypeError("symbol must not be null");
  }
  const colon = symbol.indexOf(":");
  if (colon < 0) {
    const slash = symbol.indexOf("/");
    if (slash < 0) throw malformed(symbol);
    return new SpotInstrument(symbol.slice(0, slash), symbol.slice(slash + 1));
  }

  const pair = symbol.slice(0, colon);
  const tail = symbol.slice(colon + 1);
  const slash = pair.indexOf("/");
  if (slash < 0) throw malformed(symbol);
  const base = pair.slice(0, slash);
  const quote = pair.slice(slash + 1);

  const hyphen = tail.lastIndexOf("-");
  if (hyphen >= 0) {
    const expiry = parseExpiry(tail.slice(hyphen + 1));
    if (expiry !== null) {
      return new DatedFutureInstrument(base, quote, tail.slice(0, hyphen), expiry);
    }
  }
  return new PerpetualInstrument(base, quote, tail);
}

export const Instrument = { of, parse };
