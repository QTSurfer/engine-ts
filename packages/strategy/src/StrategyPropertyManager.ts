import { ConvertHelper } from "./ConvertHelper";
import { isReservedPropertyKey } from "./ReservedPropertyKeys";
import { StrategyPropertyDef, type StrategyPropertyInit } from "./StrategyPropertyDef";

/**
 * How a property's value reaches the strategy and is read back, in place of its field. `get` is
 * optional: a value with no getter is read from what was last applied.
 */
export interface PropertyAccessors {
  get?: () => unknown;
  set: (value: unknown) => void;
}

interface Registered {
  def: StrategyPropertyDef;
  accessors: PropertyAccessors | undefined;
}

/**
 * A strategy's property registry and values: registration, defaults and injection.
 * Port of com.wualabs.qtsurfer.engine.strategy.StrategyPropertyManager, minus the notices.
 */
export class StrategyPropertyManager {
  private readonly registered = new Map<string, Registered>();
  private readonly values = new Map<string, unknown>();
  // Defaults wait for the strategy's first use: a leaf class defines its fields after the base
  // constructor returns, so a default written earlier would be overwritten by them.
  private pending: StrategyPropertyDef[] = [];

  constructor(private readonly host: object) {}

  /**
   * Registers one property.
   *
   * @throws Error if the name is registered already or is a reserved engine key
   */
  register(property: StrategyPropertyDef | StrategyPropertyInit, accessors?: PropertyAccessors): StrategyPropertyDef {
    const def = property instanceof StrategyPropertyDef ? property : new StrategyPropertyDef(property);
    if (this.registered.has(def.name) || isReservedPropertyKey(def.name)) {
      throw new Error(`Already registered property info with name ${def.name}`);
    }
    this.registered.set(def.name, { def, accessors });
    if (def.defaultValue !== undefined) this.pending.push(def);
    return def;
  }

  /**
   * Registers properties bound to the fields of the strategy, as Java's scan of `@StrategyProperty`
   * does. A name already registered or reserved is skipped, and the engine's property wins.
   *
   * @return the names that were skipped
   */
  declare(properties: readonly (StrategyPropertyDef | StrategyPropertyInit)[]): string[] {
    const skipped: string[] = [];
    for (const property of properties) {
      const def = property instanceof StrategyPropertyDef ? property : new StrategyPropertyDef(property);
      if (this.registered.has(def.name) || isReservedPropertyKey(def.name)) {
        skipped.push(def.name);
      } else {
        this.register(def);
      }
    }
    return skipped;
  }

  defs(): StrategyPropertyDef[] {
    return [...this.registered.values()].map(({ def }) => def);
  }

  def(name: string): StrategyPropertyDef | undefined {
    return this.registered.get(name)?.def;
  }

  /**
   * Applies every default that has not been applied yet, once the strategy is in use. A property
   * that already holds a value is left alone; a default that cannot be written is skipped.
   */
  ensureDefaultsApplied(): void {
    if (this.pending.length === 0) return;
    const pending = this.pending;
    this.pending = [];
    for (const def of pending) {
      if (this.values.has(def.name)) continue;
      const raw = String(def.defaultValue);
      if (!def.reflected) {
        this.values.set(def.name, raw);
        continue;
      }
      const converted = ConvertHelper.convert(raw, def.type);
      if (converted === undefined) continue;
      try {
        this.write(this.registered.get(def.name)!, converted);
        this.values.set(def.name, converted);
      } catch {
        // the field keeps what the class gave it
      }
    }
  }

  /**
   * Sets a property: for a registered one, converts the value to its type and writes it to the
   * strategy; any other name only lands in the property map, where nothing reads it.
   *
   * @return whether the value reached a property. `false` for an unknown name, and for a value
   *   that does not convert to the declared type, which changes nothing
   * @throws TypeError if the key or the value is null
   * @throws Error if the setter or the field rejects the value
   */
  apply(key: string, value: unknown): boolean {
    if (key == null) throw new TypeError("key must not be null");
    if (value == null) throw new TypeError("value must not be null");
    this.ensureDefaultsApplied();
    const entry = this.registered.get(key);
    if (entry === undefined) {
      this.values.set(key, value);
      return false;
    }
    if (!entry.def.reflected) {
      this.values.set(key, value);
      return true;
    }
    const converted = ConvertHelper.convert(value, entry.def.type);
    if (converted === undefined) return false;
    try {
      this.write(entry, converted);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Failed to apply property '${key}' = ${String(value)}: ${reason}`, { cause });
    }
    this.values.set(key, converted);
    return true;
  }

  has(key: string): boolean {
    this.ensureDefaultsApplied();
    return this.values.has(key);
  }

  /** What the strategy holds for the property now, or the value last applied when it has no way to say. */
  get<T>(key: string): T | undefined {
    this.ensureDefaultsApplied();
    const entry = this.registered.get(key);
    if (entry !== undefined && entry.def.reflected) {
      const live = this.read(entry);
      if (live !== undefined) return live as T;
    }
    return this.values.get(key) as T | undefined;
  }

  private write({ def, accessors }: Registered, value: unknown): void {
    if (accessors !== undefined) {
      accessors.set(value);
      return;
    }
    // The setter when the strategy has one, as it may validate or derive; else the field itself.
    // A field is not checked for: a class field that is only declared is not emitted by every
    // compile target, so its absence says nothing.
    const host = this.host as Record<string, unknown>;
    const setter = host[setterName(def.field)];
    if (typeof setter === "function") {
      setter.call(this.host, value);
    } else {
      host[def.field] = value;
    }
  }

  private read({ def, accessors }: Registered): unknown {
    if (accessors !== undefined) return accessors.get?.();
    const field = (this.host as Record<string, unknown>)[def.field];
    return typeof field === "function" ? undefined : field;
  }
}

/** The method a field is set through when the strategy has one: `emaFast` is `setEmaFast`. */
export function setterName(field: string): string {
  return `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}
