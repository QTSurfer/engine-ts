import type { Ticker } from "@qtsurfer/core";
import { MarketHintKind, OrderKind } from "$signal/MarketHintSignal";
import type { MarketHintSignal } from "$signal/MarketHintSignal";
import { SellSignal } from "$signal/SellSignal";
import { DefaultStrategyYield } from "$yield/DefaultStrategyYield";
import type { AbstractStrategy } from "../AbstractStrategy";
import type { BacktestConfig } from "./BacktestConfig";
import type { ExecutionCallback } from "./ExecutionCallback";
import { NOOP_CALLBACK } from "./ExecutionCallback";
import type { ExecutionPipeline } from "./ExecutionPipeline";
import { ExecutionResult } from "./ExecutionResult";
import { ExecutionStatus } from "./ExecutionStatus";
import { FeeLeg } from "./FeeLeg";
import type { IgnoredReason } from "./SessionOutput";
import type { FeeModel } from "./simulation/FeeModel";
import { FixedFeeModel } from "./simulation/FeeModel";
import type { FillPolicy } from "./simulation/FillPolicy";
import { ImmediateFill } from "./simulation/FillPolicy";
import type { SlippageModel } from "./simulation/SlippageModel";
import { FixedBpsSlippage, NoSlippage } from "./simulation/SlippageModel";

type Liquidity = "maker" | "taker";

interface Resolution {
  readonly price: number;
  /**
   * Whether the fill consumed liquidity or provided it. Drives the fee
   * model's maker/taker routing.
   */
  readonly liquidity: Liquidity;
}

/** Running state for a trailing stop that has been queued but not yet filled. */
interface TrailState {
  /** Running peak (for sell-side trails) or trough (buy-side), seeded with the signal's own price. */
  extreme: number;
}

/**
 * Synchronous LONG-only backtest execution pipeline.
 * State machine: IDLE → buy signal → EXECUTING (holding position) → sell signal → emit yield → IDLE
 *
 * Default behavior: market orders fill at signal price; fees charged on BOTH sides
 * per the canonical contract, routed by `feeLeg`:
 *  - `RECEIVED` (default): buy fee in BASE (the position holds net base), sell fee
 *    in QUOTE. The everyday spot mechanic.
 *  - `QUOTE`: fee in QUOTE on both sides; the buy fee is reserved out of the all-in
 *    cash at sizing (`base / (1 + buyRate)`) so the balance never goes negative,
 *    and is folded into the realized output of the matching sell.
 *
 * Opt-in simulation via BacktestConfig:
 *  - `feeRateBuy`    → buy-side rate (defaults to `feeRate`)
 *  - `feeRateSell`   → override of `feeRate` for sell side
 *  - `feeLeg`        → which leg the fee lands on (default RECEIVED)
 *  - `slippageBps`   → adverse price movement applied to market fills
 *  - `buyPercent`    → fraction of balance spent per buy (default 100)
 *  - `feeModel`      → custom FeeModel (supersedes feeRate* shortcuts)
 *  - `slippageModel` → custom SlippageModel (supersedes slippageBps)
 *  - `fillPolicy`    → custom FillPolicy for market-order timing (defaults to ImmediateFill)
 *
 * A sell closes the whole position, as the Java engine's single long pipeline does: a signal's
 * `sellPercent` is read only by Java's multi-long pipeline, which this simulation does not have.
 *
 * Order kinds (on `signal.orderKind`). Queued limit, stop and trailing orders
 * resolve against the tick's `last` price only — never its high/low, which a
 * bar has not finished printing:
 *  - `market` (default) → routed through FillPolicy.
 *  - `limit`  → queued until `last` reaches `signal.price` (buy: last ≤ limit;
 *    sell: last ≥ limit). Fills at the limit price, as a maker fill for the fee
 *    model; the slippage model still applies, as in the Java engine.
 *  - `stop`   → queued until `last` reaches `signal.price`, its stop price
 *    (buy breakout: last ≥ stop; sell stop-loss: last ≤ stop). Fills at the
 *    stop price. Becomes market on trigger, so slippage applies.
 *  - `stopTrailing` → queued with a per-signal running extreme (peak for sell
 *    trails, trough for buy trails) seeded with `signal.price` and advanced by
 *    `last` on every resolving tick. The trigger level is the extreme less
 *    (sell) or plus (buy) `signal.getTrailPercent()` percent of the extreme, or
 *    the absolute `signal.getTrailDistance()` when no percent is set; it fires
 *    when `last` reaches it and fills at that level. Signals with no percent
 *    and no distance above zero are dropped on emission. Becomes market on
 *    trigger.
 *
 * A filled buy that carries `signal.getStopPrice()` auto-places a protective
 * `stop` sell at that price in the same queue; its size is whatever position the
 * pipeline holds when it fires. Closing the position by any route cancels the
 * queued `stop` orders for its instrument, so a stale stop never fires against a
 * later position; a partial sell leaves them in place to protect the remainder.
 *
 * Non-market orders resolve starting from the *next* `onTicker` call after
 * emission — deliberately avoids same-tick look-ahead. Partial sells keep the
 * pipeline EXECUTING with a residual position until the base amount is fully
 * unwound.
 *
 * A signal the pipeline drops without a fill is reported to the callback's optional
 * `onIgnored(signal, reason)`: a buy while a position is open, with no funds or with a size of
 * zero; a sell with no open position or a size of zero; a trailing stop with nothing to trail by;
 * a queued `stop` order the strategy sent, cancelled when the position closed. A queued order
 * reports it when it resolves. The protective stop an entry attaches is the pipeline's own order:
 * it is never reported. Reporting reads state and changes no number.
 *
 * Callers must invoke `onTicker` before feeding each bar to the strategy —
 * `BacktestRunner` handles this wiring.
 */
