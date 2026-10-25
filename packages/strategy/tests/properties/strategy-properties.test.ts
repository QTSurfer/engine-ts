import { describe, it, expect } from "vitest";
import { AbstractTickerStrategy } from "../../src/AbstractTickerStrategy";
import { ParamAxis } from "../../src/execution/sweep/ParamAxis";
import { RESERVED_PROPERTY_KEYS, isReservedPropertyKey } from "../../src/ReservedPropertyKeys";
import { StrategyPropertyDef, type StrategyPropertyInit } from "../../src/StrategyPropertyDef";
import type { PropertyAccessors } from "../../src/StrategyPropertyManager";
import type { InstrumentGroupRTIndicator } from "@qtsurfer/indicators";
import { makeTicker } from "../helpers/tickers";

/** The way a generated class declares: typed fields and one declareProperties call after super(). */
class Declared extends AbstractTickerStrategy {
  emaFast!: number;
  stopPct!: number;
  trailing!: boolean;
  label!: string;
  holdMs!: number;

  constructor() {
    super("Declared");
    this.declareProperties([
      { name: "ema.fast", description: "Fast EMA period", type: "int", defaultValue: 9, field: "emaFast", min: 2, max: 50, step: 1 },
      { name: "stop.pct", description: "Stop %", type: "double", defaultValue: 1.5, field: "stopPct" },
      { name: "trailing", type: "boolean", defaultValue: false, field: "trailing" },
      { name: "label", type: "String", field: "label" },
      { name: "hold", description: "Hold time", type: "duration", defaultValue: "60000", field: "holdMs" },
    ]);
  }
}

/** A strategy with nothing declared, whose registration methods the test can reach. */
class Probe extends AbstractTickerStrategy {
  constructor(register: (strategy: Probe) => void = () => {}) {
    super("Probe");
    register(this);
  }
  override declareProperties(properties: readonly (StrategyPropertyDef | StrategyPropertyInit)[]): string[] {
    return super.declareProperties(properties);
  }
  override registerProperty(def: StrategyPropertyDef | StrategyPropertyInit, accessors?: PropertyAccessors): StrategyPropertyDef {
    return super.registerProperty(def, accessors);
  }
}

describe("StrategyPropertyDef", () => {
  it("defaults the description to empty, reflected to true and the field to the name", () => {
    const def = new StrategyPropertyDef({ name: "rsi.period", type: "int" });
    expect(def).toMatchObject({ name: "rsi.period", description: "", type: "int", reflected: true, field: "rsi.period" });
    expect(def.defaultValue).toBeUndefined();
    expect(String(def)).toBe("rsi.period");
  });

  it("is frozen", () => {
    const def = new StrategyPropertyDef({ name: "x", type: "int" });
    expect(() => {
      (def as { name: string }).name = "y";
    }).toThrow(TypeError);
  });

  it("rejects an empty name, an unknown type and a default that does not convert", () => {
    expect(() => new StrategyPropertyDef({ name: "", type: "int" })).toThrow("property name must not be empty");
    expect(() => new StrategyPropertyDef({ name: "x", type: "float" as never })).toThrow(
      'Property "x" has an unknown type "float"',
    );
    expect(() => new StrategyPropertyDef({ name: "x", type: "int", defaultValue: "abc" })).toThrow(
      'Property "x" default "abc" is not parseable as declared type "int"',
    );
    expect(() => new StrategyPropertyDef({ name: "x", type: "double", defaultValue: "1e3" })).toThrow(
      'Property "x" default "1e3" is not parseable as declared type "double"',
    );
  });

  it("takes any default for a boolean, a String and a property that is not reflected", () => {
    expect(new StrategyPropertyDef({ name: "a", type: "boolean", defaultValue: "maybe" }).defaultValue).toBe("maybe");
    expect(new StrategyPropertyDef({ name: "b", type: "String", defaultValue: 5 }).defaultValue).toBe(5);
    expect(new StrategyPropertyDef({ name: "c", type: "int", defaultValue: "abc", reflected: false }).defaultValue).toBe("abc");
  });

  it("holds min, max and step as the sweep hints, which a ParamAxis takes as they are", () => {
    const def = new Declared().getPropertyDef("ema.fast")!;
    expect(ParamAxis.fromHints(def.name, def).values().slice(0, 3)).toEqual([2, 3, 4]);
    expect(new StrategyPropertyDef({ name: "x", type: "int" })).toMatchObject({ min: undefined, max: undefined, step: undefined });
  });
});

