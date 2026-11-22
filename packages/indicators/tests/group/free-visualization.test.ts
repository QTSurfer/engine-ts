import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { DisplayHint } from "$core/DisplayHint";
import { IndicatorMeta } from "$core/IndicatorMeta";
import { InstrumentGroupRTIndicator } from "$group/InstrumentGroupRTIndicator";

/**
 * The visualization metadata of every free indicator the builder registers, against the table the web
 * team keeps for the charts (viz/free-visualization.tsv, copied as it is from the Java engine). The
 * engine is the source of truth: when the two differ, the row is reviewed, not silently copied in either
 * direction.
 */

/** Each free factory, called the way the table's default name is built. */
const FACTORIES: Record<string, (group: InstrumentGroupRTIndicator) => unknown> = {
  ema: (g) => g.ema(20),
  hma: (g) => g.hma(20),
  kama: (g) => g.kama(),
  mma: (g) => g.mma(20),
  sma: (g) => g.sma(20),
  tema: (g) => g.tema(20),
  wma: (g) => g.wma(20),
  cci: (g) => g.cci(20),
  macd: (g) => g.macd(),
  rsi: (g) => g.rsi(14),
  stochRsi: (g) => g.stochRsi(14),
  bollinger: (g) => g.bollinger(),
  // the bandwidth derives from a Bollinger the group already has
  bollingerBandwidth: (g) => g.bollinger().bollingerBandwidth("blgr20_2"),
  bollingerPercentB: (g) => g.bollingerPercentB(),
  atr: (g) => g.atr(),
  percentVolatility: (g) => g.percentVolatility(20),
  stdDev: (g) => g.stdDev(20),
  variance: (g) => g.variance(20),
  volatility: (g) => g.volatility(20),
};

/** The table proposes INDEX for these; the engine keeps the PERCENT it has always told (a separate, announced step). */
const KEPT_AS_PERCENT: Record<string, string> = { rsi: "P", stochRsi: "P" };

/** The outputs of a row that the builder does not register in this call: the bandwidth derives from a Bollinger the group already has. */
const NOT_REGISTERED_BY_THE_CALL: Record<string, string[]> = { bollingerBandwidth: ["_", "Upper", "Lower"] };

interface Row {
  id: string;
  name: string;
  dsp: string;
  plc: string;
  rng: string;
  flo: string;
  lvl: string;
  outputs: string;
}

function rows(): Row[] {
  const text = readFileSync(new URL("../viz/free-visualization.tsv", import.meta.url), "utf8");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => {
      const [id, name, dsp, plc, rng, flo, lvl, outputs] = line.split("\t");
      return { id, name, dsp, plc, rng, flo, lvl, outputs };
    });
}

function build(id: string): InstrumentGroupRTIndicator {
  const group = new InstrumentGroupRTIndicator("BTC/USDT");
  FACTORIES[id](group);
  return group;
}

const orNull = (column: string): string | null => (column === "-" ? null : column);
const asKey = (value: string | undefined): string | null => value ?? null;

function flag(flags: string, key: string): string | null {
  for (const token of flags.split(" ")) {
    if (token.startsWith(key)) return token.slice(key.length);
  }
  return null;
}

describe("the free indicators of the builder describe themselves as the table says", () => {
  it("every factory, every output", () => {
    for (const row of rows()) {
      const group = build(row.id);
      const outputs = row.outputs.split(" | ");
      outputs.forEach((entry, i) => {
        const token = entry.trim();
        const head = token.split(" ")[0];
        const flags = token.slice(head.length).trim();
        if ((NOT_REGISTERED_BY_THE_CALL[row.id] ?? []).includes(head)) return;
        const main = i === 0;
        const suffix = main ? "" : head;
        const where = `${row.id}${main ? "" : "." + suffix}`;
        const indicator = group.getExisting(row.name + suffix);
        expect(indicator, `${where} registered as ${row.name + suffix}`).toBeDefined();
        const meta = indicator.getMeta();
        const notDrawn = flag(flags, "drw=") === "0";
        if (main || !notDrawn) {
          expect(asKey(meta.get("dsp")), `${where} dsp`).toBe(orNull(KEPT_AS_PERCENT[row.id] ?? row.dsp));
          expect(asKey(meta.get("plc")), `${where} plc`).toBe(orNull(row.plc));
          expect(asKey(meta.get("rng")), `${where} rng`).toBe(orNull(row.rng));
          expect(asKey(meta.get("flo")), `${where} flo`).toBe(orNull(row.flo));
          expect(asKey(meta.get("lvl")), `${where} lvl`).toBe(orNull(row.lvl));
        }
        expect(asKey(meta.get("sty")), `${where} sty`).toBe(flag(flags, "sty="));
        expect(asKey(meta.get("sde")), `${where} sde`).toBe(flag(flags, "sde="));
        expect(asKey(meta.get("drw")), `${where} drw`).toBe(flag(flags, "drw="));
        // a boundary says which edge it is; the Bollinger middle has always said "middle" too
        let band: string | null = flags.includes("bnd") ? suffix.toLowerCase() : null;
        if (row.id === "bollinger" && main) band = "middle";
        expect(asKey(meta.get(IndicatorMeta.BAND)), `${where} band`).toBe(band);
      });
    }
  });

  it("the table and the builder name the same factories", () => {
    expect(new Set(rows().map((row) => row.id))).toEqual(new Set(Object.keys(FACTORIES)));
  });

  it("a display hint the engine always told is never quietly changed", () => {
    for (const row of rows()) {
      if (row.id in KEPT_AS_PERCENT) {
        expect(build(row.id).getExisting(row.name).getDisplayHint(), row.id).toBe(DisplayHint.PERCENT);
      }
    }
  });

  it("a row describes the indicator of the price, not one built on another indicator", () => {
    const group = new InstrumentGroupRTIndicator("BTC/USDT");
    group.rsi(14).sma("smaOfRsi", "rsi14", 5).macd("macdOfRsi", "rsi14", 12, 26);
    // an average of the RSI is not on the price scale, so it is not drawn over the price
    expect(group.getExisting("smaOfRsi").getMeta().get("plc")).toBeUndefined();
    // a MACD oscillates around zero whatever it is built on
    expect(group.getExisting("macdOfRsi").getMeta().get("lvl")).toBe("0");
  });
});
