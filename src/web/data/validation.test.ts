import { describe, expect, it } from "vitest";
import { TrackerError } from "./errors";
import { normalizeAddress, validateSnapshot, validateState } from "./validation";

describe("data validation", () => {
  it("normalizes valid addresses and rejects invalid ones", () => {
    expect(normalizeAddress("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD")).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(() => normalizeAddress("not-an-address")).toThrowError(TrackerError);
  });

  it("rejects floating point and negative raw values", () => {
    expect(() => validateSnapshot({ id: "x", address: "0x1111111111111111111111111111111111111111", capturedAt: 1, blockNumber: "1", rethBalanceWei: "1.2", ethValueWei: "0", ethBalanceWei: "0", rateWei: "0" })).toThrowError(TrackerError);
    expect(() => validateSnapshot({ id: "x", address: "0x1111111111111111111111111111111111111111", capturedAt: 1, blockNumber: "1", rethBalanceWei: "-1", ethValueWei: "0", ethBalanceWei: "0", rateWei: "0" })).toThrowError(TrackerError);
  });

  it("adds snapshot addresses while validating an import", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const state = validateState({
      watchedAddresses: [],
      selectedAddress: undefined,
      rpcUrl: "https://example.com/rpc",
      snapshots: [{ id: "x", address, capturedAt: 1, blockNumber: "1", rethBalanceWei: "0", ethValueWei: "0", ethBalanceWei: "0", rateWei: "1000000000000000000" }],
    });
    expect(state.watchedAddresses).toEqual([address]);
  });

  it("preserves dashboard preferences and defaults legacy imports", () => {
    const base = { watchedAddresses: [], snapshots: [], rpcUrl: "https://example.com/rpc" };
    expect(validateState({ ...base, preferences: { locale: "it", visibleSections: { overview: true, chart: false, history: true } } }).preferences).toEqual({
      locale: "it",
      visibleSections: { overview: true, chart: false, history: true },
    });
    expect(validateState(base).preferences?.locale).toBe("en");
  });
});
