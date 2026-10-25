import { DisplayHint, type InstrumentGroupRTIndicator, type RTIndicator } from "@qtsurfer/indicators";
import { InfoStrategySignal } from "$signal/InfoStrategySignal";
import { OrderKind, type MarketHintSignal } from "$signal/MarketHintSignal";
import type { StrategySignal } from "$signal/StrategySignal";
import { StrategyEventType } from "$event/StrategyEventType";
import type { StrategyYield } from "$yield/StrategyYield";
import type {
  EquityPoint,
  Fill,
  IgnoredReason,
  IndicatorSeries,
  RunOptions,
  SessionMarker,
  SessionOutput,
  Trade,
} from "./SessionOutput";

/** The indicator group an instrument has, if its strategy has built one yet. */
export type IndicatorGroupLookup = (instrument: string) => InstrumentGroupRTIndicator | undefined;

/**
 * Collects the {@link SessionOutput} of one run as the run replays: the pipeline's fills and
 * yields, the strategy's signals and, on request, the indicators after each data point. It reads
 * what the run already produces and changes none of it.
 */
export class SessionRecorder {
  private readonly fills: Fill[] = [];
  private readonly trades: Trade[] = [];
  private readonly markers: SessionMarker[] = [];
  // The marker of each buy/sell signal, so that the pipeline's report of a dropped signal (now or
  // when a queued order resolves) lands on that signal's own marker
  private readonly markerOf = new WeakMap<MarketHintSignal, SessionMarker>();
  private readonly indicators: IndicatorRecorder | null;
  // A new entry only fills from idle, so the latest buy is the entry of every sell after it,
  // partial sells included
  private entry: Fill | null = null;
  private exit: Fill | null = null;

  constructor(options: RunOptions | undefined, findGroup: IndicatorGroupLookup) {
    this.indicators = IndicatorRecorder.create(options?.recordIndicators, findGroup);
  }

  fill(fill: Fill): void {
    this.fills.push(fill);
    if (fill.side === "buy") {
      this.entry = fill;
    } else {
      this.exit = fill;
    }
  }

  /** A closed yield: the pipeline reports the exit fill that closed it just before. */
  yield(strategyYield: StrategyYield): void {
    const { entry, exit } = this;
    this.exit = null;
    if (entry == null || exit == null) return;
    this.trades.push({
      instrument: strategyYield.instrument,
      entryTime: entry.timestamp,
      entryPrice: entry.price,
      exitTime: exit.timestamp,
      exitPrice: exit.price,
      baseAmount: exit.baseAmount,
      input: strategyYield.input,
      output: strategyYield.output,
      pnl: strategyYield.getYield(),
      pnlPercent: strategyYield.getYieldPercent(),
      exitKind: exit.orderKind,
    });
  }

  hint(signal: MarketHintSignal): void {
    const price = Number.isFinite(signal.price) ? signal.price : null;
    const parts: string[] = [signal.kind.toUpperCase()];
    if (signal.orderKind !== OrderKind.market) parts.push(signal.orderKind);
    if (price != null) parts.push(`@ ${formatNumber(price)}`);
    const marker: SessionMarker = {
      timestamp: signal.timestamp,
      instrument: signal.instrument,
      kind: signal.kind,
      price,
      text: parts.join(" "),
      orderKind: signal.orderKind,
    };
    this.markers.push(marker);
    this.markerOf.set(signal, marker);
  }

  /** The pipeline dropped a signal without a fill: flags the marker `hint` made for it. */
  ignored(signal: MarketHintSignal, reason: IgnoredReason): void {
    const marker = this.markerOf.get(signal);
    if (marker !== undefined) marker.ignored = { reason };
  }

  /** An info signal becomes a marker; the per-tick indicator snapshot and any other signal type does not. */
  info(signal: StrategySignal): void {
    if (
      !(signal instanceof InfoStrategySignal) ||
      signal.type !== StrategyEventType.Info ||
      signal.indicatorSnapshot
    ) {
      return;
    }
    const data = toPlain(signal.properties) as Record<string, unknown>;
    const entries = Object.entries(data);
    const price = typeof data.price === "number" && Number.isFinite(data.price) ? data.price : null;
    const marker: SessionMarker = {
      timestamp: signal.timestamp,
      instrument: signal.instrument,
      kind: "info",
      price,
      text: entries.length === 0 ? "info" : formatEntries(entries),
    };
    if (entries.length > 0) marker.data = data;
    this.markers.push(marker);
  }

