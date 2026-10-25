import { CurrencyHelper } from "@qtsurfer/core";
import type { Asset } from "@qtsurfer/core";

/**
 * Whitelist/blacklist asset filtering with wildcard (`¿`) pattern support.
 * Port of com.wualabs.qtsurfer.engine.strategy.StrategyCurrencyFilter
 *
 * A list that was never set lets everything through (whitelist) or nothing out (blacklist); a list
 * that was set, even to `[]`, is enforced: an empty whitelist accepts nothing.
 */
export class StrategyCurrencyFilter {
  private whitelistedCurrencies: ReadonlySet<string> | undefined;
  private whitelistedCurrencyPatterns: ReadonlySet<string> | undefined;
  private blacklistedCurrencies: ReadonlySet<string> | undefined;
  private blacklistedCurrencyPatterns: ReadonlySet<string> | undefined;

  /** Plain whitelisted asset codes, upper-cased; `undefined` until a whitelist is set. */
  getWhitelistedCurrencies(): ReadonlySet<string> | undefined {
    return this.whitelistedCurrencies;
  }

  getWhitelistedCurrencyPatterns(): ReadonlySet<string> | undefined {
    return this.whitelistedCurrencyPatterns;
  }

  /** Plain blacklisted asset codes, upper-cased; `undefined` until a blacklist is set. */
  getBlacklistedCurrencies(): ReadonlySet<string> | undefined {
    return this.blacklistedCurrencies;
  }

  getBlacklistedCurrencyPatterns(): ReadonlySet<string> | undefined {
    return this.blacklistedCurrencyPatterns;
  }

  setWhitelistedCurrencies(currencyCodes: readonly string[]): void {
    this.whitelistedCurrencies = CurrencyHelper.toSet(currencyCodes);
    this.whitelistedCurrencyPatterns = CurrencyHelper.toPatternSet(currencyCodes);
  }

  setBlacklistedCurrencies(currencyCodes: readonly string[]): void {
    this.blacklistedCurrencies = CurrencyHelper.toSet(currencyCodes);
    this.blacklistedCurrencyPatterns = CurrencyHelper.toPatternSet(currencyCodes);
  }

  accept(asset: Asset): boolean {
    if (this.isBlacklisted(asset)) {
      return false;
    }
    return this.isWhitelisted(asset);
  }

  isWhitelisted(asset: Asset): boolean {
    if (this.whitelistedCurrencies === undefined) {
      if (
        this.whitelistedCurrencyPatterns === undefined ||
        this.whitelistedCurrencyPatterns.size === 0
      ) {
        return true;
      }
      return CurrencyHelper.matchPattern(asset, this.whitelistedCurrencyPatterns);
    }
    return (
      this.whitelistedCurrencies.has(asset.code) ||
      CurrencyHelper.matchPattern(asset, this.whitelistedCurrencyPatterns)
    );
  }

  isBlacklisted(asset: Asset): boolean {
    if (this.blacklistedCurrencies === undefined) {
      if (
        this.blacklistedCurrencyPatterns === undefined ||
        this.blacklistedCurrencyPatterns.size === 0
      ) {
        return false;
      }
      return CurrencyHelper.matchPattern(asset, this.blacklistedCurrencyPatterns);
    }
    return (
      this.blacklistedCurrencies.has(asset.code) ||
      CurrencyHelper.matchPattern(asset, this.blacklistedCurrencyPatterns)
    );
  }
}
