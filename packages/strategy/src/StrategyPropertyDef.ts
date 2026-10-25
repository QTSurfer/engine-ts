import type { PropertyHints } from "$execution/sweep/PropertyHints";
import { ConvertHelper } from "./ConvertHelper";

/**
 * The types a property converts its value to. `duration` is a length of time in milliseconds and
 * converts like `long`, as the Java code generator declares it.
 */
export const STRATEGY_PROPERTY_TYPES = ["int", "long", "double", "boolean", "String", "duration"] as const;

export type StrategyPropertyType = (typeof STRATEGY_PROPERTY_TYPES)[number];

/** What a property is declared with: the attributes of Java's `@StrategyProperty` and its field. */
export interface StrategyPropertyInit {
  /** The config key. */
  name: string;
  type: StrategyPropertyType;
  /** Human-readable label. */
  description?: string;
  /**
   * The value before anyone sets one, applied at the strategy's first use. It is converted to
   * `type` through its text, as the Java annotation's string `defaultValue` is.
   */
  defaultValue?: string | number | boolean;
  /**
   * `true` (the default): set through the strategy's setter or field. `false`: the value stays in
   * the property map as given, with no conversion and no write to the field.
   */
  reflected?: boolean;
  /** The strategy field that receives the value (Java's bean property). Defaults to `name`. */
  field?: string;
  /** Advisory range hints for sweeps and editors; they never validate a value. */
  min?: number;
  max?: number;
  step?: number;
}

/**
 * A strategy property's definition: what an editor lists, and how a value reaches the strategy.
 * Port of com.wualabs.qtsurfer.engine.strategy.StrategyPropertyDef. Its `min`, `max` and `step` are
 * the sweep `PropertyHints`, so a definition can be handed to `ParamAxis.fromHints` as it is.
 */
export class StrategyPropertyDef implements PropertyHints {
  readonly name: string;
  readonly description: string;
  readonly type: StrategyPropertyType;
  readonly defaultValue: string | number | boolean | undefined;
  readonly reflected: boolean;
  readonly field: string;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly step: number | undefined;

  /**
   * @throws Error if the type is unknown, or the default of a reflected property does not convert
   *   to it (Java finds that out at run time and carries on; here it fails where it is declared)
   */
  constructor(init: StrategyPropertyInit) {
    if (typeof init.name !== "string" || init.name === "") {
      throw new TypeError("property name must not be empty");
    }
    if (!STRATEGY_PROPERTY_TYPES.includes(init.type)) {
      throw new Error(`Property "${init.name}" has an unknown type "${String(init.type)}"`);
    }
    this.name = init.name;
    this.description = init.description ?? "";
    this.type = init.type;
    this.defaultValue = init.defaultValue;
    this.reflected = init.reflected ?? true;
    this.field = init.field ?? init.name;
    this.min = init.min;
    this.max = init.max;
    this.step = init.step;
    if (this.reflected && this.defaultValue !== undefined) {
      if (ConvertHelper.convert(String(this.defaultValue), this.type) === undefined) {
        throw new Error(
          `Property "${this.name}" default "${String(this.defaultValue)}" is not parseable as declared type "${this.type}"`,
        );
      }
    }
    Object.freeze(this);
  }

  toString(): string {
    return this.name;
  }
}
