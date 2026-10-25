/**
 * Kline (OHLCV candlestick) market data interface.
 * Port of com.wualabs.qtsurfer.engine.core.Kline
 */
export interface Kline {
  instrument: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  numberOfTrades: number;
  /**
   * When the bar closed, in epoch milliseconds: the Java engine stamps a bar with its close time
   * (`closeTime`). A bar stamped with its open time instead runs every signal and yield one bar
   * early against the Java engine.
   */
  timestamp: number;
}
