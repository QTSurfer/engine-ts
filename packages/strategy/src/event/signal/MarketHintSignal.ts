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
  static readonly KEY_SELL_PERCENT = "_sellPct";
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

  setSellPercent(percent: number): this {
    return this.set(MarketHintSignal.KEY_SELL_PERCENT, percent);
  }

  getSellPercent(): number {
    return this.get<number>(MarketHintSignal.KEY_SELL_PERCENT) ?? 100.0;
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
