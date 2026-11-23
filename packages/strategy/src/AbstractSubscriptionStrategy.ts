import { Asset, Instrument, StateStore } from "@qtsurfer/core";
import type { RTIndicator } from "@qtsurfer/indicators";
import {
  InstrumentGroupRTIndicator,
  type InstrumentMapRTIndicator,
} from "@qtsurfer/indicators";
import { AbstractStrategy } from "./AbstractStrategy";
import { AbstractStrategyEvent } from "$event/AbstractStrategyEvent";
import { BuySignal } from "$signal/BuySignal";
import { SellSignal } from "$signal/SellSignal";
import { InfoStrategySignal } from "$signal/InfoStrategySignal";
import { SystemSignal } from "$signal/SystemSignal";
import type { StrategyContext } from "./StrategyContext";
import type { StrategySignal } from "$signal/StrategySignal";

/**
 * Base class for subscription-based strategies with RT indicator group support.
 * Port of com.wualabs.qtsurfer.engine.strategy.AbstractSubscriptionStrategy
 */
export abstract class AbstractSubscriptionStrategy<T> extends AbstractStrategy {
  lastEventTimestamp = 0;
  enableIndicatorsSignals = false;
  backtestEnabled = false;

  private readonly instrumentIndicatorGroups = new Map<
    string,
    InstrumentGroupRTIndicator
  >();
  private readonly instrumentStateStores = new Map<string, StateStore>();
  private globalStateStore: StateStore | null = null;
  private readonly parsedInstruments = new Map<string, Instrument>();

  protected constructor(name?: string) {
    super(name);
  }

  override reset(instrument: string): void {
    this.instrumentIndicatorGroups.delete(instrument);
  }

  isEnableIndicatorsSignals(): boolean {
    return this.enableIndicatorsSignals;
  }

  setEnableIndicatorsSignals(enableIndicatorsSignals: boolean): void {
    this.enableIndicatorsSignals = enableIndicatorsSignals;
  }

  /**
   * Whether this strategy takes an instrument. The default accepts the instruments whose quote is
   * the output currency (every quote while none is set) and whose base the currency filter lets
   * through; override it to choose instruments some other way.
   */
  acceptInstrument(instrument: Instrument): boolean {
    const outputCurrency = this.getOutputCurrency();
    if (outputCurrency !== undefined && instrument.quote() !== outputCurrency.code) {
      return false;
    }
    return this.acceptCurrency(new Asset(instrument.base()));
  }

  createInfoStrategySignal(instrument: string): InfoStrategySignal {
    return new InfoStrategySignal(this.name, instrument);
  }

  fillSignal(
    indicators: InstrumentMapRTIndicator,
    signal: InfoStrategySignal,
  ): void {
    indicators.forEachPublicable((key, indicator) => {
      signal.set(key, indicator.getValue());
    });
  }

  // --- Instrument tracking ---

  protected updateInstrument(instrument: string, timestamp: number): void {
    // Before the indicators are built: they read the properties
    this.ensureDefaultsApplied();
    if (this.backtestEnabled) {
      this.lastEventTimestamp = timestamp;
    }
    this.instruments.add(instrument);
    this.stats.instrumentUpdate();
  }

  protected updateIndicators(instrument: string, source: T): InstrumentMapRTIndicator {
    const group = this.getInstrumentIndicatorGroup(instrument);
    const indicatorSource = group.indicators;
    // A backtest runs on the data's own time: the windows read it from each data point
    indicatorSource.setBacktestEnabled(this.backtestEnabled);
    if (isUpdateable(indicatorSource)) {
      (indicatorSource as unknown as { updateFrom(s: T): void }).updateFrom(source);
    }
    return indicatorSource;
  }

  protected getUpdatedSignal(indicators: InstrumentMapRTIndicator): InfoStrategySignal {
    const signal = this.createInfoStrategySignal(indicators.instrument);
    this.fillSignal(indicators, signal);
    signal.indicatorSnapshot = true;
    return signal;
  }

  // --- Signal emission with backtest timestamp override ---

  protected override emitSignal(signal: StrategySignal): void {
    this.overrideTimestamp(signal);
    super.emitSignal(signal);
  }

  // --- Signal sugar ---

  protected createBuySignal(instrument: string, price: number): BuySignal {
    return new BuySignal(this.name, instrument, price);
  }

  protected createSellSignal(instrument: string, price: number): SellSignal {
    return new SellSignal(this.name, instrument, price);
  }

  protected emitBuy(instrument: string, price: number): void {
    this.emitSignal(this.createBuySignal(instrument, price));
  }

  protected emitSell(instrument: string, price: number): void {
    this.emitSignal(this.createSellSignal(instrument, price));
  }

  protected emitInfo(instrument: string, key?: string, ...values: unknown[]): void {
    const signal = new InfoStrategySignal(this.name, instrument);
    if (key !== undefined) signal.set(key, ...values);
    this.emitSignal(signal);
  }

  // --- Detach ---

  private sourceDetaching = false;

  /**
   * Called by the host around `onDetach`: while it is set, `detach(...)` emits nothing, because
   * the source it could ask to detach is already going. A strategy may call `detach(...)` from
   * `onDetach`; the call is allowed and does nothing.
   */
  setSourceDetaching(detaching: boolean): void {
    this.sourceDetaching = detaching;
  }

