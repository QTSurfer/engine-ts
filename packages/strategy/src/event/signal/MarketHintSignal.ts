import { StrategyEventType } from "$event/StrategyEventType";
import { EventTypeValueSignal } from "./EventTypeValueSignal";

/**
 * Market hint signal kinds.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.MarketHintSignal.Kind
 */
export enum MarketHintKind {
  buy = "buy",
  sell = "sell",
}

/**
 * Order kinds for market hint signals.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.MarketHintSignal.OrderKind
 */
export enum OrderKind {
  market = "market",
  limit = "limit",
  stop = "stop",
  stopTrailing = "stopTrailing",
}

/**
 * Market hint signal — abstract base for buy/sell signals.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.MarketHintSignal
 */
export abstract class MarketHintSignal extends EventTypeValueSignal {
  static readonly KEY_FLAGS = "_flgs";
  static readonly KEY_MAX_TRIES = "_maxTries";
  static readonly KEY_SIZE_PERCENT = "_sizePct";
  static readonly KEY_MAX_PERCENT = "_maxPct";
  static readonly KEY_STOP_PRICE = "_stopPrice";
  static readonly KEY_STOP_LIMIT_PRICE = "_stopLimitPrice";
  static readonly KEY_TRAIL_DISTANCE = "_trailDist";
  static readonly KEY_TRAIL_PERCENT = "_trailPct";

  readonly kind: MarketHintKind;
  readonly price: number;
  orderKind: OrderKind;

  protected constructor(
    strategyName: string,
    hintKind: MarketHintKind,
    instrument: string,
    price: number,
  ) {
    super(strategyName, instrument, StrategyEventType.Hint, hintKind);
    this.kind = hintKind;
    this.price = price;
    this.orderKind = OrderKind.market;
    this.set(hintKind, price);
  }

  setOrderKind(orderKind: OrderKind): this {
    this.orderKind = orderKind;
    return this;
  }

  setMaxTries(maxTries: number): this {
    return this.set(MarketHintSignal.KEY_MAX_TRIES, maxTries);
  }

  getMaxTries(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_MAX_TRIES);
  }

  /**
   * The share of its own base this signal trades, 0 to 100, one number for either side: on a buy,
   * the percent of the funds the entry spends, never more than what is left unlocked (it replaces
   * the run's `buyPercent` for this signal only); on a sell, the percent of the open position it
   * sells. 0 trades nothing.
   *
   * A signal has one size: this takes back a {@link setMaxPercent} the signal had.
   *
   * @throws if `percent` is not a number from 0 to 100
   */
  setSizePercent(percent: number): this {
    checkPercent("sizePercent", percent);
    return this.setSize(MarketHintSignal.KEY_SIZE_PERCENT, MarketHintSignal.KEY_MAX_PERCENT, percent);
  }

  /** The share of the funds the signal asks for, or `undefined` when it asks for none. */
  getSizePercent(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_SIZE_PERCENT);
  }

  /**
   * The share, 0 to 100, of the most this signal can trade, the relative size next to
   * {@link setSizePercent}'s share of the funds. On a buy, the most is what the run is configured
   * to spend (`buyPercent` of the funds, or all the cash that is left when it is 100) and never
   * more than what is left unlocked: 100 is that maximum and the configured `buyPercent` is a
   * ceiling this never passes. On a sell the most is the open position, so it means what
   * {@link setSizePercent} means. 0 trades nothing.
   *
   * A signal has one size: this takes back a {@link setSizePercent} the signal had.
   *
   * @throws if `percent` is not a number from 0 to 100
   */
  setMaxPercent(percent: number): this {
    checkPercent("maxPercent", percent);
    return this.setSize(MarketHintSignal.KEY_MAX_PERCENT, MarketHintSignal.KEY_SIZE_PERCENT, percent);
  }

  /** The share of the maximum the signal asks for, or `undefined` when it asks for none. */
  getMaxPercent(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_MAX_PERCENT);
  }

  /**
   * The sell side's name for {@link setSizePercent}: it writes the same size, takes back a
   * {@link setMaxPercent}, and does not validate.
   */
  setSellPercent(percent: number): this {
    return this.setSize(MarketHintSignal.KEY_SIZE_PERCENT, MarketHintSignal.KEY_MAX_PERCENT, percent);
  }

  /** The size of a sell: `sizePercent`, else `maxPercent`, else 100 when the signal asks for none. */
  getSellPercent(): number {
    return this.getSizePercent() ?? this.getMaxPercent() ?? 100.0;
  }

  /** Writes the one size of the signal under `key`, taking back the other kind. */
  private setSize(key: string, otherKey: string, percent: number): this {
    this.properties.delete(otherKey);
    return this.set(key, percent);
  }

  setFlags(...flags: string[]): this {
    return this.set(MarketHintSignal.KEY_FLAGS, flags);
  }

  getFlags(): string[] | undefined {
    return this.get<string[]>(MarketHintSignal.KEY_FLAGS);
  }

  setStopPrice(stopPrice: number): this {
    return this.set(MarketHintSignal.KEY_STOP_PRICE, stopPrice);
  }

  getStopPrice(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_STOP_PRICE);
  }

  setStopLimitPrice(limitPrice: number): this {
    return this.set(MarketHintSignal.KEY_STOP_LIMIT_PRICE, limitPrice);
  }

  getStopLimitPrice(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_STOP_LIMIT_PRICE);
  }

  hasStopLoss(): boolean {
    return this.getStopPrice() != null;
  }

  /**
   * Absolute distance (in price units) between the running peak/trough and
   * the trailing stop level. Only meaningful for `OrderKind.stopTrailing`,
   * which needs this above zero or {@link setTrailPercent}; orders with
   * neither are dropped on emission. When both are set the percent wins.
   */
  setTrailDistance(distance: number): this {
    return this.set(MarketHintSignal.KEY_TRAIL_DISTANCE, distance);
  }

  getTrailDistance(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_TRAIL_DISTANCE);
  }

  /**
   * Trailing-stop distance as a percent of the running price extreme. Only
   * meaningful for `OrderKind.stopTrailing`: the backtest tracks the highest
   * price seen since the signal (lowest for a buy), starting from the signal's
   * own price, and fires once the last price retraces this percent from it,
   * filling at that trigger level.
   */
  setTrailPercent(percent: number): this {
    return this.set(MarketHintSignal.KEY_TRAIL_PERCENT, percent);
  }

  getTrailPercent(): number | undefined {
    return this.get<number>(MarketHintSignal.KEY_TRAIL_PERCENT);
  }

  abstract copy(): MarketHintSignal;

  protected copyInternal<T extends MarketHintSignal>(copy: T): T {
    for (const [key, value] of this.properties) {
      copy.properties.set(key, value);
    }
    copy.timestamp = this.timestamp;
    copy.orderKind = this.orderKind;
    return copy;
  }
}

function checkPercent(name: string, percent: number): void {
  if (!(percent >= 0 && percent <= 100)) {
    throw new RangeError(`${name} must be from 0 to 100, got ${percent}`);
  }
}
