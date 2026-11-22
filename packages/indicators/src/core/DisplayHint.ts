/**
 * How an indicator's value should be presented: the typed view of the `dsp` metadata entry.
 *
 * It used to be written into the registered name (`rsi14%`), so a lookup by the name the strategy
 * author gave (`rsi14`) failed. The hint now rides the indicator's metadata and the name stays the
 * lookup name.
 *
 * Each non-default value has a one-letter wire code, and a reader that does not know a code reads it as
 * `ABSOLUTE`, so a column stored by a newer engine stays readable; `ABSOLUTE` has none, because the default is
 * expressed by the absence of the entry.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.DisplayHint
 */
export class DisplayHint {
  /** A plain numeric value on the primary axis. The default for every indicator. */
  static readonly ABSOLUTE = new DisplayHint("ABSOLUTE", null);
  /** A percentage: plots on a percentage axis. */
  static readonly PERCENT = new DisplayHint("PERCENT", "P");
  /** A volume-denominated value: plots on a volume pane or axis. */
  static readonly VOLUME = new DisplayHint("VOLUME", "V");
  /** A fraction, where 0.05 is 5 % (a volatility per bar, a drawdown). */
  static readonly FRACTION = new DisplayHint("FRACTION", "F");
  /** A ratio between two quantities (Sharpe, Sortino, Bollinger %B, CMF). */
  static readonly RATIO = new DisplayHint("RATIO", "R");
  /** An index on a scale of its own (RSI, MFI, Mass Index) that is not a percentage of anything. */
  static readonly INDEX = new DisplayHint("INDEX", "I");
  /** A pure number with no unit (a z-score, a kurtosis, a Fisher transform). */
  static readonly NUMBER = new DisplayHint("NUMBER", "N");

  /** Every hint, `ABSOLUTE` first. */
  static readonly values: readonly DisplayHint[] = [
    DisplayHint.ABSOLUTE,
    DisplayHint.PERCENT,
    DisplayHint.VOLUME,
    DisplayHint.FRACTION,
    DisplayHint.RATIO,
    DisplayHint.INDEX,
    DisplayHint.NUMBER,
  ];

  private constructor(
    readonly name: string,
    /** The one-letter wire form, or null for ABSOLUTE (an absent entry means the default). */
    readonly code: string | null,
  ) {}

  /**
   * The hint a wire code stands for. An unknown code is ABSOLUTE rather than an error: display
   * metadata must never break a data path.
   */
  static fromCode(code: string | null | undefined): DisplayHint {
    if (code == null) return DisplayHint.ABSOLUTE;
    for (const hint of DisplayHint.values) {
      if (hint.code === code) return hint;
    }
    return DisplayHint.ABSOLUTE;
  }

  toString(): string {
    return this.name;
  }
}
