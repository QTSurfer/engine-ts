// The indicators measured on both sides. Each key is the name of the Java engine's JMH benchmark
// (`jmh`, in the test sources of `qtsurfer-engine-indicators-pro`) that builds the same indicator
// with the same arguments, so each row compares one algorithm in two runtimes.

export const BENCHMARKS = {
  rtEma: { label: "EMA(14)", jmh: "LibraryComparisonBenchmark.rtEma", make: (I) => new I.EmaRTIndicator(14) },
  rtSma: { label: "SMA(20)", jmh: "LibraryComparisonBenchmark.rtSma", make: (I) => new I.SmaRTIndicator(20) },
  rtTema: { label: "TEMA(20)", jmh: "LibraryComparisonBenchmark.rtTema", make: (I) => new I.TemaRTIndicator(20) },
  rtMacd: {
    label: "MACD(12,26)",
    jmh: "LibraryComparisonBenchmark.rtMacd",
    make: (I) => new I.MacdRTIndicator(null, 12, 26),
  },
  rtKama: {
    label: "KAMA(10,2,30)",
    jmh: "LibraryComparisonBenchmark.rtKama",
    make: (I) => new I.KamaRTIndicator(10, 2, 30),
  },
  rtRsi: { label: "RSI(14)", jmh: "LibraryComparisonBenchmark.rtRsi", make: (I) => new I.RsiRTIndicator(14) },
  rtStochRsi: {
    label: "StochRSI(14)",
    jmh: "LibraryComparisonBenchmark.rtStochRsi",
    make: (I) => new I.StochasticRsiRTIndicator(14),
  },
  rtCci: { label: "CCI(20)", jmh: "LibraryComparisonBenchmark.rtCci", make: (I) => new I.CciRTIndicator(20) },
  rtHma: { label: "HMA(20)", jmh: "LibraryComparisonBenchmark.rtHma", make: (I) => new I.HmaRTIndicator(20) },
  rtBollinger: {
    label: "Bollinger(20,2)",
    jmh: "LibraryComparisonBenchmark.rtBollinger",
    make: (I) => new I.BollingerBandsRTIndicator(20, 2.0),
  },
  // Java measures its O(1) WMA from the pro module here; ours is WmaIncrementalRTIndicator
  rtWma: {
    label: "WMA(20) O(1)",
    jmh: "LibraryComparisonBenchmark.rtWma",
    make: (I) => new I.WmaIncrementalRTIndicator(20),
  },
  baseWma20: { label: "WMA(20)", jmh: "IndicatorBenchmark.baseWma20", make: (I) => new I.WmaRTIndicator(20) },
  // ATR lives in the Java engine's pro module
  proAtr14: {
    label: "ATR(14)",
    jmh: "IndicatorBenchmark.proAtr14",
    input: "ohlc",
    make: (I) => new I.AtrRTIndicator(14),
  },
  baseVariance20: {
    label: "Variance(20)",
    jmh: "IndicatorBenchmark.baseVariance20",
    make: (I) => new I.VarianceRTIndicator(20).withAverageSample(false),
  },
};

/** One op, as the Java benchmark's: feeds the whole dataset to `indicator` and returns its last value. */
export function feeder(input, dataset) {
  if (input === "ohlc") {
    const { highs, lows, closes } = dataset;
    return (indicator) => {
      for (let i = 0; i < highs.length; i++) indicator.updateOhlc(highs[i], lows[i], closes[i]);
      return indicator.getValue();
    };
  }
  const { prices } = dataset;
  return (indicator) => {
    let last = 0;
    for (let i = 0; i < prices.length; i++) last = indicator.update(prices[i]);
    return last;
  };
}
