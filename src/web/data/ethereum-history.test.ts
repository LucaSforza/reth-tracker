import { describe, expect, it, vi } from "vitest";
import { TrackerError } from "./errors";
import { ViemHistoricalChainReader, type HistoricalEthereumClient } from "./ethereum-history";

const address = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    getChainId: vi.fn(async () => 1),
    getBlockNumber: vi.fn(async () => 100n),
    getBytecode: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => blockNumber >= 50n ? "0x01" : undefined),
    getLogs: vi.fn(),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: 1_700_000_000n + blockNumber, hash: `0xblock${blockNumber}` })),
    readContract: vi.fn(async () => 1_100_000_000_000_000_000n),
    ...overrides,
  } as unknown as HistoricalEthereumClient;
}

describe("historical Ethereum reader", () => {
  it("queries incoming and outgoing logs, deduplicates self-transfers, and sorts canonically", async () => {
    const self = { args: { from: address, to: address, value: 5n }, blockNumber: 12n, logIndex: 1, transactionIndex: 2, transactionHash: "0xself", blockHash: "0x12" };
    const incoming = { args: { from: other, to: address, value: 10n }, blockNumber: 11n, logIndex: 3, transactionIndex: 0, transactionHash: "0xin", blockHash: "0x11" };
    const rpc = mockClient();
    vi.mocked(rpc.getLogs).mockImplementation(async (request: unknown) => {
      const args = (request as { args: { from?: string; to?: string } }).args;
      return (args.to ? [self, incoming] : [self]) as never;
    });
    const reader = new ViemHistoricalChainReader(() => rpc);
    const result = await reader.readTransferChunk(address, "https://rpc.example", "10", "20");
    expect(rpc.getLogs).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.id)).toEqual(["0xin:3", "0xself:1"]);
    expect(result[0]).toMatchObject({ capturedAt: 1_700_000_011_000, amountWei: "10", from: other, to: address });
  });

  it("finds the first block containing canonical rETH bytecode", async () => {
    const reader = new ViemHistoricalChainReader(() => mockClient());
    await expect(reader.findContractStartBlock("https://rpc.example")).resolves.toBe("50");
  });

  it("rejects conflicting duplicate log data", async () => {
    const base = { args: { from: address, to: other, value: 5n }, blockNumber: 12n, logIndex: 1, transactionIndex: 0, transactionHash: "0xdup", blockHash: "0x12" };
    const rpc = mockClient({ getLogs: vi.fn().mockResolvedValueOnce([base]).mockResolvedValueOnce([{ ...base, args: { ...base.args, value: 6n } }]) });
    await expect(new ViemHistoricalChainReader(() => rpc).readTransferChunk(address, "https://rpc.example", "10", "20")).rejects.toMatchObject({ code: "sync" });
  });

  it("classifies missing historical state and rejects non-mainnet endpoints", async () => {
    const pruned = mockClient({ readContract: vi.fn(async () => { throw new Error("missing trie node"); }) });
    await expect(new ViemHistoricalChainReader(() => pruned).readProtocolRate("https://rpc.example", "10")).rejects.toMatchObject({ code: "archive-rpc" });
    const wrongNetwork = mockClient({ getChainId: vi.fn(async () => 5) });
    await expect(new ViemHistoricalChainReader(() => wrongNetwork).getHeadBlock("https://rpc.example")).rejects.toEqual(expect.objectContaining<Partial<TrackerError>>({ code: "wrong-network" }));
  });
});