export class BacktestExecutionPipeline implements ExecutionPipeline {
  private readonly strategy: AbstractStrategy;
  private readonly config: BacktestConfig;
  private readonly callback: ExecutionCallback;
  private readonly feeModel: FeeModel;
  private readonly slippageModel: SlippageModel;
  private readonly fillPolicy: FillPolicy;
  private readonly feeLeg: FeeLeg;

  private balance: number;
  private status = ExecutionStatus.IDLE;
  private enterResult: ExecutionResult | null = null;
  /**
   * Quote-denominated buy fee paid on the current entry — non-zero only under
   * {@link FeeLeg.QUOTE}, where the buy fee comes out of cash and so is a realized
   * cost folded into the matching sell's output. Scaled down on partial sells in
   * lockstep with {@link enterResult}.
   */
  private enterQuoteBuyFee = 0;
  private currentTicker: Ticker | null = null;
  private pending: MarketHintSignal[] = [];
  private readonly trailState = new Map<MarketHintSignal, TrailState>();
  /** The protective stops this pipeline queued itself: housekeeping, not strategy signals. */
  private readonly attachedStops = new WeakSet<MarketHintSignal>();
  /** Total fees charged per asset symbol — leg-aware accumulation surface. */
  private readonly feesByAsset = new Map<string, number>();

  constructor(
    strategy: AbstractStrategy,
    config: BacktestConfig,
    callback?: ExecutionCallback,
  ) {
    this.strategy = strategy;
    this.config = config;
    this.balance = config.initialFunding;
    this.callback = callback ?? NOOP_CALLBACK;
    this.feeModel = resolveFeeModel(config);
    this.slippageModel = resolveSlippageModel(config);
    this.fillPolicy = config.fillPolicy ?? new ImmediateFill();
    this.feeLeg = config.feeLeg ?? FeeLeg.RECEIVED;
    if (this.feeLeg === FeeLeg.BASE) {
      throw new Error(
        "FeeLeg.BASE (fee always in base) is reserved and not implemented",
      );
    }
  }

  handle(signal: MarketHintSignal): void {
    if (signal.orderKind === OrderKind.stopTrailing) {
      // A trailing stop is useless without a percent or a distance above zero
      // to trail by — drop it rather than let it sit in the queue forever.
      if (!trailsBy(signal)) {
        this.ignore(signal, "invalid-order");
        return;
      }
      this.pending.push(signal);
      this.trailState.set(signal, { extreme: signal.price });
      return;
    }
    if (signal.orderKind !== OrderKind.market) {
      // Limit and stop orders are inherently deferred — they wait for a
      // trigger regardless of the configured market-fill policy.
      this.pending.push(signal);
      return;
    }
    if (this.fillPolicy.isImmediate(signal)) {
      this.execute(signal, signal.price, "taker");
      return;
    }
    this.pending.push(signal);
  }

  onTicker(ticker: Ticker): void {
    this.currentTicker = ticker;
    if (this.pending.length === 0) return;

    // Each deferred signal gets one resolve attempt against this tick; signals
    // not ready stay in the queue in order for the next tick. The whole queue
    // is resolved before any fill executes, so a sell that cancels queued stops
    // sees every stop that did not fire this tick, whatever its queue position.
    const queue = this.pending;
    this.pending = [];
    const fills: { signal: MarketHintSignal; resolution: Resolution }[] = [];
    for (const signal of queue) {
      const resolution = this.resolvePending(signal, ticker);
      if (resolution == null) {
        this.pending.push(signal);
        continue;
      }
      this.trailState.delete(signal);
      fills.push({ signal, resolution });
    }
    for (const { signal, resolution } of fills) {
      this.execute(signal, resolution.price, resolution.liquidity);
    }
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }

