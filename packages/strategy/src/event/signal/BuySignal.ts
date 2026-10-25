import { MarketHintKind, MarketHintSignal } from "./MarketHintSignal";

/**
 * Buy hint signal.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.BuySignal
 */
export class BuySignal extends MarketHintSignal {
  constructor(strategyName: string, instrument: string, price: number) {
    super(strategyName, MarketHintKind.buy, instrument, price);
  }

  override copy(): BuySignal {
    return this.copyInternal(
      new BuySignal(this.strategyName, this.instrument, this.price),
    );
  }
}
