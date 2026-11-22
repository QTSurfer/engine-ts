import { DisplayHint } from "./DisplayHint";
import { PlotSide } from "./PlotSide";
import { PlotStyle } from "./PlotStyle";

const RT_INDICATOR_SUFFIX = "RTIndicator";
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** A finite number written in decimal form, or null: drawing metadata must never break a data path. */
function parseFinite(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A whole number prints without a fraction, as the wire form is written (`0:100`). */
function wireNumber(value: number): string {
  return String(value);
}

/**
 * What an indicator says about itself, kept apart from the name it is registered under: its type,
 * its parameters, what it derives from, how to display it, whether it is published.
 *
 * Everything a name used to carry (the `%` display suffix, the `Upper`/`Lower`/`BW` band suffixes,
 * the parameter digits) is a small key=value entry here, so a stored column such as `blgr13_2Upper`
 * can be read as `id=bollinger, periods=13, k=2, band=upper` without knowing the naming scheme.
 *
 * The frame keys use their short wire spelling directly, so what is in memory is what a storage
 * layer attaches to a column. Parameter keys (`periods`, `k`, `band`) keep their natural names.
 *
 * It is a descriptor, never configuration: an indicator must not read its own metadata to compute.
 * Port of com.wualabs.qtsurfer.engine.indicators.core.IndicatorMeta
 */
export class IndicatorMeta {
  /**
   * The canonical indicator type (`bollinger`, `rsi`, ...). An explicit override: it is set only
   * where the name derived from the class would be wrong. Read it through the indicator's `getId()`,
   * which falls back to the derivation.
   */
  static readonly ID = "id";
  /** Display hint key. Values are `DisplayHint` codes (`P`, `V`, `F`, `R`, `I`, `N`); an absent entry is ABSOLUTE. */
  static readonly DISPLAY = "dsp";
  /** The indicator another one derives from. */
  static readonly SOURCE = "src";
  /** An optional label for people, distinct from the lookup name. */
  static readonly NAME = "nm";
  /** Visibility key. Its only value is `HIDDEN`; an absent entry means published. */
  static readonly VISIBILITY = "vis";
  /** Visibility value of an internal indicator: updated, but its value is not published. */
  static readonly HIDDEN = "hidden";

  /** Placement key. Its only non-default value is `OVERLAY`; an absent entry means a pane of its own. */
  static readonly PLACEMENT = "plc";
  /** Placement value of an output in the units of the price, which belongs over it. */
  static readonly OVERLAY = "o";
  /** Range key, `min:max`: the definition bounds both sides (Stochastic `0:100`). An absent entry means the scale is not fixed. */
  static readonly RANGE = "rng";
  /** Floor key: the output is never below this number, so its scale starts there. An absent entry means no floor. */
  static readonly FLOOR = "flo";
  /** Levels key, a comma list: lines that are part of the definition. Only `0` today, the zero line of the oscillators around it. */
  static readonly LEVELS = "lvl";
  /** Plot style key; values are `PlotStyle` codes. An absent entry means a line. */
  static readonly STYLE = "sty";
  /** Side key; values are `PlotSide` codes. An absent entry means no side. */
  static readonly SIDE = "sde";
  /**
   * Draw key. Its only non-default value is `NOT_DRAWN`; an absent entry means the output is drawn by default.
   * Not the same as `VISIBILITY`: a hidden indicator is not emitted at all, while an output that is not drawn is
   * registered and stored (it is on another scale, or derived from the ones that are drawn).
   */
  static readonly DRAW = "drw";
  /** Draw value of an output that is registered and stored but not drawn by default. */
  static readonly NOT_DRAWN = "0";

  /**
   * The keys of the parameters an indicator was built with, as the factories write them: each is the parameter's own
   * name, in camel case. A key has a constant here when more than one indicator writes it.
   */
  static readonly PERIODS = "periods";
  /** The single period of an indicator that takes just one. */
  static readonly PERIOD = "period";
  /** Period of the fast average of an indicator that crosses two. */
  static readonly FAST_PERIOD = "fastPeriod";
  /** Period of the slow average of an indicator that crosses two. */
  static readonly SLOW_PERIOD = "slowPeriod";
  /** Periods of the short average of the indicators that take several. */
  static readonly SHORT_PERIODS = "shortPeriods";
  /** Periods of the long average of the indicators that take several. */
  static readonly LONG_PERIODS = "longPeriods";
  /** Period of the signal line. */
  static readonly SIGNAL_PERIOD = "signalPeriod";
  /** Period of the average true range an indicator is scaled by. */
  static readonly ATR_PERIOD = "atrPeriod";
  /** Period of the exponential average an indicator smooths with. */
  static readonly EMA_PERIOD = "emaPeriod";
  /** Period of the relative strength index an indicator is built on. */
  static readonly RSI_PERIOD = "rsiPeriod";
  /** Period of the efficiency ratio an adaptive average is built on. */
  static readonly ER_PERIOD = "erPeriod";
  /** Width of a band or channel, in units of the deviation or range it is scaled by. */
  static readonly MULTIPLIER = "multiplier";
  /** Width of a band, in standard deviations. */
  static readonly K = "k";
  /** Whether a deviation or variance divides by `n - 1` (sample) rather than `n`. */
  static readonly SAMPLE = "sample";
  /** Annual risk-free rate of a ratio that excess return is measured against. */
  static readonly RISK_FREE_RATE = "riskFreeRate";
  /** Minimum acceptable return of a ratio that downside is measured against. */
  static readonly MAR = "mar";
  /** Decay of an exponentially weighted measure. */
  static readonly LAMBDA = "lambda";
  /** Confidence level of a risk measure. */
  static readonly CONFIDENCE = "confidence";
  /** Level that separates what is counted from what is not. */
  static readonly THRESHOLD = "threshold";
  /** Upper quantile of an indicator that compares two. */
  static readonly UPPER = "upper";
  /** Lower quantile of an indicator that compares two. */
  static readonly LOWER = "lower";
  /** Offset of the Gaussian window of an average that weights by it, as a fraction. */
  static readonly OFFSET_FACTOR = "offsetFactor";
  /** Width of the Gaussian window of an average that weights by it. */
  static readonly SIGMA_FACTOR = "sigmaFactor";
  /** Which edge of a band an output is (`upper`, `middle`, `lower`, or the lowercase name of the output). Descriptor of one output, not a parameter. */
  static readonly BAND = "band";
  /** Which output of a multi-output indicator a view is, by its lowercase suffix. Descriptor of one output, not a parameter. */
  static readonly OUTPUT = "output";

  /** The shared metadata of an indicator that has none. It cannot be changed. */
  static readonly EMPTY: IndicatorMeta = new IndicatorMeta(true);

  private readonly values = new Map<string, string>();

  constructor();
  constructor(frozen: true);
  constructor(private readonly frozen = false) {}

  /** Sets one entry. The value is kept in its string form: this map is the wire form. */
  set(key: string, value: unknown): this {
    this.assertWritable();
    this.values.set(key, String(value));
    return this;
  }

  get(key: string): string | undefined {
    return this.values.get(key);
  }

  isEmpty(): boolean {
    return this.values.size === 0;
  }

  /** The entries in insertion order, ready to be attached to a column. */
  asMap(): ReadonlyMap<string, string> {
    return this.values;
  }

  /** The typed `dsp` entry; absent means ABSOLUTE. */
  getDisplayHint(): DisplayHint {
    return DisplayHint.fromCode(this.values.get(IndicatorMeta.DISPLAY));
  }

  /** Sets the `dsp` entry. ABSOLUTE removes it: the default is expressed by absence. */
  setDisplayHint(displayHint: DisplayHint | null | undefined): this {
    this.assertWritable();
    const code = displayHint?.code ?? null;
    if (code == null) {
      this.values.delete(IndicatorMeta.DISPLAY);
    } else {
      this.values.set(IndicatorMeta.DISPLAY, code);
    }
    return this;
  }

  /** Whether this describes an internal indicator: updated, but not published. */
  isHidden(): boolean {
    return this.values.get(IndicatorMeta.VISIBILITY) === IndicatorMeta.HIDDEN;
  }

  /** Sets the `vis` entry. `false` removes it: published is the default. */
  setHidden(hidden: boolean): this {
    this.assertWritable();
    if (hidden) {
      this.values.set(IndicatorMeta.VISIBILITY, IndicatorMeta.HIDDEN);
    } else {
      this.values.delete(IndicatorMeta.VISIBILITY);
    }
    return this;
  }

  /** Whether the output belongs over the price (default false: a pane of its own). */
  isOverlay(): boolean {
    return this.values.get(IndicatorMeta.PLACEMENT) === IndicatorMeta.OVERLAY;
  }

  /** Sets `plc`; `false` removes the entry: the default is expressed by absence. */
  setOverlay(overlay: boolean): this {
    this.assertWritable();
    if (overlay) {
      this.values.set(IndicatorMeta.PLACEMENT, IndicatorMeta.OVERLAY);
    } else {
      this.values.delete(IndicatorMeta.PLACEMENT);
    }
    return this;
  }

  /** The fixed range of the output as `[min, max]`, or null when the entry is absent or malformed. */
  getRange(): [number, number] | null {
    const raw = this.values.get(IndicatorMeta.RANGE);
    if (raw === undefined) return null;
    const colon = raw.indexOf(":");
    if (colon < 1 || colon === raw.length - 1) return null;
    const min = parseFinite(raw.slice(0, colon));
    const max = parseFinite(raw.slice(colon + 1));
    return min !== null && max !== null && min < max ? [min, max] : null;
  }

  /** Sets `rng`. Throws for a bound that is not finite or `min >= max`. */
  setRange(min: number, max: number): this {
    this.assertWritable();
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new RangeError(`Range needs finite bounds with min < max, got: ${min}, ${max}`);
    }
    this.values.set(IndicatorMeta.RANGE, `${wireNumber(min)}:${wireNumber(max)}`);
    return this;
  }

  /** The floor of the output, or NaN when the entry is absent or malformed. */
  getFloor(): number {
    const raw = this.values.get(IndicatorMeta.FLOOR);
    return raw === undefined ? Number.NaN : (parseFinite(raw) ?? Number.NaN);
  }

  /** Sets `flo`. Throws for a floor that is not finite. */
  setFloor(floor: number): this {
    this.assertWritable();
    if (!Number.isFinite(floor)) {
      throw new RangeError(`Floor must be finite, got: ${floor}`);
    }
    this.values.set(IndicatorMeta.FLOOR, wireNumber(floor));
    return this;
  }

  /** The structural levels of the output, empty when the entry is absent. A malformed item is skipped. */
  getLevels(): number[] {
    const raw = this.values.get(IndicatorMeta.LEVELS);
    if (raw === undefined || raw === "") return [];
    const levels: number[] = [];
    for (const part of raw.split(",")) {
      const level = parseFinite(part);
      if (level !== null) levels.push(level);
    }
    return levels;
  }

  /** Sets `lvl`; no level removes the entry. Throws for a level that is not finite. */
  setLevels(...levels: number[]): this {
    this.assertWritable();
    if (levels.length === 0) {
      this.values.delete(IndicatorMeta.LEVELS);
      return this;
    }
    for (const level of levels) {
      if (!Number.isFinite(level)) {
        throw new RangeError(`Level must be finite, got: ${level}`);
      }
    }
    this.values.set(IndicatorMeta.LEVELS, levels.map(wireNumber).join(","));
    return this;
  }

  /** The typed `sty` entry; absent means a line. */
  getPlotStyle(): PlotStyle {
    return PlotStyle.fromCode(this.values.get(IndicatorMeta.STYLE));
  }

  /** Sets `sty`. LINE (or null) removes the entry: the default is expressed by absence. */
  setPlotStyle(style: PlotStyle | null | undefined): this {
    this.assertWritable();
    const code = style?.code ?? null;
    if (code === null) {
      this.values.delete(IndicatorMeta.STYLE);
    } else {
      this.values.set(IndicatorMeta.STYLE, code);
    }
    return this;
  }

  /** The typed `sde` entry; absent means no side. */
  getPlotSide(): PlotSide {
    return PlotSide.fromCode(this.values.get(IndicatorMeta.SIDE));
  }

  /** Sets `sde`. NONE (or null) removes the entry: the default is expressed by absence. */
  setPlotSide(side: PlotSide | null | undefined): this {
    this.assertWritable();
    const code = side?.code ?? null;
    if (code === null) {
      this.values.delete(IndicatorMeta.SIDE);
    } else {
      this.values.set(IndicatorMeta.SIDE, code);
    }
    return this;
  }

  /** Whether the output is drawn by default (default true). */
  isDrawnByDefault(): boolean {
    return this.values.get(IndicatorMeta.DRAW) !== IndicatorMeta.NOT_DRAWN;
  }

  /** Sets `drw`; `true` (drawn) removes the entry: the default is expressed by absence. */
  setDrawnByDefault(drawn: boolean): this {
    this.assertWritable();
    if (drawn) {
      this.values.delete(IndicatorMeta.DRAW);
    } else {
      this.values.set(IndicatorMeta.DRAW, IndicatorMeta.NOT_DRAWN);
    }
    return this;
  }

  toString(): string {
    return `{${[...this.values].map(([key, value]) => `${key}=${value}`).join(", ")}}`;
  }

  /**
   * The id a class name implies: without the `RTIndicator` suffix and with the first letter in
   * lower case, so `RsiRTIndicator` is `rsi`. It reads the class name, so a build that renames
   * classes should set `IndicatorMeta.ID` explicitly.
   */
  static deriveId(type: { name: string }): string {
    let name = type.name;
    if (name.endsWith(RT_INDICATOR_SUFFIX)) {
      name = name.slice(0, -RT_INDICATOR_SUFFIX.length);
    }
    return name === "" ? name : name.charAt(0).toLowerCase() + name.slice(1);
  }

  private assertWritable(): void {
    if (this.frozen) {
      throw new Error("IndicatorMeta.EMPTY cannot be changed");
    }
  }
}