  getBalance(): number {
    return this.balance;
  }

  /**
   * Total fees charged per asset symbol so far: under RECEIVED, base-asset
   * entries from buy fills and quote-asset from sell fills; under QUOTE, every
   * entry lands in the quote currency.
   */
  getFeesByAsset(): Record<string, number> {
    return Object.fromEntries(this.feesByAsset);
  }

  /** Tells the callback a strategy signal was dropped without a fill. The pipeline's own stops are not signals. */
  private ignore(signal: MarketHintSignal, reason: IgnoredReason): void {
    if (this.attachedStops.has(signal)) return;
    this.callback.onIgnored?.(signal, reason);
  }

  private addFee(asset: string, amount: number): void {
    this.feesByAsset.set(asset, (this.feesByAsset.get(asset) ?? 0) + amount);
  }

  /**
   * When a fill happened: the data time of the tick it resolved on, which for a queued order is
   * later than the signal's own timestamp. Falls back to the signal's when no tick was fed.
   */
  private fillTimestamp(signal: MarketHintSignal): number {
    return this.currentTicker?.timestamp ?? signal.timestamp;
  }

  /** Base asset symbol from an "BASE/QUOTE" instrument (falls back to the whole string). */
  private baseAsset(instrument: string): string {
    return instrument.split("/")[0] ?? instrument;
  }

  private resolvePending(signal: MarketHintSignal, ticker: Ticker): Resolution | null {
    if (signal.orderKind === OrderKind.market) {
      const price = this.fillPolicy.resolvePending(signal, ticker);
      return price == null ? null : { price, liquidity: "taker" };
    }
    // A tick without a last trade cannot resolve a price-triggered order, and
    // must not advance a trailing extreme either.
    const last = ticker.last;
    if (last == null || Number.isNaN(last)) return null;
    if (signal.orderKind === OrderKind.limit) {
      const price = triggerLimit(signal, last);
      return price == null ? null : { price, liquidity: "maker" };
    }
    if (signal.orderKind === OrderKind.stop) {
      const price = triggerStop(signal, last);
      return price == null ? null : { price, liquidity: "taker" };
    }
    if (signal.orderKind === OrderKind.stopTrailing) {
      const state = this.trailState.get(signal);
      if (!state) return null;
      const price = triggerTrailing(signal, last, state);
      return price == null ? null : { price, liquidity: "taker" };
    }
    return null;
  }

  private execute(
    signal: MarketHintSignal,
    basePrice: number,
    liquidity: Liquidity,
  ): void {
    if (signal.kind === MarketHintKind.buy) {
      this.processBuy(signal, basePrice, liquidity);
    } else if (signal.kind === MarketHintKind.sell) {
      this.processSell(signal, basePrice, liquidity);
    } else {
      this.ignore(signal, "invalid-order");
    }
  }

