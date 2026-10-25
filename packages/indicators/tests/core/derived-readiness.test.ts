import { describe, it, expect } from "vitest";
import { KlineValueSource, TickerValueSource } from "@qtsurfer/core";
import { SmaRTIndicator } from "$averages/SmaRTIndicator";
import { EmaRTIndicator } from "$averages/EmaRTIndicator";
import { MmaRTIndicator } from "$averages/MmaRTIndicator";
import { BollingerBandsRTIndicator } from "$bollinger/BollingerBandsRTIndicator";
import type { RTIndicator } from "$core/RTIndicator";
import { CountRTIndicator } from "$helpers/CountRTIndicator";
import { GainRTIndicator } from "$helpers/GainRTIndicator";
import { LossRTIndicator } from "$helpers/LossRTIndicator";
import { MaxRTIndicator } from "$helpers/MaxRTIndicator";
import { MinRTIndicator } from "$helpers/MinRTIndicator";
import { OnChangeRTIndicator } from "$helpers/OnChangeRTIndicator";
import { PercentChangePeriodRTIndicator } from "$helpers/PercentChangePeriodRTIndicator";
import { PredicatePeriodCounterRTIndicator } from "$helpers/PredicatePeriodCounterRTIndicator";
import { RateChangeRTIndicator } from "$helpers/RateChangeRTIndicator";
import { WindowTimeRTIndicator } from "$helpers/WindowTimeRTIndicator";
import { RsiRTIndicator } from "$indicators/RsiRTIndicator";
import { StochasticRsiRTIndicator } from "$indicators/StochasticRsiRTIndicator";
import { KlineRTIndicator } from "$group/KlineRTIndicator";
import { TickerRTIndicator } from "$group/TickerRTIndicator";
import { ClampPredicateRTIndicator } from "$numeric/ClampPredicateRTIndicator";
import { ClampRTIndicator } from "$numeric/ClampRTIndicator";
import { ConditionalRTIndicator } from "$numeric/ConditionalRTIndicator";
import { PredicateRTIndicator } from "$numeric/PredicateRTIndicator";
import { RoundRTIndicator } from "$numeric/RoundRTIndicator";
import { SumRTIndicator } from "$numeric/SumRTIndicator";
import { TransformRTIndicator } from "$numeric/TransformRTIndicator";
import { ValueRTIndicator } from "$numeric/ValueRTIndicator";
import { StandardDeviationRTIndicator } from "$statistics/StandardDeviationRTIndicator";
import { VarianceRTIndicator } from "$statistics/VarianceRTIndicator";

/**
 * An indicator derived from another one is ready when that one is: it must not report ready while
 * the source it reads is still warming up. The two base classes every wrapper hangs from carry the
 * rule, so it is pinned here once for the whole family, with a source that warms up more slowly than
 * any warm-up the wrappers have of their own. The classes that combine several sources, or publish
 * a view of a parent, have their cases next to their other tests.
 */

/** The source is a 5-period SMA: ready from its fifth update. Every wrapper below warms up faster. */
const SOURCE_WARMUP = 5;
const TICKS = 12;

const derivedFromOneSource: [string, (source: RTIndicator) => RTIndicator][] = [
  // AbstractDecorableRTIndicator: a value derived by a function of the source
  ["transform", (source) => TransformRTIndicator.plus(source, 1)],
  ["clamp", (source) => new ClampRTIndicator(source, 0, 1000)],
  ["clampPredicate", (source) => new ClampPredicateRTIndicator(source, (v) => v > 1000, 1000)],
  ["predicate", (source) => PredicateRTIndicator.greatThan(source, 0)],
  ["round", (source) => new RoundRTIndicator(source, 2)],
  ["sum", (source) => new SumRTIndicator(source)],
  ["predicatePeriodCounter", (source) => new PredicatePeriodCounterRTIndicator(source, (v) => v > 0)],
  [
    "conditional",
    (source) => new ConditionalRTIndicator(source, (i) => i.getValue() > 0, new ValueRTIndicator(1)),
  ],
  ["conditionalOfValues", (source) => ConditionalRTIndicator.positive(source)],
  // AbstractDecorableIncrementalRTIndicator: an indicator fed by the source's output
  ["sma", (source) => new SmaRTIndicator(2, source)],
  ["smaNonPeriodic", (source) => new SmaRTIndicator(source)],
  ["ema", (source) => new EmaRTIndicator(2, source)],
  ["mma", (source) => new MmaRTIndicator(2, source)],
  ["rsi", (source) => new RsiRTIndicator(2, source)],
  ["stochasticRsi", (source) => new StochasticRsiRTIndicator(2, source)],
  ["variance", (source) => new VarianceRTIndicator(source, 2)],
  ["standardDeviation", (source) => new StandardDeviationRTIndicator(source, 2)],
  ["bollinger", (source) => new BollingerBandsRTIndicator(source, 2, 2)],
  ["gain", (source) => new GainRTIndicator(source)],
  ["loss", (source) => new LossRTIndicator(source)],
  ["rateChange", (source) => new RateChangeRTIndicator(source)],
  ["max", (source) => new MaxRTIndicator(source)],
  ["min", (source) => new MinRTIndicator(source)],
  ["count", (source) => new CountRTIndicator(source)],
  ["onChange", (source) => new OnChangeRTIndicator(source)],
  ["windowTime", (source) => new WindowTimeRTIndicator("s1", source)],
  ["tickerSource", (source) => new TickerRTIndicator(TickerValueSource.Close, source)],
  ["klineSource", (source) => new KlineRTIndicator(KlineValueSource.Close, source)],
  ["percentChangePeriod", (source) => new PercentChangePeriodRTIndicator(new GainRTIndicator(source))],
];

describe("an indicator derived from another one", () => {
  it.each(derivedFromOneSource)("%s is ready exactly when its source is", (name, factory) => {
    const source = new SmaRTIndicator(SOURCE_WARMUP);
    const derived = factory(source);

    for (let tick = 1; tick <= TICKS; tick++) {
      derived.update(100 + tick);

      expect(source.isReady(), `${name} source at tick ${tick}`).toBe(tick >= SOURCE_WARMUP);
      expect(derived.isReady(), `${name} at tick ${tick}`).toBe(source.isReady());
    }
  });

  it.each(derivedFromOneSource)("%s is not ready again after a reset", (name, factory) => {
    const source = new SmaRTIndicator(SOURCE_WARMUP);
    const derived = factory(source);
    for (let tick = 1; tick <= TICKS; tick++) {
      derived.update(100 + tick);
    }
    expect(derived.isReady(), `${name} warmed up`).toBe(true);

    derived.reset();

    expect(derived.isReady(), `${name} after reset`).toBe(false);
    for (let tick = 1; tick <= TICKS; tick++) {
      derived.update(100 + tick);
      expect(derived.isReady(), `${name} at tick ${tick} after reset`).toBe(tick >= SOURCE_WARMUP);
    }
  });
});
