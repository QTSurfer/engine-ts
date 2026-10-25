import { DisplayHint } from "./DisplayHint";

const RT_INDICATOR_SUFFIX = "RTIndicator";

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
  /** Display hint key. Values are `DisplayHint` codes (`P`, `V`); an absent entry is ABSOLUTE. */
  static readonly DISPLAY = "dsp";
  /** The indicator another one derives from. */
  static readonly SOURCE = "src";
  /** An optional label for people, distinct from the lookup name. */
  static readonly NAME = "nm";
  /** Visibility key. Its only value is `HIDDEN`; an absent entry means published. */
  static readonly VISIBILITY = "vis";
  /** Visibility value of an internal indicator: updated, but its value is not published. */
  static readonly HIDDEN = "hidden";

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
