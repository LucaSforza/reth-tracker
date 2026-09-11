import { describe, expect, it } from "vitest";
import type { ChainSnapshot } from "./types";
import { aggregateRewards, calculateIntervalRewardWei } from "./calculations";

const address = "0x1111111111111111111111111111111111111111" as const;
function snapshot(overrides: Partial<ChainSnapshot> = {}): ChainSnapshot {
  return {
    id: "snapshot",
    address,
    capturedAt: 1_700_000_000_000,
    blockNumber: "1",
    rethBalanceWei: "1000000000000000000",
    ethValueWei: "1000000000000000000",
    ethBalanceWei: "0",
    rateWei: "1000000000000000000",
    ...overrides,
  };
}

describe("rETH reward calculations", () => {
  it("uses the previous balance and never floating point arithmetic", () => {
    const previous = snapshot();
    const current = snapshot({ capturedAt: previous.capturedAt + 1000, rateWei: "1100000000000000000", rethBalanceWei: "9000000000000000000" });
    expect(calculateIntervalRewardWei(previous, current)).toBe(100000000000000000n);
  });

  it("keeps negative rate changes as negative observations", () => {
    expect(calculateIntervalRewardWei(snapshot(), snapshot({ rateWei: "900000000000000000" }))).toBe(-100000000000000000n);
  });

  it("sorts observations and accumulates intervals", () => {
    const first = snapshot({ id: "a", capturedAt: 1_000, rateWei: "1000000000000000000" });
    const second = snapshot({ id: "b", capturedAt: 2_000, rateWei: "1100000000000000000" });
    const result = aggregateRewards([second, first]);
    expect(result.map((point) => [point.intervalRewardWei, point.cumulativeRewardWei])).toEqual([
      ["0", "0"],
      ["100000000000000000", "100000000000000000"],
    ]);
  });

  it("rejects mixing addresses in one series", () => {
    const other = snapshot({ address: "0x2222222222222222222222222222222222222222" });
    expect(() => aggregateRewards([snapshot(), other])).toThrow();
  });
});
