/**
 * A single asset / currency code (`BTC`, `USDT`), the money-side counterpart of `Instrument`.
 * Codes are normalised to upper case, so `Asset.of("usdt")` equals `new Asset("USDT")`.
 * Port of com.wualabs.qtsurfer.engine.core.Asset
 */
export class Asset {
  readonly code: string;

  constructor(code: string) {
    if (typeof code !== "string") {
      throw new TypeError("code must not be null");
    }
    this.code = code.toUpperCase();
  }

  static of(code: string): Asset {
    return new Asset(code);
  }

  equals(other: unknown): boolean {
    return other instanceof Asset && other.code === this.code;
  }

  toString(): string {
    return this.code;
  }
}
