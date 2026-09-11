import { describe, expect, it } from "vitest";
import { TrackerError } from "../data/errors";
import { normalizeAddress, parseWei, validateRpcUrl, validateState } from "../data/validation";

const ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

describe("browser input and import validation", () => {
  it("normalizes a valid address without accepting arbitrary strings", () => {
    expect(normalizeAddress(ADDRESS)).toBe(ADDRESS.toLowerCase());
    expect(() => normalizeAddress("not-an-address")).toThrowError(TrackerError);
  });

  it("accepts HTTP(S) RPC URLs and rejects unsupported protocols", () => {
    expect(validateRpcUrl("https://rpc.example.test")).toBe("https://rpc.example.test/");
    expect(validateRpcUrl("http://localhost:8545")).toBe("http://localhost:8545/");
    expect(() => validateRpcUrl("wss://rpc.example.test")).toThrowError(TrackerError);
  });

  it("keeps raw amounts as bigint and rejects signs/fractions", () => {
    expect(parseWei("1000000000000000001")).toBe(1_000_000_000_000_000_001n);
    expect(() => parseWei("-1")).toThrowError(TrackerError);
    expect(() => parseWei("1.5")).toThrowError(TrackerError);
  });

  it("deduplicates imported addresses and preserves a valid snapshot", () => {
    const state = validateState({
      watchedAddresses: [ADDRESS, ADDRESS.toLowerCase()],
      selectedAddress: ADDRESS,
      rpcUrl: "https://rpc.example.test",
      snapshots: [
        {
          id: "snapshot-1",
          address: ADDRESS,
          capturedAt: 1_700_000_000_000,
          blockNumber: "19000000",
          rethBalanceWei: "1000000000000000000",
          ethValueWei: "1100000000000000000",
          ethBalanceWei: "500000000000000000",
          rateWei: "1100000000000000000",
          rethDecimals: 18,
        },
      ],
    });

    expect(state.watchedAddresses).toEqual([ADDRESS.toLowerCase()]);
    expect(state.selectedAddress).toBe(ADDRESS.toLowerCase());
    expect(state.snapshots[0].rethBalanceWei).toBe("1000000000000000000");
  });
});