  /**
   * Asks the platform to detach a source, with a system signal whose action is `DETACH`. The
   * platform applies it at the next event of its stream, so the strategy goes on receiving events
   * of that source until then. A host that has no sources to detach (a backtest of one source ends
   * with it) does what its own contract says.
   *
   * - `detach(instrument)`: the source that reads this instrument.
   * - `detach(context)`, for use from `onAttach` and `onDetach`: the attachment the context
   *   describes. The signal names the attachment by its id, so a source that reads several
   *   instruments is still the one detached, and it is about the first instrument of the context.
   *   A live attachment is made with an instrument, so the platform always passes at least one;
   *   only a context built with none (a backtest of a strategy that finds its instruments in the
   *   data) falls back to the exchange and the segment, as an instrument, because a signal has to
   *   be about one.
   */
  protected detach(target: string | StrategyContext): void {
    if (this.sourceDetaching) {
      return;
    }
    if (typeof target === "string") {
      this.emitSignal(SystemSignal.detach(this.name, target));
      return;
    }
    const about =
      target.getInstrumentCount() > 0
        ? target.getInstrument(0)
        : Instrument.of(target.getExchange(), target.getSegment()).symbol();
    this.emitSignal(SystemSignal.detach(this.name, about).attachment(target.getId()));
  }

  // Crossover detection is a standalone helper, not a method here: see CrossDetector. The old
  // detectCrossAbove/detectCrossBelow pair shared one (state, index) slot, so calling both with the
  // same index made the first clobber the value the second needed — silently breaking whichever
  // direction ran second. CrossDetector reports both directions from one read-then-write.

  // --- State store ---

  getStateStore(instrument: string): StateStore {
    let store = this.instrumentStateStores.get(instrument);
    if (!store) {
      store = new StateStore();
      this.instrumentStateStores.set(instrument, store);
    }
    return store;
  }

  /**
   * The strategy's global store: state that belongs to the strategy as a whole, not to one
   * instrument. Created on first use and the same object on every call. It is a namespace of its
   * own: a key written here is never seen through an instrument's store, nor the other way round.
   */
  getGlobalStateStore(): StateStore {
    return (this.globalStateStore ??= new StateStore());
  }

  protected getRTIndicator(
    instrument: string,
    key: string,
  ): RTIndicator | undefined {
    return this.getInstrumentIndicatorGroup(instrument).indicators.get(key);
  }

  protected clearIndicators(): void {
    this.instrumentIndicatorGroups.clear();
  }

  /** The indicator group an instrument already has, without building one: `undefined` before its first update. */
  findInstrumentIndicatorGroup(
    instrument: string,
  ): InstrumentGroupRTIndicator | undefined {
    return this.instrumentIndicatorGroups.get(instrument);
  }

  getInstrumentIndicatorGroup(
    instrument: string,
  ): InstrumentGroupRTIndicator {
    let group = this.instrumentIndicatorGroups.get(instrument);
    if (!group) {
      group = this.setupInstrumentGroupRTIndicator(instrument);
      this.instrumentIndicatorGroups.set(instrument, group);
    }
    return group;
  }

  protected setupInstrumentGroupRTIndicator(
    instrument: string,
  ): InstrumentGroupRTIndicator {
    const group = this.createInstrumentGroupRTIndicator(instrument);
    // The windows of one instrument share the strategy's store for it
    group.setStateStoreSupplier(() => this.getStateStore(instrument));
    this.setupIndicators(group);
    return group;
  }

  protected setupIndicators(
    _indicators: InstrumentGroupRTIndicator,
  ): void {}

  protected createInstrumentGroupRTIndicator(
    instrument: string,
  ): InstrumentGroupRTIndicator {
    return new InstrumentGroupRTIndicator(instrument);
  }

  /** Whether a data point is for an instrument this strategy takes: see `acceptInstrument`. */
  abstract accept(source: T): boolean;

  /**
   * An instrument symbol as an `Instrument`, parsed once per symbol.
   *
   * @throws Error if the symbol is not in `BASE/QUOTE` form
   */
  protected parseInstrument(symbol: string): Instrument {
    let instrument = this.parsedInstruments.get(symbol);
    if (instrument === undefined) {
      instrument = Instrument.parse(symbol);
      this.parsedInstruments.set(symbol, instrument);
    }
    return instrument;
  }

  protected abstract update(source: T): void;

  /**
   * In a backtest, the time of the last market event this strategy saw. The pipeline resolves a
   * resting order before the strategy sees the point it resolves on, so a yield it closes carries
   * the previous point's time, as in the Java engine.
   */
  override yieldTimestamp(fallback: number): number {
    return this.backtestEnabled ? this.lastEventTimestamp : fallback;
  }

  private overrideTimestamp(signal: StrategySignal): void {
    if (this.backtestEnabled && signal instanceof AbstractStrategyEvent) {
      signal.timestamp = this.lastEventTimestamp;
    }
  }
}

function isUpdateable(obj: unknown): boolean {
  return typeof (obj as { updateFrom?: unknown }).updateFrom === "function";
}
