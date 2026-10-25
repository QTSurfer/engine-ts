import com.wualabs.qtsurfer.engine.indicators.averages.EmaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.averages.HmaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.averages.KamaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.averages.SmaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.averages.TemaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.averages.WmaRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.bollinger.BollingerBandsRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.core.RTIndicator;
import com.wualabs.qtsurfer.engine.indicators.momentum.CciRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.momentum.MacdRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.momentum.RsiRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.momentum.StochasticRsiRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.statistics.VarianceRTIndicator;
import com.wualabs.qtsurfer.engine.indicators.volatility.pro.AtrRTIndicator;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;

/**
 * The value each benchmark of benchmarks.mjs ends on in the Java engine, built as the JMH benchmark
 * of the same name builds it and fed the dataset file the runner wrote. Prints one JSON object.
 *
 * <p>Run in source-file mode with the engine's test classpath: {@code java -cp <classpath>
 * JavaValues.java <dataset.bin>}.
 */
public class JavaValues {
  private static final int SIZE = 10_000;

  public static void main(String[] args) throws Exception {
    ByteBuffer in = ByteBuffer.wrap(Files.readAllBytes(Path.of(args[0]))).order(ByteOrder.LITTLE_ENDIAN);
    double[][] series = new double[6][SIZE];
    for (double[] values : series) {
      for (int i = 0; i < SIZE; i++) {
        values[i] = in.getDouble();
      }
    }
    double[] prices = series[0];
    double[] highs = series[2];
    double[] lows = series[3];
    double[] closes = series[4];

    Map<String, Double> values = new LinkedHashMap<>();
    values.put("rtEma", last(new EmaRTIndicator(14), prices));
    values.put("rtSma", last(new SmaRTIndicator(20), prices));
    values.put("rtTema", last(new TemaRTIndicator(20), prices));
    values.put("rtMacd", last(new MacdRTIndicator(null, 12, 26), prices));
    values.put("rtKama", last(new KamaRTIndicator(10, 2, 30), prices));
    values.put("rtRsi", last(new RsiRTIndicator(14), prices));
    values.put("rtStochRsi", last(new StochasticRsiRTIndicator(14), prices));
    values.put("rtCci", last(new CciRTIndicator(20), prices));
    values.put("rtHma", last(new HmaRTIndicator(20), prices));
    values.put("rtBollinger", last(new BollingerBandsRTIndicator(20, 2.0), prices));
    values.put(
        "rtWma",
        last(new com.wualabs.qtsurfer.engine.indicators.averages.pro.WmaRTIndicator(20), prices));
    values.put("baseWma20", last(new WmaRTIndicator(20), prices));
    AtrRTIndicator atr = new AtrRTIndicator(14);
    for (int i = 0; i < SIZE; i++) {
      atr.updateOhlc(highs[i], lows[i], closes[i]);
    }
    values.put("proAtr14", atr.getValue());
    values.put("baseVariance20", last(new VarianceRTIndicator(20).withAverageSample(false), prices));

    StringJoiner json = new StringJoiner(", ", "{", "}");
    values.forEach((name, value) -> json.add("\"" + name + "\": " + toJson(value)));
    System.out.println(json);
  }

  private static double last(RTIndicator indicator, double[] prices) {
    double last = 0;
    for (double price : prices) {
      last = indicator.update(price);
    }
    return last;
  }

  /** Double.toString round-trips; JSON has no NaN or infinities, so those travel as strings. */
  private static String toJson(double value) {
    return Double.isFinite(value) ? Double.toString(value) : "\"" + value + "\"";
  }
}