describe("registering and listing properties", () => {
  it("lists nothing on a strategy that declares nothing", () => {
    expect(new Probe().getPropertyDefs()).toEqual([]);
  });

  it("lists the definitions in the order they were registered", () => {
    const strategy = new Declared();
    expect(strategy.getPropertyDefs().map((def) => def.name)).toEqual(["ema.fast", "stop.pct", "trailing", "label", "hold"]);
    expect(strategy.getPropertyDef("stop.pct")).toMatchObject({ description: "Stop %", type: "double", defaultValue: 1.5 });
    expect(strategy.getPropertyDef("nope")).toBeUndefined();
  });

  it("lists a base class's properties before the subclass's", () => {
    class Base extends AbstractTickerStrategy {
      constructor(name = "Base") {
        super(name);
        this.declareProperties([{ name: "base.a", type: "int", field: "a" }]);
      }
    }
    class Leaf extends Base {
      constructor() {
        super("Leaf");
        this.declareProperties([{ name: "leaf.b", type: "int", field: "b" }]);
      }
    }
    expect(new Leaf().getPropertyDefs().map((def) => def.name)).toEqual(["base.a", "leaf.b"]);
  });

  it("registers one property and returns its definition", () => {
    const probe = new Probe();
    const def = probe.registerProperty({ name: "k", type: "int", field: "k" });
    expect(probe.getPropertyDefs()).toEqual([def]);
    expect(def).toBeInstanceOf(StrategyPropertyDef);
  });

  it("refuses to register a name twice, with Java's message", () => {
    const probe = new Probe((p) => p.registerProperty({ name: "k", type: "int" }, { set: () => {} }));
    expect(() => probe.registerProperty({ name: "k", type: "double" })).toThrow("Already registered property info with name k");
  });

  it("refuses to register a reserved engine key, with Java's message", () => {
    const probe = new Probe();
    expect(() => probe.registerProperty({ name: "minGain", type: "double" })).toThrow(
      "Already registered property info with name minGain",
    );
    expect(probe.getPropertyDefs()).toEqual([]);
  });

  it("declares what it can and skips, silently, a name already declared or reserved, as the Java scan does", () => {
    const probe = new Probe();
    const skipped = probe.declareProperties([
      { name: "a", type: "int", field: "a" },
      { name: "a", type: "double", field: "a2", description: "again" },
      { name: "enabled", type: "boolean", field: "on" },
      { name: "b", type: "int", field: "b" },
    ]);
    expect(skipped).toEqual(["a", "enabled"]);
    expect(probe.getPropertyDefs().map((def) => `${def.name}:${def.type}`)).toEqual(["a:int", "b:int"]);
  });

  it("does not register the reserved keys: a setProperty on one is still a plain map write", () => {
    const strategy = new Declared();
    expect(strategy.getPropertyDef("minGain")).toBeUndefined();
    expect(strategy.setProperty("minGain", 5)).toBe(false);
    expect(strategy.getProperty("minGain")).toBe(5);
    expect(strategy.getMinGain()).toBe(0);
  });
});

describe("the reserved keys", () => {
  it("hold the floor the Java QTS compiler keeps for its probe, and what the probe finds beyond it", () => {
    const javaFloor = [
      "amnt", "name", "enabled", "multiEntry", "multiEntryEnabled", "enableIndicatorsSignals", "lockPcnt", "minPcnt",
      "minGain", "whitelist", "blacklist", "backtestEnabled", "backtestFakeExecution", "backtestFunding",
      "backtestFeeRate", "maxConsecutiveLosses", "reentryCooldownMs", "maxConcurrentPositions", "maxDailyLoss",
    ];
    const probed = ["backtestBuyFeeRate", "backtestSellFeeRate", "backtestFeeLeg", "backtestVolumeScale", "backtestPriceScale"];
    expect([...RESERVED_PROPERTY_KEYS].sort()).toEqual([...javaFloor, ...probed].sort());
    expect(isReservedPropertyKey("maxDailyLoss")).toBe(true);
    expect(isReservedPropertyKey("ema.fast")).toBe(false);
  });
});