  private processBuy(
    signal: MarketHintSignal,
    basePrice: number,
    liquidity: Liquidity,
  ): void {
    if (this.status !== ExecutionStatus.IDLE) {
      this.ignore(signal, "already-long");
      return;
    }
    if (this.balance <= 0) {
      this.ignore(signal, "no-funds");
      return;
    }

    const buyFraction = clampPercent(this.config.buyPercent ?? 100) / 100;
    if (buyFraction <= 0) {
      this.ignore(signal, "zero-size");
      return;
    }

    // Every fill slips, a limit's too: the Java engine's simulation applies the slippage model to
    // each execution and reads the liquidity only for the fee
    const effectivePrice = this.slippageModel.adjust({
      side: "buy",
      signalPrice: basePrice,
      ticker: this.currentTicker,
    });

    // The model returns the fee in QUOTE terms ("how much"). The pipeline then
    // routes it onto the leg `feeLeg` selects ("in which asset").
    const allInCash = this.balance * buyFraction;
    const allInBase = allInCash / effectivePrice;

    let baseGross: number;
    let cost: number;
    let feeAsset: string;

    if (this.feeLeg === FeeLeg.QUOTE) {
      // Reserve the quote buy fee out of the all-in cash at sizing so
      // cost + fee == allInCash (zero residual, no negative balance).
      // base = allInBase / (1 + buyRate); the rate comes from the model's
      // quote fee on the un-reserved sizing.
      const probeQuoteFee = this.feeModel.compute({
        price: effectivePrice,
        baseAmount: allInBase,
        counterAmount: allInCash,
        side: "buy",
        liquidity,
        timestamp: signal.timestamp,
        instrument: signal.instrument,
      });
      const buyRate = allInCash > 0 ? probeQuoteFee / allInCash : 0;
      baseGross = allInBase / (1 + buyRate);
      cost = baseGross * effectivePrice;
      const quoteFee = cost * buyRate;

      this.enterQuoteBuyFee = quoteFee;
      this.enterResult = new ExecutionResult(
        effectivePrice,
        baseGross,
        cost,
        quoteFee,
      );
      // Whole all-in cash leaves the balance: cost on base + reserved quote fee.
      this.balance -= cost + quoteFee;
      feeAsset = this.config.currency;
      this.addFee(feeAsset, quoteFee);
    } else {
      // RECEIVED: fee in BASE. All cash buys base; the base-denominated fee is
      // taken from the received base, so the position holds the net base.
      baseGross = allInBase;
      cost = allInCash;
      const quoteFee = this.feeModel.compute({
        price: effectivePrice,
        baseAmount: baseGross,
        counterAmount: cost,
        side: "buy",
        liquidity,
        timestamp: signal.timestamp,
        instrument: signal.instrument,
      });
      const baseFee = quoteFee / effectivePrice;

      this.enterQuoteBuyFee = 0;
      this.enterResult = new ExecutionResult(
        effectivePrice,
        baseGross,
        cost,
        baseFee,
      );
      this.balance -= cost;
      feeAsset = this.baseAsset(signal.instrument);
      this.addFee(feeAsset, baseFee);
    }

    this.status = ExecutionStatus.EXECUTING;
    this.callback.onFilledBuy(this.enterResult);
    this.callback.onFill?.({
      instrument: signal.instrument,
      timestamp: this.fillTimestamp(signal),
      side: "buy",
      price: effectivePrice,
      baseAmount: baseGross,
      counterAmount: cost,
      fee: this.enterResult.feeAmount,
      feeAsset,
      liquidity,
      orderKind: signal.orderKind,
    });
    this.attachStopLoss(signal);
  }

  /**
   * Places the protective stop a filled entry asks for: a `stop` sell at the
   * entry's `stopPrice`, queued like any other pending order (first eligible on
   * the next tick). It carries no amount — the position it sells is whatever the
   * pipeline holds when it fires.
   */
  private attachStopLoss(entry: MarketHintSignal): void {
    const stopPrice = entry.getStopPrice();
    if (stopPrice == null) return;
    const stop = new SellSignal(entry.strategyName, entry.instrument, stopPrice)
      .setOrderKind(OrderKind.stop);
    stop.timestamp = entry.timestamp;
    this.attachedStops.add(stop);
    this.pending.push(stop);
  }

  /**
   * Drops every queued `stop` order for the instrument, whatever its side. One the strategy sent
   * is reported as cancelled; the stop an entry attached is not.
   */
  private cancelStops(instrument: string): void {
    this.pending = this.pending.filter((p) => {
      if (p.orderKind !== OrderKind.stop || p.instrument !== instrument) return true;
      this.ignore(p, "cancelled");
      return false;
    });
  }

