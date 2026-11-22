/**
 * The kinds of market data the engine manages.
 * Port of com.wualabs.qtsurfer.engine.core.MarketDataSource
 */
export enum MarketDataSource {
  /** Ticker snapshots. */
  Ticker = "Ticker",
  /** OHLCV bars. */
  KLine = "KLine",
  /** Funding rates. */
  FundingRate = "FundingRate",
}
