/**
 * How an indicator output is drawn: the typed view of the `sty` metadata entry. The default, a line,
 * has no wire code and costs no bytes per stored column.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.PlotStyle
 */
export class PlotStyle {
  /** A line. The default. */
  static readonly LINE = new PlotStyle("LINE", null);
  /** Bars from zero, coloured by sign (Awesome Oscillator, Accelerator Oscillator). */
  static readonly HISTOGRAM = new PlotStyle("HISTOGRAM", "h");
  /** Dots (Parabolic SAR). */
  static readonly DOTS = new PlotStyle("DOTS", "d");

  /** Every style, `LINE` first. */
  static readonly values: readonly PlotStyle[] = [PlotStyle.LINE, PlotStyle.HISTOGRAM, PlotStyle.DOTS];

  private constructor(
    readonly name: string,
    /** The one-letter wire form, or null for LINE (an absent entry means the default). */
    readonly code: string | null,
  ) {}

  /** The style a wire code stands for. An unknown code is LINE rather than an error: drawing metadata must never break a data path. */
  static fromCode(code: string | null | undefined): PlotStyle {
    if (code == null) return PlotStyle.LINE;
    for (const style of PlotStyle.values) {
      if (style.code === code) return style;
    }
    return PlotStyle.LINE;
  }

  toString(): string {
    return this.name;
  }
}