  private processSell(
    signal: MarketHintSignal,
    basePrice: number,
    liquidity: Liquidity,
  ): void {
    if (this.status !== ExecutionStatus.EXECUTING || !this.enterResult) {
      this.ignore(signal, "no-position");
      return;
    }

    // Every fill slips, a limit's too: the Java engine's simulation applies the slippage model to
    // each execution and reads the liquidity only for the fee
    const effectivePrice = this.slippageModel.adjust({
      side: "sell",
      signalPrice: basePrice,
      ticker: this.currentTicker,
    });

    // The position holds the entry's NET base under RECEIVED (the buy fee was
    // taken from the received base) and the gross base under QUOTE.
    const positionBase =
      this.feeLeg === FeeLeg.QUOTE
        ? this.enterResult.baseAmount
        : this.enterResult.getNetBaseAmount();
    const baseToSell = positionBase;
    const grossAmount = baseToSell * effectivePrice;
    // Sell fee is QUOTE-denominated on both legs.
    const feeAmount = this.feeModel.compute({
      price: effectivePrice,
      baseAmount: baseToSell,
      counterAmount: grossAmount,
      side: "sell",
      liquidity,
      timestamp: signal.timestamp,
      instrument: signal.instrument,
    });
    const netAmount = grossAmount - feeAmount;
    this.addFee(this.config.currency, feeAmount);

    const sellResult = new ExecutionResult(
      effectivePrice,
      baseToSell,
      grossAmount,
      feeAmount,
    );
    this.callback.onFilledSell(sellResult);
    this.callback.onFill?.({
      instrument: signal.instrument,
      timestamp: this.fillTimestamp(signal),
      side: "sell",
      price: effectivePrice,
      baseAmount: baseToSell,
      counterAmount: grossAmount,
      fee: feeAmount,
      feeAsset: this.config.currency,
      liquidity,
      orderKind: signal.orderKind,
    });

    // Yield: the entry's cost basis in, realized proceeds out. Under QUOTE the
    // buy fee left the cash separately, so fold it into the realized output
    // (it's a realized cost of this round trip). Under RECEIVED
    // the buy fee was paid in base and is already reflected in the smaller net
    // base sold, so there is no quote buy fee to subtract here.
    const invested = this.enterResult.counterAmount;
    const buyFeeShare = this.enterQuoteBuyFee;
    const output = netAmount - buyFeeShare;
    const strategyYield = new DefaultStrategyYield(
      signal.instrument,
      this.config.currency,
      invested,
      output,
      this.strategy.yieldTimestamp(signal.timestamp),
    );

    // The amount gained or lost, as the Java engine counts it
    this.strategy.stats.countYield(output - invested);
    this.callback.onYield(strategyYield);

    this.balance += netAmount;

    this.enterResult = null;
    this.enterQuoteBuyFee = 0;
    this.status = ExecutionStatus.IDLE;
    this.cancelStops(signal.instrument);
  }
}

/** A trailing stop needs a percent, or an absolute distance above zero, to trail by. */
function trailsBy(signal: MarketHintSignal): boolean {
  return signal.getTrailPercent() != null || (signal.getTrailDistance() ?? 0) > 0;
}

function triggerLimit(signal: MarketHintSignal, last: number): number | null {
  const limitPrice = signal.price;
  const fires =
    signal.kind === MarketHintKind.buy ? last <= limitPrice : last >= limitPrice;
  return fires ? limitPrice : null;
}

function triggerStop(signal: MarketHintSignal, last: number): number | null {
  const stopPrice = signal.price;
  const fires =
    signal.kind === MarketHintKind.buy ? last >= stopPrice : last <= stopPrice;
  return fires ? stopPrice : null;
}

/**
 * Trailing stop resolver. Advances the running extreme with `last` in place,
 * then checks whether `last` reached the trigger level computed from it.
 *
 * - Sell trail: `extreme` tracks the running peak; the level is
 *   `extreme - offset`. Fires when `last <= level`. Typical use: stop-loss that
 *   follows a long position up.
 * - Buy trail: `extreme` tracks the running trough; the level is
 *   `extreme + offset`. Fires when `last >= level`. Useful for dynamic breakout
 *   entries after a pullback.
 *
 * `offset` is `trailPercent` percent of the extreme, or the absolute
 * `trailDistance` when no percent is set. The extreme only ratchets in the
 * favorable direction, so once the trail is tightened it never loosens, and a
 * price that sets a new extreme moves the level with it instead of firing.
 */
function triggerTrailing(
  signal: MarketHintSignal,
  last: number,
  state: TrailState,
): number | null {
  const percent = signal.getTrailPercent();
  const distance = signal.getTrailDistance() ?? 0;
  if (percent == null && distance <= 0) return null;

  const sell = signal.kind === MarketHintKind.sell;
  state.extreme = sell
    ? Math.max(state.extreme, last)
    : Math.min(state.extreme, last);
  const offset = percent != null ? state.extreme * (percent / 100) : distance;
  const level = sell ? state.extreme - offset : state.extreme + offset;
  const fires = sell ? last <= level : last >= level;
  return fires ? level : null;
}

function resolveFeeModel(config: BacktestConfig): FeeModel {
  if (config.feeModel) return config.feeModel;
  // Canonical both-side fees: each side defaults to the shared `feeRate` (engine
  // parity). A per-side override narrows just that side.
  const buyRate = config.feeRateBuy ?? config.feeRate;
  const sellRate = config.feeRateSell ?? config.feeRate;
  return new FixedFeeModel(buyRate, sellRate);
}

function resolveSlippageModel(config: BacktestConfig): SlippageModel {
  if (config.slippageModel) return config.slippageModel;
  const bps = config.slippageBps ?? 0;
  return bps === 0 ? new NoSlippage() : new FixedBpsSlippage(bps);
}

function clampPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}