  /** The indicators of a data point's instrument, after the strategy has seen the point. */
  point(instrument: string, timestamp: number): void {
    this.indicators?.record(instrument, timestamp);
  }

  /**
   * `anchor` is the curve's first point (absent when there was no data); `steps` are the metrics'
   * points, one per closed trade. A step sits at the time its trade closed, the exit fill's, which
   * only moves forward: the yield's own timestamp is its signal's, and a protective stop carries
   * its entry's.
   */
  finish(anchor: EquityPoint | undefined, steps: readonly EquityPoint[]): SessionOutput {
    const equity =
      anchor === undefined
        ? []
        : [
            anchor,
            ...steps.map((step, i) => ({
              timestamp: this.trades[i]?.exitTime ?? step.timestamp,
              equity: step.equity,
            })),
          ];
    return {
      indicators: this.indicators?.series() ?? [],
      markers: this.markers,
      equity,
      trades: this.trades,
      fills: this.fills,
    };
  }
}

interface InstrumentSeries {
  readonly timestamps: number[];
  readonly byName: Map<string, IndicatorSeries>;
}

class IndicatorRecorder {
  private readonly byInstrument = new Map<string, InstrumentSeries>();

  private constructor(
    private readonly wanted: ReadonlySet<string> | null,
    private readonly findGroup: IndicatorGroupLookup,
  ) {}

  static create(
    option: RunOptions["recordIndicators"],
    findGroup: IndicatorGroupLookup,
  ): IndicatorRecorder | null {
    if (option === true) return new IndicatorRecorder(null, findGroup);
    if (Array.isArray(option) && option.length > 0) {
      return new IndicatorRecorder(new Set(option), findGroup);
    }
    return null;
  }

  record(instrument: string, timestamp: number): void {
    const group = this.findGroup(instrument);
    if (group == null) return;

    let entry = this.byInstrument.get(instrument);
    if (entry == null) {
      entry = { timestamps: [], byName: new Map() };
      this.byInstrument.set(instrument, entry);
    }
    const { timestamps, byName } = entry;
    const before = timestamps.length;
    timestamps.push(timestamp);

    group.indicators.forEachPublicable((name, indicator) => {
      if (this.wanted != null && !this.wanted.has(name)) return;
      let series = byName.get(name);
      if (series == null) {
        series = {
          instrument,
          name,
          id: indicator.getId?.() ?? name,
          display: displayOf(indicator),
          timestamps,
          // An indicator added after the first point has nothing before it
          values: new Array<number | null>(before).fill(null),
        };
        byName.set(name, series);
      }
      series.values.push(valueOf(indicator));
    });
    // An indicator that was not there this time keeps the series aligned with the timestamps
    for (const series of byName.values()) {
      if (series.values.length < timestamps.length) series.values.push(null);
    }
  }

  series(): IndicatorSeries[] {
    const all: IndicatorSeries[] = [];
    for (const entry of this.byInstrument.values()) all.push(...entry.byName.values());
    return all;
  }
}

function valueOf(indicator: RTIndicator): number | null {
  if (!indicator.isReady()) return null;
  const value = indicator.getValue();
  return Number.isFinite(value) ? value : null;
}

function displayOf(indicator: RTIndicator): IndicatorSeries["display"] {
  const hint = indicator.getDisplayHint?.();
  if (hint === DisplayHint.PERCENT) return "PERCENT";
  if (hint === DisplayHint.VOLUME) return "VOLUME";
  return "ABSOLUTE";
}

/** Maps, nested ones included, as plain objects, so a marker's data is plain JSON. */
function toPlain(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([key, item]) => [String(key), toPlain(item)]));
  }
  if (Array.isArray(value)) return value.map(toPlain);
  return value;
}

function formatEntries(entries: [string, unknown][]): string {
  return entries.map(([key, value]) => `${key}=${formatValue(value)}`).join(", ");
}

function formatValue(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${formatEntries(Object.entries(value))}}`;
  }
  return String(value);
}

/** A number as text without the float noise of a computed price (0.1 + 0.2 reads 0.3). */
function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : String(value);
}
