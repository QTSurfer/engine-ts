/**
 * The side an indicator output stands for: the typed view of the `sde` metadata entry. A directional
 * pair is told apart by meaning, not by a colour chosen by whoever draws it: +DI and -DI, bull power
 * and bear power, Aroon up and Aroon down, a long and a short stop. The default, no side, has no wire
 * code.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.PlotSide
 */
export class PlotSide {
  /** The output has no side. The default. */
  static readonly NONE = new PlotSide("NONE", null);
  /** The output means the positive side (+DI, bull power, Aroon up). */
  static readonly UP = new PlotSide("UP", "u");
  /** The output means the negative side (-DI, bear power, Aroon down). */
  static readonly DOWN = new PlotSide("DOWN", "d");

  /** Every side, `NONE` first. */
  static readonly values: readonly PlotSide[] = [PlotSide.NONE, PlotSide.UP, PlotSide.DOWN];

  private constructor(
    readonly name: string,
    /** The one-letter wire form, or null for NONE (an absent entry means the default). */
    readonly code: string | null,
  ) {}

  /** The side a wire code stands for. An unknown code is NONE rather than an error: drawing metadata must never break a data path. */
  static fromCode(code: string | null | undefined): PlotSide {
    if (code == null) return PlotSide.NONE;
    for (const side of PlotSide.values) {
      if (side.code === code) return side;
    }
    return PlotSide.NONE;
  }

  toString(): string {
    return this.name;
  }
}
