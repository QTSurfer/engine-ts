import type { Asset } from "@qtsurfer/core";
import { EngineVersion } from "./EngineVersion";
import type { Strategy } from "./Strategy";
import { StrategyCurrencyFilter } from "./StrategyCurrencyFilter";
import type { StrategyPropertyDef, StrategyPropertyInit } from "./StrategyPropertyDef";
import { StrategyPropertyManager, type PropertyAccessors } from "./StrategyPropertyManager";
import { StrategyStats } from "./StrategyStats";
import { ExecutionMode } from "$execution/ExecutionMode";
import type { StrategySignal } from "$signal/StrategySignal";
import type { StrategyYield } from "$yield/StrategyYield";

/**
 * Listener types for signal/yield emission.
 */
export type SignalListener = (signal: StrategySignal) => void;
export type YieldListener = (yieldEvent: StrategyYield) => void;

/**
 * Base strategy class with listener-based signal/yield emission.
 * Port of com.wualabs.qtsurfer.engine.strategy.AbstractStrategy
 */
export abstract class AbstractStrategy implements Strategy {
  name: string;
  id: string | undefined;
  enabled = true;
  readonly stats: StrategyStats;
  readonly instruments = new Set<string>();

  protected inputCurrency: Asset | undefined;
  protected outputCurrency: Asset | undefined;

  private currencyFilter = new StrategyCurrencyFilter();
  private executionMode = ExecutionMode.LONG;
  private percentGain = 0;
  private minPercentGainMultiplier = 0;
  private minGain = 0;
  private readonly propertyManager = new StrategyPropertyManager(this);
  private readonly signalListeners: SignalListener[] = [];
  private readonly yieldListeners: YieldListener[] = [];

  protected constructor(name?: string) {
    this.name = name ?? this.constructor.name;
    this.stats = new StrategyStats();
  }

  getExecutionMode(_instrument: string): ExecutionMode {
    return this.executionMode;
  }

  setExecutionMode(mode: ExecutionMode): void {
    if (mode == null) throw new TypeError("executionMode must not be null");
    this.executionMode = mode;
  }

  /** Maps the legacy `multiEntryEnabled` setting to `LONG_MULTI` or `LONG`. */
  setMultiEntryEnabled(multiEntryEnabled: boolean): void {
    this.setExecutionMode(multiEntryEnabled ? ExecutionMode.LONG_MULTI : ExecutionMode.LONG);
  }

  getInputCurrency(): Asset | undefined {
    return this.inputCurrency;
  }

  getOutputCurrency(): Asset | undefined {
    return this.outputCurrency;
  }

  getCurrencyFilter(): StrategyCurrencyFilter {
    return this.currencyFilter;
  }

  setCurrencyFilter(currencyFilter: StrategyCurrencyFilter): void {
    if (currencyFilter == null) throw new TypeError("currencyFilter must not be null");
    this.currencyFilter = currencyFilter;
  }

  setWhitelistedCurrencies(currencyCodes: readonly string[]): void {
    this.currencyFilter.setWhitelistedCurrencies(currencyCodes);
  }

  setBlacklistedCurrencies(currencyCodes: readonly string[]): void {
    this.currencyFilter.setBlacklistedCurrencies(currencyCodes);
  }

  /**
   * Sets the minimum percent gain threshold and precomputes the multiplier a strategy reads to
   * decide whether a trade meets it.
   *
   * @param percent the minimum gain percentage, from 0 to 100
   * @throws Error if `percent` is outside 0-100 or is NaN
   */
  setPercentGain(percent: number): void {
    if (!(percent >= 0 && percent <= 100)) {
      throw new Error(`percentGain must be between 0 and 100: ${percent}`);
    }
    this.percentGain = percent;
    this.minPercentGainMultiplier = percentToMultiplier(percent);
  }

  getPercentGain(): number {
    return this.percentGain;
  }

  /**
   * @throws Error if `minGain` is negative or NaN
   */
  setMinGain(minGain: number): void {
    if (!(minGain >= 0)) {
      throw new Error(`minGain must not be negative: ${minGain}`);
    }
    this.minGain = minGain;
  }

  getMinGain(): number {
    return this.minGain;
  }

  /**
   * Sets a property. For a registered one this is Java's `applyProperty`: the value is converted to
   * the declared type and reaches the strategy's field. Java's own `setProperty` only writes the
   * property map, which is exactly what a run ignores, so there is no map-only call here.
   * A name nobody registered lands in the map and nothing reads it.
   *
   * @return whether the value reached a registered property; `false` for an unknown name and for a
   *   value that does not convert to the declared type, which is not applied
   * @throws TypeError if the key or the value is null
   * @throws Error if the strategy's setter or field rejects the value
   */
  setProperty(key: string, value: unknown): boolean {
    return this.applyProperty(key, value);
  }

