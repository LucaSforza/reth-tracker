import { describe, expect, it, vi } from "vitest";
import type { EthereumAddress, HistoricalSyncState, ProtocolRateSample, RethTransferRecord, TrackerRepository } from "../domain/types";
import type { HistoricalChainReader } from "./ethereum-history";
import { synchronizeHistoricalYield } from "./historical";

const address = "0x1111111111111111111111111111111111111111" as EthereumAddress;
const other = "0x2222222222222222222222222222222222222222" as EthereumAddress;
const unit = 10n ** 18n;

function transfer(blockNumber: string): RethTransferRecord {
  return { id: "0xtx:0", trackedAddress: address, transactionHash: "0xtx", transactionIndex: "0", logIndex: "0", blockNumber, capturedAt: 1_700_000_000_000, from: other, to: address, amountWei: unit.toString() };
}

function memoryRepository(initialSync?: HistoricalSyncState) {
  let transfers: RethTransferRecord[] = [];
  let rates: ProtocolRateSample[] = [];
  let sync = initialSync;
  const api = {
    getHistoricalSync: vi.fn(async () => sync),
    saveHistoricalSync: vi.fn(async (value: HistoricalSyncState) => { sync = value; }),
    saveHistoricalChunk: vi.fn(async (values: readonly RethTransferRecord[], value: HistoricalSyncState) => {
      const byId = new Map(transfers.map((item) => [item.id, item]));
      for (const item of values) byId.set(item.id, item);
      transfers = [...byId.values()];
      sync = value;
    }),
    getHistoricalTransfers: vi.fn(async () => transfers),
    getProtocolRates: vi.fn(async (blocks?: readonly string[]) => blocks ? rates.filter((item) => blocks.includes(item.blockNumber)) : rates),
    saveProtocolRates: vi.fn(async (values: readonly ProtocolRateSample[]) => {
      const byBlock = new Map(rates.map((item) => [item.blockNumber, item]));
      for (const item of values) byBlock.set(item.blockNumber, item);
      rates = [...byBlock.values()];
    }),
  };
  return { repository: api as unknown as TrackerRepository, api, getSync: () => sync };
}

function reader(overrides: Partial<HistoricalChainReader> = {}): HistoricalChainReader {
  return {
    getHeadBlock: vi.fn(async () => "200"),
    findContractStartBlock: vi.fn(async () => "100"),
    readTransferChunk: vi.fn(async (_address, _rpc, from) => from === "100" ? [transfer("100")] : []),
    readProtocolRate: vi.fn(async (_rpc, blockNumber) => ({ blockNumber, capturedAt: 1_700_000_000_000 + Number(blockNumber), rateWei: blockNumber === "100" ? unit.toString() : (11n * unit / 10n).toString() })),
    ...overrides,
  };
}

describe("historical synchronization", () => {
  it("checkpoints every inclusive chunk and produces protocol yield", async () => {
    const store = memoryRepository();
    const chain = reader();
    const result = await synchronizeHistoricalYield(address, "https://rpc.example", store.repository, chain, { chunkSize: 20n });
    expect(chain.readTransferChunk).toHaveBeenNthCalledWith(1, address, "https://rpc.example", "100", "119");
    expect(chain.readTransferChunk).toHaveBeenNthCalledWith(2, address, "https://rpc.example", "120", "136");
    expect(result.cumulativeYieldWei).toBe((unit / 10n).toString());
    expect(store.getSync()?.status).toBe("complete");
    expect(store.getSync()?.nextBlock).toBe("137");
  });

  it("resumes at the first unprocessed block", async () => {
    const store = memoryRepository({ address, fromBlock: "100", targetBlock: "119", nextBlock: "120", status: "error", updatedAt: 1, errorMessage: "offline" });
    const chain = reader();
    await synchronizeHistoricalYield(address, "https://rpc.example", store.repository, chain, { chunkSize: 20n });
    expect(chain.findContractStartBlock).not.toHaveBeenCalled();
    expect(chain.readTransferChunk).toHaveBeenNthCalledWith(1, address, "https://rpc.example", "100", "119");
    expect(chain.readTransferChunk).toHaveBeenNthCalledWith(2, address, "https://rpc.example", "120", "136");
  });

  it("keeps the completed checkpoint when a later chunk fails", async () => {
    const store = memoryRepository();
    const chain = reader({ readTransferChunk: vi.fn(async (_address, _rpc, from) => {
      if (from === "120") throw new Error("provider failed");
      return from === "100" ? [transfer("100")] : [];
    }) });
    await expect(synchronizeHistoricalYield(address, "https://rpc.example", store.repository, chain, { chunkSize: 20n })).rejects.toThrow("provider failed");
    expect(store.getSync()?.status).toBe("error");
    expect(store.getSync()?.nextBlock).toBe("120");
    expect(store.api.saveHistoricalChunk).toHaveBeenCalledTimes(1);
  });
});