describe("setting a property", () => {
  it("writes the converted value to the field and the strategy reads it back", () => {
    const strategy = new Declared();
    expect(strategy.setProperty("ema.fast", "14")).toBe(true);
    expect(strategy.emaFast).toBe(14);
    expect(strategy.getProperty("ema.fast")).toBe(14);
    expect(strategy.hasProperty("ema.fast")).toBe(true);
  });

  it("converts to each declared type", () => {
    const strategy = new Declared();
    strategy.setProperty("ema.fast", 21.9);
    strategy.setProperty("stop.pct", "2.5");
    strategy.setProperty("trailing", "TRUE");
    strategy.setProperty("label", "slow");
    strategy.setProperty("hold", "1500.9");
    expect([strategy.emaFast, strategy.stopPct, strategy.trailing, strategy.label, strategy.holdMs]).toEqual([21, 2.5, true, "slow", 1500]);
  });

  it("does not apply a value that does not convert, and says so", () => {
    const strategy = new Declared();
    strategy.setProperty("ema.fast", 14);
    expect(strategy.setProperty("ema.fast", "fast")).toBe(false);
    expect(strategy.setProperty("stop.pct", true)).toBe(false);
    expect(strategy.setProperty("label", 5)).toBe(false);
    expect(strategy.emaFast).toBe(14);
    expect(strategy.getProperty("ema.fast")).toBe(14);
    expect(strategy.stopPct).toBe(1.5);
    expect(strategy.label).toBeUndefined();
  });

  it("does not check a value against min, max and step: they are hints", () => {
    const strategy = new Declared();
    expect(strategy.setProperty("ema.fast", 500)).toBe(true);
    expect(strategy.emaFast).toBe(500);
    expect(strategy.setProperty("ema.fast", 2.5)).toBe(true);
    expect(strategy.emaFast).toBe(2);
  });

  it("keeps a name nobody registered in the map, as before, and returns false", () => {
    const strategy = new Declared();
    expect(strategy.setProperty("typo", "x")).toBe(false);
    expect(strategy.hasProperty("typo")).toBe(true);
    expect(strategy.getProperty("typo")).toBe("x");
    expect(strategy.hasProperty("never")).toBe(false);
    expect(strategy.getProperty("never")).toBeUndefined();
    const object = { a: 1 };
    strategy.setProperty("obj", object);
    expect(strategy.getProperty("obj")).toBe(object);
  });

  it("refuses a null or undefined key or value, as Java's @NonNull does", () => {
    const strategy = new Declared();
    expect(() => strategy.setProperty("ema.fast", null)).toThrow(new TypeError("value must not be null"));
    expect(() => strategy.setProperty("ema.fast", undefined)).toThrow(new TypeError("value must not be null"));
    expect(() => strategy.setProperty(undefined as never, 1)).toThrow(new TypeError("key must not be null"));
  });

  it("keeps the value of a property that is not reflected in the map, as given", () => {
    class Plain extends AbstractTickerStrategy {
      note = "from the class";
      constructor() {
        super("Plain");
        this.declareProperties([{ name: "note", type: "int", defaultValue: "abc", reflected: false, field: "note" }]);
      }
    }
    const strategy = new Plain();
    expect(strategy.getProperty("note")).toBe("abc");
    expect(strategy.setProperty("note", "not a number")).toBe(true);
    expect(strategy.getProperty("note")).toBe("not a number");
    expect(strategy.note).toBe("from the class");
  });

  it("applyProperty is setProperty under Java's name", () => {
    const strategy = new Declared();
    expect(strategy.applyProperty("ema.fast", "30")).toBe(true);
    expect(strategy.emaFast).toBe(30);
  });
});

