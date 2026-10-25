import type { TickerValueSource } from "./TickerValueSource";
import type { KlineValueSource } from "./KlineValueSource";

/**
 * Union of all market snapshot value sources.
 * Mirrors com.wualabs.qtsurfer.engine.indicators.core.MarketSnapshotValueSource (sealed interface).
 *
 * Use TickerValueSource for strategies that read ticker fields (bid/ask/last/vwap/...).
 * Use KlineValueSource for strategies that read OHLCV kline fields.
 */
export type MarketSnapshotValueSource = TickerValueSource | KlineValueSource;