  /** Java's name for `setProperty`: the call a parameter sweep injects a vector through. */
  applyProperty(key: string, value: unknown): boolean {
    return this.propertyManager.apply(key, value);
  }

  /** Whether the property holds a value, set or defaulted. */
  hasProperty(key: string): boolean {
    return this.propertyManager.has(key);
  }

  /** The property's value: what the strategy holds for a registered one, else what was set. */
  getProperty<T>(key: string): T | undefined {
    return this.propertyManager.get<T>(key);
  }

  /** The registered properties, in the order they were registered. */
  getPropertyDefs(): readonly StrategyPropertyDef[] {
    return this.propertyManager.defs();
  }

  getPropertyDef(name: string): StrategyPropertyDef | undefined {
    return this.propertyManager.def(name);
  }

  /**
   * Writes the defaults of the properties not set yet. Run by every call that reads or sets a
   * property and by `updateInstrument`, so a strategy in use has them; construction cannot, as the
   * fields of a subclass are defined after this class's constructor returns. Safe to repeat.
   */
  ensureDefaultsApplied(): void {
    this.propertyManager.ensureDefaultsApplied();
  }

  /**
   * Registers a property, the way Java's `registerPropertyInfo` does. The value reaches the
   * strategy through `accessors` or, without them, through the setter named `set<Field>` if the
   * strategy has one, else the field `def.field`.
   *
   * @throws Error if the name is registered already or is a reserved engine key
   */
  protected registerProperty(
    def: StrategyPropertyDef | StrategyPropertyInit,
    accessors?: PropertyAccessors,
  ): StrategyPropertyDef {
    return this.propertyManager.register(def, accessors);
  }

  /**
   * Declares the properties of a class, in place of Java's `@StrategyProperty` annotations and the
   * scan that reads them: call it from the constructor, after `super()`, with one entry for each
   * field that takes a value. A name registered or reserved already is skipped and returned.
   *
   * ```ts
   * class MyStrategy extends AbstractTickerStrategy {
   *   emaFast!: number;
   *   constructor() {
   *     super("MyStrategy");
   *     this.declareProperties([
   *       { name: "ema.fast", description: "Fast EMA", type: "int", defaultValue: 9, field: "emaFast" },
   *     ]);
   *   }
   * }
   * ```
   */
  protected declareProperties(properties: readonly (StrategyPropertyDef | StrategyPropertyInit)[]): string[] {
    return this.propertyManager.declare(properties);
  }

  reset(_instrument: string): void {}

  /** The engine version this strategy runs on (e.g. `"0.11.0"`), or `"unknown"`. */
  protected getEngineVersion(): string {
    return EngineVersion.get();
  }

  /** The major component of `getEngineVersion()`, or `-1` if it cannot be parsed. */
  protected getEngineVersionMajor(): number {
    return EngineVersion.getMajor();
  }

  /** The minor component of `getEngineVersion()`, or `-1` if it cannot be parsed. */
  protected getEngineVersionMinor(): number {
    return EngineVersion.getMinor();
  }

  /** `percentGain` as a decimal fraction: `0.5` percent is `0.005`. */
  protected getMinPercentGainMultiplier(): number {
    return this.minPercentGainMultiplier;
  }

  protected acceptCurrency(asset: Asset): boolean {
    return this.currencyFilter.accept(asset);
  }

  // --- Signal/Yield emission ---

  onSignal(listener: SignalListener): () => void {
    this.signalListeners.push(listener);
    return () => {
      const idx = this.signalListeners.indexOf(listener);
      if (idx >= 0) this.signalListeners.splice(idx, 1);
    };
  }

  onYield(listener: YieldListener): () => void {
    this.yieldListeners.push(listener);
    return () => {
      const idx = this.yieldListeners.indexOf(listener);
      if (idx >= 0) this.yieldListeners.splice(idx, 1);
    };
  }

  protected emitSignal(signal: StrategySignal): void {
    for (const listener of this.signalListeners) {
      listener(signal);
    }
  }

  protected emitYield(yieldEvent: StrategyYield): void {
    for (const listener of this.yieldListeners) {
      listener(yieldEvent);
    }
  }

  /**
   * The time a yield of this strategy carries: `fallback` here; a subscription strategy in a
   * backtest stamps it with the time of the last market event it saw, as the Java engine's
   * `emitYield` does.
   */
  yieldTimestamp(fallback: number): number {
    return fallback;
  }
}

/** A decimal-point shift, not a division: `0.7` percent is exactly `0.007`, not `0.006999...`. */
function percentToMultiplier(percent: number): number {
  const [mantissa, exponent] = percent.toExponential().split("e") as [string, string];
  return Number(`${mantissa}e${Number(exponent) - 2}`);
}
