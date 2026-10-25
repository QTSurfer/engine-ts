import { describe, it, expect } from "vitest";
import { Asset } from "../src/index";

describe("Asset", () => {
  it("normalises the code to upper case", () => {
    expect(Asset.of("usdt").code).toBe("USDT");
    expect(new Asset("Btc").code).toBe("BTC");
  });

  it("is equal by code, whichever way it was built", () => {
    expect(Asset.of("usdt").equals(new Asset("USDT"))).toBe(true);
    expect(Asset.of("USDT").equals(Asset.of("USDC"))).toBe(false);
    expect(Asset.of("USDT").equals("USDT")).toBe(false);
  });

  it("prints as its code", () => {
    expect(String(Asset.of("eth"))).toBe("ETH");
  });

  it("rejects a null code", () => {
    expect(() => new Asset(null as unknown as string)).toThrow(new TypeError("code must not be null"));
  });
});
