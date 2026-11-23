import { describe, expect, it } from "vitest";
import { StrategyEventType } from "../../../src/event/StrategyEventType";
import { InfoStrategySignal } from "../../../src/event/signal/InfoStrategySignal";
import { SystemSignal } from "../../../src/event/signal/SystemSignal";

const PAIR = "Rocco/WETH";

describe("SystemSignal", () => {
  it("a detach is of the type System and says its action", () => {
    const signal = SystemSignal.detach("S", PAIR);

    expect(signal.type).toBe(StrategyEventType.System);
    expect(signal.getEventTypeValue()).toBe(SystemSignal.DETACH);
    expect(signal.getEventTypeValue()).toBe("DETACH");
    expect(signal.instrument).toBe(PAIR);
    expect(signal.strategyName).toBe("S");
    expect(signal.getAttachment()).toBeUndefined();
  });

  it("it can name the attachment and give a reason", () => {
    const signal = SystemSignal.detach("S", PAIR).attachment("att-1").reason("done");

    expect(signal.getAttachment()).toBe("att-1");
    expect(signal.get<string>(SystemSignal.KEY_REASON)).toBe("done");
    expect(SystemSignal.KEY_ATTACHMENT).toBe("attachment");
    expect(SystemSignal.KEY_REASON).toBe("reason");
  });

  it("an empty or missing attachment or reason adds nothing", () => {
    const signal = SystemSignal.detach("S", PAIR).attachment("").reason(null);
    signal.attachment(undefined).reason("").reason(undefined);

    expect(signal.getAttachment()).toBeUndefined();
    expect(signal.get<string>(SystemSignal.KEY_REASON)).toBeUndefined();
    expect(signal.has(SystemSignal.KEY_ATTACHMENT)).toBe(false);
    expect(signal.has(SystemSignal.KEY_REASON)).toBe(false);
  });

  it("is a signal of its own kind, not an info signal of the default type", () => {
    const signal = SystemSignal.detach("S", PAIR);

    expect(signal).toBeInstanceOf(InfoStrategySignal);
    expect(signal.type).not.toBe(StrategyEventType.Info);
    expect(signal.type).not.toBe(StrategyEventType.Command);
  });

  it("System is the last event type, added after the others", () => {
    expect(Object.values(StrategyEventType)).toEqual([
      "Info",
      "Marker",
      "Hint",
      "Yield",
      "Command",
      "Request",
      "System",
    ]);
  });
});
