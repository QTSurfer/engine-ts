/**
 * Manages strategy stats and performance.
 * Port of com.wualabs.qtsurfer.engine.strategy.StrategyStats
 */
export class StrategyStats {
  private totalProfitYield = 0;
  private totalProfitYieldCount = 0;
  private totalLossYield = 0;
  private totalLossYieldCount = 0;
  private instrumentUpdateCount = 0;

  instrumentUpdate(): this {
    this.instrumentUpdateCount++;
    return this;
  }

  getInstrumentUpdates(): number {
    return this.instrumentUpdateCount;
  }

  countYield(yieldValue: number): this {
    if (yieldValue >= 0) {
      this.totalProfitYield += yieldValue;
      this.totalProfitYieldCount++;
    } else {
      this.totalLossYield += yieldValue;
      this.totalLossYieldCount++;
    }
    return this;
  }

  getTotalProfitYields(): number {
    return this.totalProfitYieldCount;
  }

  getTotalLossYields(): number {
    return this.totalLossYieldCount;
  }

  getTotalYields(): number {
    return this.totalProfitYieldCount + this.totalLossYieldCount;
  }

  getNetYield(): number {
    return this.totalProfitYield + this.totalLossYield;
  }

  getTotalProfitYield(): number {
    return this.totalProfitYield;
  }

  getTotalLossYield(): number {
    return this.totalLossYield;
  }

  getPnLRatio(): number {
    const profits = this.totalProfitYieldCount;
    const losses = this.totalLossYieldCount;
    if (profits === losses) return 0;
    if (losses === 0) return 1;
    if (profits === 0) return -1;
    return profits > losses ? profits / losses : -(losses / profits);
  }
}
