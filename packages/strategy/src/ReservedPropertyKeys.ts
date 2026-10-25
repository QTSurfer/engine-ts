/**
 * The property keys the Java engine registers on every strategy, which a strategy's own property
 * must not reuse. The Java QTS compiler rejects them up front (`ReservedParamKeys`); its scanner
 * skips a clashing annotated field without a word, so the engine's property wins and the author's
 * variable never receives the value.
 *
 * This is the floor `ReservedParamKeys` keeps for when it cannot probe a live strategy, plus the
 * keys the probe finds beyond it (the per-side backtest fee rates, the fee leg and the scales).
 * Unlike Java, this port does not register these keys on its strategies: they are reserved so a
 * strategy written here keeps running when it moves to the Java engine.
 */
export const RESERVED_PROPERTY_KEYS: ReadonlySet<string> = new Set([
  "amnt",
  "name",
  "enabled",
  "multiEntry",
  "multiEntryEnabled",
  "enableIndicatorsSignals",
  "lockPcnt",
  "minPcnt",
  "minGain",
  "whitelist",
  "blacklist",
  "backtestEnabled",
  "backtestFakeExecution",
  "backtestFunding",
  "backtestFeeRate",
  "backtestBuyFeeRate",
  "backtestSellFeeRate",
  "backtestFeeLeg",
  "backtestVolumeScale",
  "backtestPriceScale",
  "maxConsecutiveLosses",
  "reentryCooldownMs",
  "maxConcurrentPositions",
  "maxDailyLoss",
]);

export function isReservedPropertyKey(name: string): boolean {
  return RESERVED_PROPERTY_KEYS.has(name);
}
