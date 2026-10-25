import { MarketHintKind, MarketHintSignal } from "./MarketHintSignal";

/**
 * Sell hint signal.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.SellSignal
 */
export class SellSignal extends MarketHintSignal {
  constructor(strategyName: string, instrument: string, price: number) {
    super(strategyName, MarketHintKind.sell, instrument, price);
  }

  override copy(): SellSignal {
    return this.copyInternal(
      new SellSignal(this.strategyName, this.instrument, this.price),
    );
  }
}
