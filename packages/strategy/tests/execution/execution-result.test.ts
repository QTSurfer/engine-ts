import { describe, it, expect } from "vitest";
import { ExecutionResult } from "../../src/execution/ExecutionResult";

describe("ExecutionResult", () => {
  it("stores fill data", () => {
    const r = new ExecutionResult(50000, 0.02, 1000, 1);
    expect(r.price).toBe(50000);
    expect(r.baseAmount).toBe(0.02);
    expect(r.counterAmount).toBe(1000);
    expect(r.feeAmount).toBe(1);
  });

  it("computes net counter amount", () => {
    const r = new ExecutionResult(50000, 0.02, 1000, 1.5);
    expect(r.getNetCounterAmount()).toBe(998.5);
  });

  it("net equals counter when fee is zero", () => {
    const r = new ExecutionResult(100, 10, 1000, 0);
    expect(r.getNetCounterAmount()).toBe(1000);
  });
});
