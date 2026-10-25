/**
 * Ticker market data interface. The engine's own type: a price or size is `null` when the source does not report it.
 */
export interface Ticker {
  instrument: string;
  open: number | null;
  high: number | null;
  low: number | null;
  last: number | null;
  bid: number | null;
  bidSize: number | null;
  ask: number | null;
  askSize: number | null;
  volume: number | null;
  quoteVolume: number | null;
  vwap: number | null;
  percentageChange: number | null;
  timestamp: number;
}
