import { describe, expect, it } from "vitest";
import { calculateHistoricalProtocolYield } from "./calculations";
import type { ProtocolRateSample, RethTransferRecord } from "./types";

const address = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const zero = "0x0000000000000000000000000000000000000000" as const;
const unit = 10n ** 18n;

function transfer(block: number, from: typeof address | typeof other | typeof zero, to: typeof address | typeof other | typeof zero, amount: bigint): RethTransferRecord {
  return { id: `0x${block}:${block}`, trackedAddress: address, transactionHash: `0x${block}`, transactionIndex: "0", logIndex: "0", blockNumber: String(block), capturedAt: block * 1000, from, to, amountWei: amount.toString() };
}
function rate(block: number, value: bigint): ProtocolRateSample { return { blockNumber: String(block), capturedAt: block * 1000, rateWei: value.toString() }; }

describe("historical protocol yield", () => {
  it("excludes transfers and applies rate changes only to the held balance", () => {
    const result = calculateHistoricalProtocolYield(address, [transfer(10, other, address, unit), transfer(20, address, other, 4n * unit / 10n)], [rate(10, unit), rate(20, 11n * unit / 10n), rate(30, 12n * unit / 10n)], "30");
    expect(result.cumulativeYieldWei).toBe((16n * unit / 100n).toString());
    expect(result.terminalBalanceWei).toBe((6n * unit / 10n).toString());
  });

  it("handles mint, burn, self-transfer, unordered input, and negative rate movement", () => {
    const self = transfer(15, address, address, 99n * unit);
    const result = calculateHistoricalProtocolYield(address, [transfer(20, address, zero, unit / 2n), self, transfer(10, zero, address, unit)], [rate(10, unit), rate(15, 95n * unit / 100n), rate(20, 9n * unit / 10n)], "20");
    expect(result.cumulativeYieldWei).toBe((-1n * unit / 10n).toString());
    expect(result.terminalBalanceWei).toBe((unit / 2n).toString());
  });

  it("requires exact boundary and terminal rates", () => {
    expect(() => calculateHistoricalProtocolYield(address, [transfer(10, other, address, unit)], [], "20")).toThrow(/Missing protocol rate/);
  });

  it("keeps values beyond Number precision exact", () => {
    const huge = 123456789012345678901234567890n;
    const result = calculateHistoricalProtocolYield(address, [transfer(10, other, address, huge)], [rate(10, unit), rate(20, unit + 1n)], "20");
    expect(result.cumulativeYieldWei).toBe((huge / unit).toString());
  });
});
