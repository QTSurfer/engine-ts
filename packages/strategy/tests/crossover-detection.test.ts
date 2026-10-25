import { describe, it, expect } from "vitest";
import { CrossDetector } from "../src/CrossDetector";

describe("CrossDetector", () => {
  it("reports no transition on the first call, since there is no prior side to compare against", () => {
    const detector = new CrossDetector();
    expect(detector.check(10, 20)).toEqual({ above: false, below: false });
  });

  it("reports above when left rises through right", () => {
    const detector = new CrossDetector();
    detector.check(10, 20);
    expect(detector.check(15, 20)).toEqual({ above: false, below: false }); // still below
    expect(detector.check(25, 20)).toEqual({ above: true, below: false }); // crosses
    expect(detector.check(30, 20)).toEqual({ above: false, below: false }); // already above
  });

  it("reports below when left falls through right", () => {
    const detector = new CrossDetector();
    detector.check(25, 20);
    expect(detector.check(22, 20)).toEqual({ above: false, below: false }); // still above
    expect(detector.check(15, 20)).toEqual({ above: false, below: true }); // crosses
    expect(detector.check(10, 20)).toEqual({ above: false, below: false }); // already below
  });

  /**
   * The reason this shape replaced detectCrossAbove/detectCrossBelow. Those took a shared
   * `(state, index)` pair and each unconditionally wrote the current side into that slot, so asking
   * for both directions against the same index made the first call destroy what the second needed —
   * whichever ran second could never fire. One call reporting both directions cannot have that bug.
   */
  it("reports both directions from a single call, so they always describe the same tick", () => {
    const detector = new CrossDetector();
    detector.check(10, 20);

    expect(detector.check(25, 20)).toEqual({ above: true, below: false });
    expect(detector.check(15, 20)).toEqual({ above: false, below: true });
  });

  it("treats equal values as not-above, so touching the line counts as crossing below", () => {
    const detector = new CrossDetector();
    detector.check(25, 20);
    expect(detector.check(20, 20)).toEqual({ above: false, below: true });
    expect(detector.check(20, 20)).toEqual({ above: false, below: false });
  });

  it("forgets the tracked side on reset", () => {
    const detector = new CrossDetector();
    detector.check(10, 20);
    detector.reset();
    expect(detector.check(25, 20)).toEqual({ above: false, below: false });
  });

  it("keeps separate instances independent, which is what lets one live per watched pair", () => {
    const fastSlow = new CrossDetector();
    const priceMa = new CrossDetector();

    fastSlow.check(10, 20);
    priceMa.check(30, 20);

    expect(fastSlow.check(25, 20)).toEqual({ above: true, below: false });
    expect(priceMa.check(25, 20)).toEqual({ above: false, below: false });
    expect(priceMa.check(15, 20)).toEqual({ above: false, below: true });
  });
});