describe("how a value reaches the strategy", () => {
  it("goes through a setter that the strategy has, which may validate", () => {
    class Clamped extends AbstractTickerStrategy {
      limit = 0;
      calls = 0;
      constructor() {
        super("Clamped");
        this.declareProperties([{ name: "limit", type: "int", field: "limit" }]);
      }
      setLimit(limit: number): void {
        this.calls++;
        this.limit = Math.min(limit, 10);
      }
    }
    const strategy = new Clamped();
    strategy.setProperty("limit", "50");
    expect(strategy.calls).toBe(1);
    expect(strategy.limit).toBe(10);
    // what the strategy holds, where Java's map would say 50
    expect(strategy.getProperty("limit")).toBe(10);
  });

  it("goes through an accessor pair, with nothing in the strategy named like the property", () => {
    let held: unknown;
    const probe = new Probe((p) =>
      p.registerProperty({ name: "depth", type: "int" }, { get: () => held, set: (value) => void (held = value) }),
    );
    expect(probe.setProperty("depth", "7")).toBe(true);
    expect(held).toBe(7);
    expect(probe.getProperty("depth")).toBe(7);
    held = 9;
    expect(probe.getProperty("depth")).toBe(9);
  });

  it("answers with the value last applied when an accessor pair has no getter", () => {
    let seen: unknown;
    const probe = new Probe((p) => p.registerProperty({ name: "depth", type: "int" }, { set: (value) => void (seen = value) }));
    probe.setProperty("depth", 4);
    expect(seen).toBe(4);
    expect(probe.getProperty("depth")).toBe(4);
  });

  it("reports a setter that throws with the property, the value it was given and the reason", () => {
    class Picky extends AbstractTickerStrategy {
      limit = 0;
      constructor() {
        super("Picky");
        this.declareProperties([{ name: "limit", type: "int", field: "limit" }]);
      }
      setLimit(limit: number): void {
        if (limit > 10) throw new RangeError("too high");
        this.limit = limit;
      }
    }
    const strategy = new Picky();
    let thrown: unknown;
    try {
      strategy.setProperty("limit", "99");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toEqual(new Error("Failed to apply property 'limit' = 99: too high"));
    expect((thrown as Error).cause).toBeInstanceOf(RangeError);
    expect(strategy.limit).toBe(0);
    expect(strategy.hasProperty("limit")).toBe(false);
  });

  it("writes a field the class declares without emitting it, as some compile targets do", () => {
    const probe = new Probe((p) => p.declareProperties([{ name: "k", type: "int", field: "kay" }]));
    expect(probe.setProperty("k", "3")).toBe(true);
    expect((probe as unknown as { kay: number }).kay).toBe(3);
    expect(probe.getProperty("k")).toBe(3);
  });

  it("reports a field that cannot be assigned", () => {
    class Frozen extends AbstractTickerStrategy {
      get fixed(): number {
        return 3;
      }
      constructor() {
        super("Frozen");
        this.declareProperties([{ name: "fixed", type: "int", field: "fixed" }]);
      }
    }
    expect(() => new Frozen().setProperty("fixed", 4)).toThrow(/^Failed to apply property 'fixed' = 4: /);
  });
});

describe("when defaults are applied", () => {
  /** The field initializer (9) and the declared default (14) disagree on purpose. */
  class Disagreeing extends AbstractTickerStrategy {
    fast = 9;
    seenWhenIndicatorsWereBuilt: number | undefined;
    constructor() {
      super("Disagreeing");
      this.declareProperties([{ name: "ema.fast", type: "int", defaultValue: 14, field: "fast" }]);
    }
    protected override setupIndicators(indicators: InstrumentGroupRTIndicator): void {
      this.seenWhenIndicatorsWereBuilt = this.fast;
      super.setupIndicators(indicators);
    }
  }

  it("not at construction: the field still shows the initializer right after new", () => {
    expect(new Disagreeing().fast).toBe(9);
  });

  it("at first use, the declared default replaces the initializer it disagreed with", () => {
    const strategy = new Disagreeing();
    strategy.ensureDefaultsApplied();
    expect(strategy.fast).toBe(14);
    expect(strategy.getProperty("ema.fast")).toBe(14);
  });

  it("in a real dispatch, before the indicators are built", () => {
    const strategy = new Disagreeing();
    strategy.update(makeTicker(100, 1000));
    expect(strategy.seenWhenIndicatorsWereBuilt).toBe(14);
  });

  it("on any read or set of a property, which is a first use", () => {
    for (const touch of [
      (s: Disagreeing) => s.getProperty("anything"),
      (s: Disagreeing) => s.hasProperty("anything"),
      (s: Disagreeing) => s.setProperty("anything", 1),
    ]) {
      const strategy = new Disagreeing();
      touch(strategy);
      expect(strategy.fast).toBe(14);
    }
  });

  it("not by listing the definitions, which is metadata", () => {
    const strategy = new Disagreeing();
    strategy.getPropertyDefs();
    expect(strategy.fast).toBe(9);
  });

  it("whatever the depth of the hierarchy, where a field default at registration would lose", () => {
    class Parent extends AbstractTickerStrategy {
      fast!: number;
      constructor(name = "Parent") {
        super(name);
        this.declareProperties([{ name: "ema.fast", type: "int", defaultValue: 14, field: "fast" }]);
      }
    }
    class Child extends Parent {
      override fast = 5;
      constructor() {
        super("Child");
      }
    }
    class Grandchild extends Child {
      override fast = 3;
    }
    const strategy = new Grandchild();
    expect(strategy.fast).toBe(3);
    strategy.ensureDefaultsApplied();
    expect(strategy.fast).toBe(14);
  });

  it("once: a later use does not write the default over a value the class changed", () => {
    const strategy = new Disagreeing();
    strategy.ensureDefaultsApplied();
    strategy.fast = 20;
    strategy.ensureDefaultsApplied();
    strategy.getProperty("ema.fast");
    expect(strategy.fast).toBe(20);
  });

  it("before a set, which then wins", () => {
    const strategy = new Disagreeing();
    strategy.setProperty("ema.fast", 30);
    expect(strategy.fast).toBe(30);
    expect(strategy.getProperty("ema.fast")).toBe(30);
  });

  it("leaves a property that already holds a value alone", () => {
    class Late extends AbstractTickerStrategy {
      depth = 1;
      constructor() {
        super("Late");
        this.setProperty("depth", 5);
        this.declareProperties([{ name: "depth", type: "int", defaultValue: 8, field: "depth" }]);
      }
    }
    const strategy = new Late();
    expect(strategy.hasProperty("depth")).toBe(true);
    expect(strategy.depth).toBe(1);
  });

  it("for a property registered after the strategy was already in use, at the next use", () => {
    const probe = new Probe();
    probe.getProperty("anything");
    let held: unknown;
    probe.registerProperty({ name: "late", type: "int", defaultValue: 4 }, { set: (value) => void (held = value) });
    expect(held).toBeUndefined();
    probe.getProperty("late");
    expect(held).toBe(4);
  });

  it("through the text of the default: a String default of 5 is the string 5, an int default of 14.7 is 14", () => {
    class Texts extends AbstractTickerStrategy {
      s!: string;
      i!: number;
      b!: boolean;
      constructor() {
        super("Texts");
        this.declareProperties([
          { name: "s", type: "String", defaultValue: 5, field: "s" },
          { name: "i", type: "int", defaultValue: 14.7, field: "i" },
          { name: "b", type: "boolean", defaultValue: true, field: "b" },
        ]);
      }
    }
    const strategy = new Texts();
    strategy.ensureDefaultsApplied();
    expect([strategy.s, strategy.i, strategy.b]).toEqual(["5", 14, true]);
  });

  it("keeps the default of a property that is not reflected as its text", () => {
    const probe = new Probe((p) => p.registerProperty({ name: "mode", type: "int", defaultValue: 3, reflected: false }));
    expect(probe.getProperty("mode")).toBe("3");
  });

  it("skips a default the setter rejects, as Java does, and carries on", () => {
    class Rejecting extends AbstractTickerStrategy {
      a = 1;
      b = 1;
      constructor() {
        super("Rejecting");
        this.declareProperties([
          { name: "a", type: "int", defaultValue: 5, field: "a" },
          { name: "b", type: "int", defaultValue: 6, field: "b" },
        ]);
      }
      setA(): void {
        throw new Error("no");
      }
    }
    const strategy = new Rejecting();
    strategy.ensureDefaultsApplied();
    expect([strategy.a, strategy.b]).toEqual([1, 6]);
    expect(strategy.hasProperty("a")).toBe(false);
  });
});
