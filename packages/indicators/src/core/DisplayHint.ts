/**
 * How an indicator's value should be presented: the typed view of the `dsp` metadata entry.
 *
 * It used to be written into the registered name (`rsi14%`), so a lookup by the name the strategy
 * author gave (`rsi14`) failed. The hint now rides the indicator's metadata and the name stays the
 * lookup name.
 *
 * Each non-default value has a one-letter wire code; `ABSOLUTE` has none, because the default is
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
    for (const hint of [DisplayHint.PERCENT, DisplayHint.VOLUME]) {
      if (hint.code === code) return hint;
    }
    return DisplayHint.ABSOLUTE;
  }

  toString(): string {
    return this.name;
  }
}
