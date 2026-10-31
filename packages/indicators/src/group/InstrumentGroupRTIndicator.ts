import { AbstractRTIndicator } from "$core/AbstractRTIndicator";
import { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import type { RTIndicator } from "$core/RTIndicator";
import { StateStore, TickerValueSource, predicates } from "@qtsurfer/core";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { WmaIncrementalRTIndicator } from "$averages/WmaIncrementalRTIndicator";
import { TemaRTIndicator } from "$averages/TemaRTIndicator";
import { HmaRTIndicator } from "$averages/HmaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { KamaRTIndicator } from "$averages/KamaRTIndicator";
import { AtrRTIndicator } from "$indicators/AtrRTIndicator";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";
import { VarianceRTIndicator } from "$statistics/VarianceRTIndicator";
import { VolatilityRTIndicator } from "$helpers/VolatilityRTIndicator";
import { PercentVolatilityRTIndicator } from "$helpers/PercentVolatilityRTIndicator";
import { BollingerPercentBRTIndicator } from "$bollinger/BollingerPercentBRTIndicator";
import type { IndicatorNotice } from "$core/IndicatorNotice";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { MacdRTIndicator } from "$indicators/MacdRTIndicator";
import { CciRTIndicator } from "$indicators/CciRTIndicator";
import { StochasticRsiRTIndicator } from "$indicators/StochasticRsiRTIndicator";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import { BollingerBandWidthRTIndicator } from "$bollinger/BollingerBandWidthRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { RoundRTIndicator } from "$numeric/RoundRTIndicator";
import { TransformRTIndicator } from "$numeric/TransformRTIndicator";
import { BiFunctionRTIndicator } from "$numeric/BiFunctionRTIndicator";
import { ClampRTIndicator } from "$numeric/ClampRTIndicator";
import { ClampPredicateRTIndicator } from "$numeric/ClampPredicateRTIndicator";
import { ConditionalRTIndicator } from "$numeric/ConditionalRTIndicator";
import { PredicateRTIndicator } from "$numeric/PredicateRTIndicator";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { MaxRTIndicator } from "$helpers/MaxRTIndicator";
import { MinRTIndicator } from "$helpers/MinRTIndicator";
import { PredicatePeriodCounterRTIndicator } from "$helpers/PredicatePeriodCounterRTIndicator";
import { SumRTIndicator } from "$numeric/SumRTIndicator";
import { DistanceRTIndicator } from "$indicators/DistanceRTIndicator";
import { DistanceFromMaRTIndicator } from "$indicators/DistanceFromMaRTIndicator";
import { RateChangeRTIndicator } from "$helpers/RateChangeRTIndicator";
import { InstrumentMapRTIndicator } from "./InstrumentMapRTIndicator";
import { InstrumentMapTickerSourceRTIndicator } from "./InstrumentMapTickerSourceRTIndicator";
import { InstrumentMapKlineSourceRTIndicator } from "./InstrumentMapKlineSourceRTIndicator";
import { TickerRTIndicator } from "./TickerRTIndicator";
import { KlineRTIndicator } from "./KlineRTIndicator";
import { KlineValueSource } from "@qtsurfer/core";
import type { WindowTimeRTIndicator, WindowPeriod } from "$helpers/WindowTimeRTIndicator";
import type { OnChangeListener } from "$helpers/OnChangeRTIndicator";
import { WindowTimeRTIndicatorBuilder } from "./WindowTimeRTIndicatorBuilder";

/**
 * Groups an instrument indicator map with a builder interface.
 * Port of com.wualabs.qtsurfer.engine.indicators.helpers.group.InstrumentGroupRTIndicator
 */
export class InstrumentGroupRTIndicator extends AbstractRTIndicator {
  static readonly PREFIX_HIDDEN = "_";
  static readonly RTINDICATOR_PRICE = "price";
  static readonly PREFIX_SMA = "sma";
  static readonly PREFIX_EMA = "ema";
  static readonly PREFIX_RSI = "rsi";
  static readonly PREFIX_MACD = "macd";
  static readonly PREFIX_CCI = "cci";
  static readonly PREFIX_STOCH_RSI = "stochRsi";
  static readonly PREFIX_BOLLINGER = "blgr";
  static readonly PREFIX_ATR = "atr";
  static readonly PREFIX_WMA = "wma";
  static readonly PREFIX_TEMA = "tema";
  static readonly PREFIX_HMA = "hma";
  static readonly PREFIX_MMA = "mma";
  static readonly PREFIX_KAMA = "kama";
  static readonly PREFIX_STD_DEV = "stdDev";
  static readonly PREFIX_VARIANCE = "variance";
  static readonly PREFIX_VOLATILITY = "vol";
  static readonly PREFIX_PERCENT_VOLATILITY = "pvol";
  static readonly PREFIX_PERCENT_B = "pctB";
  static readonly PREFIX_GAIN = "_gain";
  static readonly PREFIX_LOSS = "_loss";
  static readonly PREFIX_WINDOW = "_win";
  static readonly PREFIX_DIST = "dist";
  static readonly PREFIX_SUM = "sum";
  static readonly PREFIX_MAX = "max";
  static readonly PREFIX_MIN = "min";
  static readonly PREFIX_ADD = "add";
  static readonly PREFIX_DIFF = "diff";
  static readonly PREFIX_MUL = "mul";
  static readonly PREFIX_RATE_CHANGE = "chg";
  static readonly PREFIX_CLAMP = "clmp";
  static readonly PREFIX_ROUND = "round";
  static readonly SUBFIX_BOLLINGER_UPPER = "Upper";
  static readonly SUBFIX_BOLLINGER_LOWER = "Lower";
  /** Name suffix of a bandwidth entry: the key of the band it derives from, plus this. */
  static readonly SUBFIX_BANDWIDTH = "BW";

  readonly instrument: string;
  readonly indicators: InstrumentMapRTIndicator;
  private windowCount = 0;
  private stateStore: StateStore | null = null;
  private stateStoreSupplier: (() => StateStore) | null = null;

  constructor(instrument: string);
  constructor(indicators: InstrumentMapRTIndicator);
  constructor(instrumentOrIndicators: string | InstrumentMapRTIndicator) {
    super();
    if (typeof instrumentOrIndicators === "string") {
      this.indicators = new InstrumentMapTickerSourceRTIndicator(instrumentOrIndicators);
      this.instrument = instrumentOrIndicators;
    } else {
      this.indicators = instrumentOrIndicators;
      this.instrument = instrumentOrIndicators.instrument;
    }
  }

  addPrice(): this {
    return this.add(InstrumentGroupRTIndicator.RTINDICATOR_PRICE, new ValueRTIndicator());
  }

  sma(periods: number): this;
  sma(name: string, periods: number): this;
  sma(name: string, periods: number, discreteMode: boolean): this;
  sma(name: string, indicator: string, periods: number): this;
  sma(
    nameOrPeriods: string | number,
    periodsOrIndicator?: number | string,
    discreteModeOrPeriods?: boolean | number,
  ): this {
    if (typeof nameOrPeriods === "number") {
      return this.sma(InstrumentGroupRTIndicator.PREFIX_SMA + nameOrPeriods, nameOrPeriods);
    }
    if (typeof periodsOrIndicator === "string") {
      const periods = discreteModeOrPeriods as number;
      return this.add(
        nameOrPeriods,
        new SmaRTIndicator(periods, this.indicators.getReadOnlyExisting(periodsOrIndicator))
          .withMeta("periods", periods)
          .withMeta(IndicatorMeta.SOURCE, periodsOrIndicator),
      );
    }
    const discreteMode = (discreteModeOrPeriods as boolean | undefined) ?? true;
    return this.add(
      nameOrPeriods,
      new SmaRTIndicator(periodsOrIndicator!).withDiscreteMode(discreteMode).withMeta("periods", periodsOrIndicator),
    );
  }

  ema(periods: number): this;
  ema(name: string, periods: number): this;
  ema(name: string, indicator: string, periods: number): this;
  ema(nameOrPeriods: string | number, periodsOrIndicator?: number | string, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.ema(InstrumentGroupRTIndicator.PREFIX_EMA + nameOrPeriods, nameOrPeriods);
    }
    if (typeof periodsOrIndicator === "string") {
      return this.add(
        nameOrPeriods,
        new EmaRTIndicator(periods!, this.indicators.getReadOnlyExisting(periodsOrIndicator))
          .withMeta("periods", periods)
          .withMeta(IndicatorMeta.SOURCE, periodsOrIndicator),
      );
    }
    return this.add(nameOrPeriods, new EmaRTIndicator(periodsOrIndicator!).withMeta("periods", periodsOrIndicator));
  }

  rsi(periods: number): this;
  rsi(periods: number, sma: boolean): this;
  rsi(name: string, periods: number, sma: boolean): this;
  rsi(nameOrPeriods: string | number, periodsOrSma?: number | boolean, sma?: boolean): this {
    if (typeof nameOrPeriods === "number") {
      const useSma = typeof periodsOrSma === "boolean" ? periodsOrSma : true;
      return this.rsi(InstrumentGroupRTIndicator.PREFIX_RSI + nameOrPeriods, nameOrPeriods, useSma);
    }
    return this.add(
      nameOrPeriods,
      new RsiRTIndicator(periodsOrSma as number, sma!)
        .withMeta("periods", periodsOrSma)
        .withDisplayHint(DisplayHint.PERCENT),
    );
  }

  /** MACD (12/26) of the group's default source, registered as `macd`. */
  macd(): this;
  macd(name: string): this;
  macd(name: string, shortEmaPeriods: number, longEmaPeriods: number): this;
  /** MACD of another registered indicator. */
  macd(name: string, indicator: string, shortEmaPeriods: number, longEmaPeriods: number): this;
  macd(
    name: string = InstrumentGroupRTIndicator.PREFIX_MACD,
    ...args: [] | [number, number] | [string, number, number]
  ): this {
    if (typeof args[0] === "string") {
      const [indicator, shortPeriods, longPeriods] = args as [string, number, number];
      return this.decorate(name, indicator, (source) =>
        new MacdRTIndicator(source, shortPeriods, longPeriods)
          .withMeta("shortPeriods", shortPeriods)
          .withMeta("longPeriods", longPeriods)
          .withMeta(IndicatorMeta.SOURCE, indicator),
      );
    }
    const [shortPeriods = 12, longPeriods = 26] = args as [number?, number?];
    return this.add(
      name,
      new MacdRTIndicator(null, shortPeriods, longPeriods)
        .withMeta("shortPeriods", shortPeriods)
        .withMeta("longPeriods", longPeriods),
    );
  }

  /** CCI over `periods`, registered as `cci` + periods. */
  cci(periods: number): this;
  cci(name: string, periods: number): this;
  cci(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.cci(InstrumentGroupRTIndicator.PREFIX_CCI + nameOrPeriods, nameOrPeriods);
    }
    return this.add(nameOrPeriods, new CciRTIndicator(periods!).withMeta("periods", periods));
  }

  /** Stochastic RSI over `periods`, registered as `stochRsi` + periods. Its output is [0, 100]. */
  stochRsi(periods: number): this;
  stochRsi(name: string, periods: number): this;
  stochRsi(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.stochRsi(InstrumentGroupRTIndicator.PREFIX_STOCH_RSI + nameOrPeriods, nameOrPeriods);
    }
    return this.add(
      nameOrPeriods,
      new StochasticRsiRTIndicator(periods!).withMeta("periods", periods).withDisplayHint(DisplayHint.PERCENT),
    );
  }

  bollinger(): this;
  bollinger(periods: number): this;
  bollinger(periods: number, k: number): this;
  bollinger(name: string, periods: number, k: number): this;
  bollinger(nameOrPeriods?: string | number, periodsOrK?: number, k?: number): this {
    if (nameOrPeriods == null) {
      return this.bollinger(20, 2);
    }
    if (typeof nameOrPeriods === "number") {
      const kVal = periodsOrK ?? 2;
      return this.bollinger(
        InstrumentGroupRTIndicator.PREFIX_BOLLINGER + nameOrPeriods + "_" + kVal,
        nameOrPeriods,
        kVal,
      );
    }
    const bollinger = new BollingerBandsRTIndicator(periodsOrK!, k!);
    return this.add(nameOrPeriods, bollinger)
      .add(nameOrPeriods + InstrumentGroupRTIndicator.SUBFIX_BOLLINGER_UPPER, bollinger.getUpper())
      .add(nameOrPeriods + InstrumentGroupRTIndicator.SUBFIX_BOLLINGER_LOWER, bollinger.getLower());
  }

  /**
   * Adds the bandwidth of the Bollinger Bands registered as `bollingerIndicatorName`, under
   * `bollingerIndicatorName + "BW"`, as a percentage. A source that is missing is replaced by a
   * default bollinger registered as a hidden ("_"-prefixed) entry; one that is not a Bollinger is
   * left alone and nothing is registered.
   */
  bollingerBandwidth(bollingerIndicatorName: string): this {
    let bollinger = this.indicators.get(bollingerIndicatorName);
    if (bollinger !== undefined && !(bollinger instanceof BollingerBandsRTIndicator)) {
      return this;
    }
    if (bollinger === undefined) {
      bollinger = new BollingerBandsRTIndicator();
      this.add(
        InstrumentGroupRTIndicator.PREFIX_HIDDEN + bollingerIndicatorName + InstrumentGroupRTIndicator.PREFIX_BOLLINGER,
        bollinger,
      );
    }
    return this.add(
      bollingerIndicatorName + InstrumentGroupRTIndicator.SUBFIX_BANDWIDTH,
      (bollinger as BollingerBandsRTIndicator)
        .getBandWidth()
        .withMeta(IndicatorMeta.ID, BollingerBandWidthRTIndicator.ID)
        .withMeta(IndicatorMeta.SOURCE, bollingerIndicatorName)
        .withDisplayHint(DisplayHint.PERCENT),
    );
  }

  /**
   * Average True Range over 14 periods, registered as `atr14`. It reads whole bars (high, low,
   * close), so it belongs on a kline group: on a ticker those are the exchange's 24-hour
   * statistics, and the group raises a notice for it (see {@link getNotices}).
   */
  atr(): this;
  atr(periods: number): this;
  atr(name: string, periods: number): this;
  atr(nameOrPeriods?: string | number, periods?: number): this {
    if (nameOrPeriods === undefined) {
      return this.atr(14);
    }
    if (typeof nameOrPeriods === "number") {
      return this.atr(InstrumentGroupRTIndicator.PREFIX_ATR + nameOrPeriods, nameOrPeriods);
    }
    return this.add(nameOrPeriods, new AtrRTIndicator(periods!).withMeta("periods", periods));
  }

  /** Weighted moving average over `periods`, registered as `wma` + periods; the O(1) form. */
  wma(periods: number): this;
  wma(name: string, periods: number): this;
  wma(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.wma(InstrumentGroupRTIndicator.PREFIX_WMA + nameOrPeriods, nameOrPeriods);
    }
    return this.add(nameOrPeriods, new WmaIncrementalRTIndicator(periods!).withMeta("periods", periods));
  }

  /** Triple exponential moving average over `periods`, registered as `tema` + periods. */
  tema(periods: number): this;
  tema(name: string, periods: number): this;
  tema(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.tema(InstrumentGroupRTIndicator.PREFIX_TEMA + nameOrPeriods, nameOrPeriods);
    }
    return this.add(nameOrPeriods, new TemaRTIndicator(periods!).withMeta("periods", periods));
  }

  /** Hull moving average over `periods`, registered as `hma` + periods. */
  hma(periods: number): this;
  hma(name: string, periods: number): this;
  hma(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.hma(InstrumentGroupRTIndicator.PREFIX_HMA + nameOrPeriods, nameOrPeriods);
    }
    return this.add(nameOrPeriods, new HmaRTIndicator(periods!).withMeta("periods", periods));
  }

  /** Modified moving average over `periods`, registered as `mma` + periods. */
  mma(periods: number): this;
  mma(name: string, periods: number): this;
  /** Modified moving average of another registered indicator. */
  mma(name: string, indicator: string, periods: number): this;
  mma(nameOrPeriods: string | number, periodsOrIndicator?: number | string, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.mma(InstrumentGroupRTIndicator.PREFIX_MMA + nameOrPeriods, nameOrPeriods);
    }
    if (typeof periodsOrIndicator === "string") {
      return this.decorate(nameOrPeriods, periodsOrIndicator, (source) =>
        new MmaRTIndicator(periods!, source)
          .withMeta("periods", periods)
          .withMeta(IndicatorMeta.SOURCE, periodsOrIndicator),
      );
    }
    return this.add(nameOrPeriods, new MmaRTIndicator(periodsOrIndicator!).withMeta("periods", periodsOrIndicator));
  }

  /**
   * Kaufman adaptive moving average with its usual periods (efficiency ratio 10, fast 2, slow 30),
   * registered as `kama10_2_30`.
   */
  kama(): this;
  kama(erPeriod: number, fastPeriod: number, slowPeriod: number): this;
  kama(name: string, erPeriod: number, fastPeriod: number, slowPeriod: number): this;
  kama(...args: [] | [number, number, number] | [string, number, number, number]): this {
    if (args.length === 0) {
      return this.kama(10, 2, 30);
    }
    if (typeof args[0] === "number") {
      const [er, fast, slow] = args as [number, number, number];
      return this.kama(InstrumentGroupRTIndicator.PREFIX_KAMA + er + "_" + fast + "_" + slow, er, fast, slow);
    }
    const [name, er, fast, slow] = args as [string, number, number, number];
    return this.add(
      name,
      new KamaRTIndicator(er, fast, slow)
        .withMeta("erPeriod", er)
        .withMeta("fastPeriod", fast)
        .withMeta("slowPeriod", slow),
    );
  }

  /** Standard deviation over `periods`, registered as `stdDev` + periods. */
  stdDev(periods: number): this;
  stdDev(name: string, periods: number): this;
  /** Standard deviation of another registered indicator. */
  stdDev(name: string, indicator: string, periods: number): this;
  stdDev(nameOrPeriods: string | number, periodsOrIndicator?: number | string, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.stdDev(InstrumentGroupRTIndicator.PREFIX_STD_DEV + nameOrPeriods, nameOrPeriods);
    }
    if (typeof periodsOrIndicator === "string") {
      return this.decorate(nameOrPeriods, periodsOrIndicator, (source) =>
        new StandardDeviationRTIndicator(source, periods!)
          .withMeta("periods", periods)
          .withMeta(IndicatorMeta.SOURCE, periodsOrIndicator),
      );
    }
    return this.add(
      nameOrPeriods,
      new StandardDeviationRTIndicator(periodsOrIndicator!).withMeta("periods", periodsOrIndicator),
    );
  }

  /** Variance over `periods`, registered as `variance` + periods. */
  variance(periods: number): this;
  variance(name: string, periods: number): this;
  /** Variance of another registered indicator. */
  variance(name: string, indicator: string, periods: number): this;
  variance(nameOrPeriods: string | number, periodsOrIndicator?: number | string, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.variance(InstrumentGroupRTIndicator.PREFIX_VARIANCE + nameOrPeriods, nameOrPeriods);
    }
    if (typeof periodsOrIndicator === "string") {
      return this.decorate(nameOrPeriods, periodsOrIndicator, (source) =>
        new VarianceRTIndicator(source, periods!)
          .withMeta("periods", periods)
          .withMeta(IndicatorMeta.SOURCE, periodsOrIndicator),
      );
    }
    return this.add(nameOrPeriods, new VarianceRTIndicator(periodsOrIndicator!).withMeta("periods", periodsOrIndicator));
  }

  /**
   * How often the price changes, averaged over `periods` updates by a simple moving average;
   * registered as `vol` + periods.
   */
  volatility(periods: number): this;
  volatility(name: string, periods: number): this;
  volatility(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.volatility(InstrumentGroupRTIndicator.PREFIX_VOLATILITY + nameOrPeriods, nameOrPeriods);
    }
    return this.add(
      nameOrPeriods,
      new VolatilityRTIndicator(new SmaRTIndicator(periods!)).withMeta("periods", periods),
    );
  }

  /**
   * The average absolute percent change between updates, over `periods` updates; registered as
   * `pvol` + periods.
   */
  percentVolatility(periods: number): this;
  percentVolatility(name: string, periods: number): this;
  percentVolatility(nameOrPeriods: string | number, periods?: number): this {
    if (typeof nameOrPeriods === "number") {
      return this.percentVolatility(InstrumentGroupRTIndicator.PREFIX_PERCENT_VOLATILITY + nameOrPeriods, nameOrPeriods);
    }
    return this.add(
      nameOrPeriods,
      new PercentVolatilityRTIndicator(new SmaRTIndicator(periods!)).withMeta("periods", periods),
    );
  }

  /**
   * Bollinger %B over 20 periods and a multiplier of 2: where the price sits in the bands. It
   * carries bands of its own; it does not read or update a Bollinger of the group.
   */
  bollingerPercentB(): this;
  bollingerPercentB(periods: number): this;
  bollingerPercentB(periods: number, k: number): this;
  bollingerPercentB(name: string, periods: number, k: number): this;
  bollingerPercentB(nameOrPeriods?: string | number, periodsOrK?: number, k?: number): this {
    if (nameOrPeriods === undefined) {
      return this.bollingerPercentB(20);
    }
    if (typeof nameOrPeriods === "number") {
      const kVal = periodsOrK ?? 2;
      return this.bollingerPercentB(
        InstrumentGroupRTIndicator.PREFIX_PERCENT_B + nameOrPeriods + "_" + kVal,
        nameOrPeriods,
        kVal,
      );
    }
    return this.add(
      nameOrPeriods,
      new BollingerPercentBRTIndicator(new BollingerBandsRTIndicator(periodsOrK!, k!))
        .withMeta("periods", periodsOrK)
        .withMeta("k", k),
    );
  }

  gain(indicator: string): this;
  gain(name: string, indicator: string): this;
  gain(name: string, indicator: string, resetPeriodsOnSustain: boolean): this;
  gain(nameOrIndicator: string, indicator?: string, resetPeriodsOnSustain = true): this {
    if (indicator == null) {
      return this.gain(InstrumentGroupRTIndicator.PREFIX_GAIN + nameOrIndicator, nameOrIndicator);
    }
    return this.add(
      nameOrIndicator,
      new GainRTIndicator(this.indicators.getReadOnlyExisting(indicator)).setResetPeriodsOnSustain(
        resetPeriodsOnSustain,
      ),
    );
  }

  loss(indicator: string): this;
  loss(name: string, indicator: string): this;
  loss(name: string, indicator: string, resetPeriodsOnSustain: boolean): this;
  loss(nameOrIndicator: string, indicator?: string, resetPeriodsOnSustain = true): this {
    if (indicator == null) {
      return this.loss(InstrumentGroupRTIndicator.PREFIX_LOSS + nameOrIndicator, nameOrIndicator);
    }
    return this.add(
      nameOrIndicator,
      new LossRTIndicator(this.indicators.getReadOnlyExisting(indicator)).setResetPeriodsOnSustain(
        resetPeriodsOnSustain,
      ),
    );
  }

  max(indicator: string): this;
  max(name: string, indicator: string): this;
  max(nameOrIndicator: string, indicator?: string): this {
    if (indicator == null) {
      return this.max(InstrumentGroupRTIndicator.PREFIX_MAX + nameOrIndicator, nameOrIndicator);
    }
    return this.add(nameOrIndicator, new MaxRTIndicator(this.indicators.getReadOnlyExisting(indicator)));
  }

  min(indicator: string): this;
  min(name: string, indicator: string): this;
  min(nameOrIndicator: string, indicator?: string): this {
    if (indicator == null) {
      return this.min(InstrumentGroupRTIndicator.PREFIX_MIN + nameOrIndicator, nameOrIndicator);
    }
    return this.add(nameOrIndicator, new MinRTIndicator(this.indicators.getReadOnlyExisting(indicator)));
  }

  sum(indicator: string): this;
  sum(name: string, indicator: string): this;
  sum(nameOrIndicator: string, indicator?: string): this {
    if (indicator == null) {
      return this.sum(InstrumentGroupRTIndicator.PREFIX_SUM + nameOrIndicator, nameOrIndicator);
    }
    return this.add(nameOrIndicator, new SumRTIndicator(this.indicators.getReadOnlyExisting(indicator)));
  }

  distance(indicator: string, indicatorBase: string): this;
  distance(name: string, indicator: string, indicatorBase: string): this;
  distance(nameOrIndicator: string, indicatorOrBase: string, indicatorBase?: string): this {
    if (indicatorBase == null) {
      return this.distance(
        InstrumentGroupRTIndicator.PREFIX_DIST + nameOrIndicator + indicatorOrBase,
        nameOrIndicator,
        indicatorOrBase,
      );
    }
    const dist = new DistanceRTIndicator(
      this.indicators.getReadOnlyExisting(indicatorOrBase),
      this.indicators.getReadOnlyExisting(indicatorBase),
    );
    return this.add(
      nameOrIndicator,
      TransformRTIndicator.multiply(dist, 100)
        .withMeta(IndicatorMeta.ID, DistanceRTIndicator.ID)
        .withMeta(IndicatorMeta.SOURCE, indicatorOrBase)
        .withMeta("base", indicatorBase)
        .withDisplayHint(DisplayHint.PERCENT),
    );
  }

  distanceMa(indicator: string): this;
  distanceMa(name: string, indicator: string): this;
  distanceMa(nameOrIndicator: string, indicator?: string): this {
    if (indicator == null) {
      return this.distanceMa(InstrumentGroupRTIndicator.PREFIX_DIST + nameOrIndicator, nameOrIndicator);
    }
    const dist = new DistanceFromMaRTIndicator(this.indicators.getReadOnlyExisting(indicator));
    return this.add(
      nameOrIndicator,
      TransformRTIndicator.multiply(dist, 100)
        .withMeta(IndicatorMeta.ID, DistanceFromMaRTIndicator.ID)
        .withMeta(IndicatorMeta.SOURCE, indicator)
        .withDisplayHint(DisplayHint.PERCENT),
    );
  }

  percentChange(indicator: string): this;
  percentChange(name: string, indicator: string): this;
  percentChange(nameOrIndicator: string, indicator?: string): this {
    if (indicator == null) {
      return this.percentChange(InstrumentGroupRTIndicator.PREFIX_RATE_CHANGE + nameOrIndicator, nameOrIndicator);
    }
    return this.rateChange(nameOrIndicator, indicator, true);
  }

  rateChange(indicator: string): this;
  rateChange(name: string, indicator: string, percent: boolean): this;
  rateChange(nameOrIndicator: string, indicator?: string, percent?: boolean): this {
    if (indicator == null) {
      return this.rateChange(InstrumentGroupRTIndicator.PREFIX_RATE_CHANGE + nameOrIndicator, nameOrIndicator, false);
    }
    const rateChange = new RateChangeRTIndicator(this.indicators.getReadOnlyExisting(indicator));
    const registered: AbstractRTIndicator = percent ? TransformRTIndicator.multiply(rateChange, 100) : rateChange;
    return this.add(
      nameOrIndicator,
      registered
        .withMeta(IndicatorMeta.ID, RateChangeRTIndicator.ID)
        .withMeta(IndicatorMeta.SOURCE, indicator)
        .withDisplayHint(percent ? DisplayHint.PERCENT : DisplayHint.ABSOLUTE),
    );
  }

  round(indicator: string, decimals: number): this;
  round(name: string, indicator: string, decimals: number): this;
  round(nameOrIndicator: string, indicatorOrDecimals: string | number, decimals?: number): this {
    if (typeof indicatorOrDecimals === "number") {
      return this.round(
        InstrumentGroupRTIndicator.PREFIX_ROUND + nameOrIndicator,
        nameOrIndicator,
        indicatorOrDecimals,
      );
    }
    return this.add(
      nameOrIndicator,
      new RoundRTIndicator(this.indicators.getReadOnlyExisting(indicatorOrDecimals), decimals!),
    );
  }

  addIndicators(indicatorA: string, indicatorB: string): this;
  addIndicators(name: string, indicatorA: string, indicatorB: string): this;
  addIndicators(nameOrA: string, aOrB: string, indicatorB?: string): this {
    if (indicatorB == null) {
      return this.addIndicators(
        InstrumentGroupRTIndicator.PREFIX_ADD + nameOrA + aOrB,
        nameOrA,
        aOrB,
      );
    }
    return this.add(
      nameOrA,
      BiFunctionRTIndicator.plus(
        this.indicators.getReadOnlyExisting(aOrB),
        this.indicators.getReadOnlyExisting(indicatorB),
      ),
    );
  }

  diff(indicatorA: string, indicatorB: string): this;
  diff(name: string, indicatorA: string, indicatorB: string): this;
  diff(nameOrA: string, aOrB: string, indicatorB?: string): this {
    if (indicatorB == null) {
      return this.diff(
        InstrumentGroupRTIndicator.PREFIX_DIFF + nameOrA + aOrB,
        nameOrA,
        aOrB,
      );
    }
    return this.add(
      nameOrA,
      BiFunctionRTIndicator.minus(
        this.indicators.getReadOnlyExisting(aOrB),
        this.indicators.getReadOnlyExisting(indicatorB),
      ),
    );
  }

  mul(indicatorA: string, indicatorB: string): this;
  mul(name: string, indicatorA: string, indicatorB: string): this;
  mul(indicator: string, coefficient: number): this;
  mul(name: string, indicator: string, coefficient: number): this;
  mul(
    nameOrA: string,
    aOrBOrCoeff: string | number,
    indicatorBOrCoeff?: string | number,
  ): this {
    if (typeof aOrBOrCoeff === "number") {
      // mul(indicator, coefficient)
      return this.mul(
        InstrumentGroupRTIndicator.PREFIX_MUL + nameOrA,
        nameOrA,
        aOrBOrCoeff,
      );
    }
    if (indicatorBOrCoeff == null) {
      // mul(indicatorA, indicatorB)
      return this.mul(
        InstrumentGroupRTIndicator.PREFIX_MUL + nameOrA + aOrBOrCoeff,
        nameOrA,
        aOrBOrCoeff,
      );
    }
    if (typeof indicatorBOrCoeff === "number") {
      // mul(name, indicator, coefficient)
      return this.add(
        nameOrA,
        TransformRTIndicator.multiply(this.indicators.getReadOnlyExisting(aOrBOrCoeff), indicatorBOrCoeff),
      );
    }
    // mul(name, indicatorA, indicatorB)
    return this.add(
      nameOrA,
      BiFunctionRTIndicator.multiply(
        this.indicators.getReadOnlyExisting(aOrBOrCoeff),
        this.indicators.getReadOnlyExisting(indicatorBOrCoeff),
      ),
    );
  }

  /**
   * Wiring diagnostics raised about this group, in the order they were first raised; empty for a
   * correctly wired group. Today the one kind is an indicator that needs bars, fed from a ticker.
   */
  getNotices(): IndicatorNotice[] {
    return this.indicators.getNotices();
  }

  /**
   * Wraps the registered indicator `indicator` with the indicator `op` makes of its read-only view
   * and registers the result as `name`. The source is not updated through the wrapper.
   */
  decorate(name: string, indicator: string, op: (indicator: RTIndicator) => RTIndicator): this {
    return this.add(name, op(this.indicators.getReadOnlyExisting(indicator)));
  }

  /**
   * The six comparisons come in two shapes. With a coefficient only, the entry holds the source's
   * value while the comparison holds and keeps the last such value otherwise. With `thenIndicator`
   * (and optionally `elseIndicator`) it takes that indicator's value when the comparison holds, the
   * else indicator's when it does not, and keeps its value when there is no else indicator. An
   * `elseIndicator` that is not registered means no else indicator; a missing `thenIndicator` fails.
   */
  equal(name: string, indicator: string, coefficient: number): this;
  equal(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  equal(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.equal(coefficient), thenIndicator, elseIndicator);
  }

  notEqual(name: string, indicator: string, coefficient: number): this;
  notEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  notEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.notEqual(coefficient), thenIndicator, elseIndicator);
  }

  greatOrEqual(name: string, indicator: string, coefficient: number): this;
  greatOrEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  greatOrEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.greaterOrEqual(coefficient), thenIndicator, elseIndicator);
  }

  greatThan(name: string, indicator: string, coefficient: number): this;
  greatThan(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  greatThan(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.greaterThan(coefficient), thenIndicator, elseIndicator);
  }

  lessOrEqual(name: string, indicator: string, coefficient: number): this;
  lessOrEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  lessOrEqual(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.lessOrEqual(coefficient), thenIndicator, elseIndicator);
  }

  lessThan(name: string, indicator: string, coefficient: number): this;
  lessThan(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator: string,
    elseIndicator?: string,
  ): this;
  lessThan(
    name: string,
    indicator: string,
    coefficient: number,
    thenIndicator?: string,
    elseIndicator?: string,
  ): this {
    return this.compare(name, indicator, predicates.lessThan(coefficient), thenIndicator, elseIndicator);
  }

  /** Keeps the source's value while `predicate` holds for it, and the last such value otherwise. */
  predicate(name: string, indicator: string, predicate: (value: number) => boolean): this {
    return this.add(name, new PredicateRTIndicator(this.indicators.getReadOnlyExisting(indicator), predicate));
  }

  /** Counts the consecutive updates for which `predicate` holds; the entry's value stays the source's. */
  periodCount(name: string, indicator: string, predicate: (value: number) => boolean): this {
    return this.add(
      name,
      new PredicatePeriodCounterRTIndicator(this.indicators.getReadOnlyExisting(indicator), predicate),
    );
  }

  /**
   * Updates `thenIndicator` with the source's value when `predicate` holds for the source, else
   * `elseIndicator`; the branch indicators are used as given, not as read-only views.
   */
  conditional(
    name: string,
    indicator: string,
    predicate: (indicator: RTIndicator) => boolean,
    thenIndicator: RTIndicator,
    elseIndicator?: RTIndicator | null,
  ): this {
    return this.add(
      name,
      new ConditionalRTIndicator(
        this.indicators.getReadOnlyExisting(indicator),
        predicate,
        thenIndicator,
        elseIndicator ?? null,
      ),
    );
  }

  /** The value of `indicator`, with the clamp value in place of any value `predicate` holds for. */
  clamp(indicator: string, predicate: (value: number) => boolean, clampValue: number): this;
  clamp(name: string, indicator: string, predicate: (value: number) => boolean, clampValue: number): this;
  /** The value of `indicator`, held to the range `minRange` to `maxRange`. */
  clamp(indicator: string, minRange: number, maxRange: number): this;
  clamp(name: string, indicator: string, minRange: number, maxRange: number): this;
  clamp(
    first: string,
    second: string | number | ((value: number) => boolean),
    third: number | ((value: number) => boolean),
    fourth?: number,
  ): this {
    if (typeof second === "string") {
      return this.clampOf(first, second, third, fourth!);
    }
    return this.clampOf(InstrumentGroupRTIndicator.PREFIX_CLAMP + first, first, second, third as number);
  }

  private clampOf(
    name: string,
    indicator: string,
    predicateOrMin: number | ((value: number) => boolean),
    clampValueOrMax: number,
  ): this {
    const source = this.indicators.getReadOnlyExisting(indicator);
    return this.add(
      name,
      typeof predicateOrMin === "function"
        ? new ClampPredicateRTIndicator(source, predicateOrMin, clampValueOrMax)
        : new ClampRTIndicator(source, predicateOrMin, clampValueOrMax),
    );
  }

  private compare(
    name: string,
    indicator: string,
    test: (value: number) => boolean,
    thenIndicator: string | undefined,
    elseIndicator: string | undefined,
  ): this {
    const source = this.indicators.getReadOnlyExisting(indicator);
    if (thenIndicator === undefined) {
      return this.add(name, new PredicateRTIndicator(source, test));
    }
    return this.add(
      name,
      new ConditionalRTIndicator(
        source,
        (compared) => test(compared.getValue()),
        this.indicators.getReadOnlyExisting(thenIndicator),
        elseIndicator == null ? null : (this.indicators.getReadOnly(elseIndicator) ?? null),
      ),
    );
  }

  /** Combines two registered indicators through `bifunction`, registered as `name`. */
  fun(name: string, indicatorA: string, indicatorB: string, bifunction: (a: number, b: number) => number): this {
    return this.add(
      name,
      new BiFunctionRTIndicator(
        this.indicators.getReadOnlyExisting(indicatorA),
        this.indicators.getReadOnlyExisting(indicatorB),
        bifunction,
      ),
    );
  }

  /** A builder for a window, registered with this group when built. Every window shares the group's state store. */
  window(): WindowTimeRTIndicatorBuilder;
  /** A builder for a window of the given length. */
  window(period: WindowPeriod): WindowTimeRTIndicatorBuilder;
  /** A window of `source` that notifies `listener` each time `period` of data time has passed. */
  window(source: string, period: WindowPeriod, listener: OnChangeListener): this;
  window(source: string, period: WindowPeriod, delayUpdates: boolean, listener: OnChangeListener): this;
  window(
    sourceOrPeriod?: string | WindowPeriod,
    period?: WindowPeriod,
    listenerOrDelay?: OnChangeListener | boolean,
    listener?: OnChangeListener,
  ): WindowTimeRTIndicatorBuilder | this {
    // The window watches the source through a read-only view and lives under a hidden name, so
    // the source keeps its own name and keeps being updated, ahead of the window
    const builder = new WindowTimeRTIndicatorBuilder(this.indicators, (name, window) =>
      name == null ? this.addWindow(window) : this.add(name, window),
    ).stateStoreSupplier(() => this.getStateStore());
    if (period === undefined) {
      return sourceOrPeriod === undefined ? builder : builder.duration(sourceOrPeriod as WindowPeriod);
    }
    const delayUpdates = typeof listenerOrDelay === "boolean" && listenerOrDelay;
    const onChange = typeof listenerOrDelay === "boolean" ? listener : listenerOrDelay;
    if (typeof onChange !== "function") {
      throw new Error("A window needs a listener");
    }
    builder.of(sourceOrPeriod as string).duration(period).delayUpdates(delayUpdates).onChangeListener(onChange).build();
    return this;
  }

  /** Registers a window under a hidden name: `_win1`, `_win2`... as the Java engine does. */
  addWindow(window: WindowTimeRTIndicator): this {
    return this.add(`${InstrumentGroupRTIndicator.PREFIX_WINDOW}${++this.windowCount}`, window);
  }

  /**
   * The state store shared by the listeners of this group's windows: the one the owner supplied
   * (a strategy supplies its per-instrument store), else one of its own.
   */
  /**
   * The store of this instrument: the supplier's, asked on every call as the Java engine does, or
   * one of this group's own, made once when there is no supplier.
   */
  getStateStore(): StateStore {
    if (this.stateStoreSupplier != null) {
      return this.stateStoreSupplier();
    }
    if (this.stateStore == null) {
      this.stateStore = new StateStore();
    }
    return this.stateStore;
  }

  /** Points this group, and the windows it builds, at an externally owned state store. */
  setStateStoreSupplier(supplier: () => StateStore): this {
    this.stateStoreSupplier = supplier;
    this.stateStore = null;
    return this;
  }

  add(name: string, indicator: RTIndicator): this;
  /** Registers `indicator` under `name`, with `displayHint` as its display hint. */
  add(name: string, indicator: RTIndicator, displayHint: DisplayHint): this;
  add(name: string, tickerValueSource: TickerValueSource): this;
  add(name: string, klineValueSource: KlineValueSource): this;
  /** Registers a snapshot field feeding `indicator`. */
  add(name: string, valueSource: TickerValueSource | KlineValueSource, indicator: RTIndicator): this;
  /**
   * The sum of two registered indicators, registered as `add` + A + B. A second argument that names
   * a ticker or kline value source is that source instead: `add(name, "Volume")` is the value source
   * form, whatever indicators exist. `addIndicators` is the sum without that ambiguity.
   */
  add(indicatorA: string, indicatorB: string): this;
  /** The sum of two registered indicators. */
  add(name: string, indicatorA: string, indicatorB: string): this;
  add(
    first: string,
    second: RTIndicator | string,
    third?: RTIndicator | DisplayHint | string,
  ): this {
    if (typeof second !== "string") {
      if (third instanceof DisplayHint && second instanceof AbstractRTIndicator) {
        second.withDisplayHint(third);
      }
      this.indicators.add(first, second);
      return this;
    }
    if (typeof third === "string") {
      return this.addIndicators(first, second, third);
    }
    if (third === undefined) {
      return isValueSource(second) ? this.addSource(first, second) : this.addIndicators(first, second);
    }
    if (!isValueSource(second)) {
      throw new Error(`Unknown value source: ${second}`);
    }
    return this.addSource(first, second, third as RTIndicator);
  }

  private addSource(name: string, source: TickerValueSource | KlineValueSource, indicator?: RTIndicator): this {
    // Determine ticker vs kline by the underlying indicator map type
    if (this.indicators instanceof InstrumentMapKlineSourceRTIndicator) {
      const kline = source as KlineValueSource;
      this.indicators.add(name, new KlineRTIndicator(kline, indicator).withDisplayHint(klineDisplayHint(kline)));
    } else {
      const ticker = source as TickerValueSource;
      this.indicators.add(name, new TickerRTIndicator(ticker, indicator).withDisplayHint(tickerDisplayHint(ticker)));
    }
    return this;
  }

  getIndicatorValue(name: string): number {
    return this.indicators.getIndicatorValue(name);
  }

  getReadOnlyExisting(name: string): RTIndicator {
    return this.indicators.getReadOnlyExisting(name);
  }

  getReadOnly(name: string): RTIndicator | undefined {
    return this.indicators.getReadOnly(name);
  }

  getExisting(name: string): RTIndicator {
    return this.indicators.getExisting(name);
  }

  get(name: string): RTIndicator | undefined {
    return this.indicators.get(name);
  }

  remove(name: string): RTIndicator | undefined {
    return this.indicators.remove(name);
  }

  clear(): void {
    this.indicators.clear();
  }

  /** Resets the group and every indicator it registered, as the Java engine's group does. */
  override reset(): void {
    super.reset();
    this.indicators.reset();
  }
}

function isValueSource(value: string): value is TickerValueSource | KlineValueSource {
  return (
    (Object.values(TickerValueSource) as string[]).includes(value) ||
    (Object.values(KlineValueSource) as string[]).includes(value)
  );
}

/** What a raw ticker field implies: a chart must not plot a percentage or a size on the price axis. */
function tickerDisplayHint(source: TickerValueSource): DisplayHint {
  switch (source) {
    case TickerValueSource.PercentChange:
      return DisplayHint.PERCENT;
    case TickerValueSource.BidSize:
    case TickerValueSource.AskSize:
    case TickerValueSource.Volume:
    case TickerValueSource.VolumeQuote:
      return DisplayHint.VOLUME;
    default:
      return DisplayHint.ABSOLUTE;
  }
}

function klineDisplayHint(source: KlineValueSource): DisplayHint {
  switch (source) {
    case KlineValueSource.Volume:
    case KlineValueSource.VolumeQuote:
    case KlineValueSource.NumberOfTrades:
      return DisplayHint.VOLUME;
    default:
      return DisplayHint.ABSOLUTE;
  }
}
