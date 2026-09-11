import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openDB } from "idb";
import type { ChainSnapshot, HistoricalSyncState, RethTransferRecord } from "../domain/types";
import { IndexedDbTrackerRepository } from "./repository";

const address = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
function dbName() { return `reth-test-${crypto.randomUUID()}`; }

const snapshot: ChainSnapshot = { id: "snapshot", address, capturedAt: 1_700_000_000_000, blockNumber: "1", rethBalanceWei: "1", ethValueWei: "20", ethBalanceWei: "0", rateWei: "1100000000000000000" };

describe("IndexedDB repository durability", () => {
  it("reopens the same data from another repository instance", async () => {
    const name = dbName();
    const first = new IndexedDbTrackerRepository({ dbName: name });
    await first.addAddress(address);
    await first.saveSnapshot(snapshot);
    const reopened = await new IndexedDbTrackerRepository({ dbName: name }).load();
    expect(reopened.watchedAddresses).toEqual([address]);
    expect(reopened.snapshots).toEqual([snapshot]);
  });

  it("migrates a version-1 database without clearing its records", async () => {
    const name = dbName();
    const legacy = await openDB(name, 1, { upgrade(db) {
      db.createObjectStore("addresses");
      const snapshots = db.createObjectStore("snapshots");
      snapshots.createIndex("by-address", "address");
      db.createObjectStore("preferences");
    } });
    await legacy.put("addresses", { address, addedAt: 1 }, address);
    await legacy.put("snapshots", snapshot, `${address}:legacy`);
    legacy.close();

    const migrated = await new IndexedDbTrackerRepository({ dbName: name }).load();
    expect(migrated.watchedAddresses).toEqual([address]);
    expect(migrated.snapshots).toEqual([snapshot]);
    expect(migrated.historicalTransfers).toEqual([]);
  });

  it("stores historical chunks idempotently and includes them in backup", async () => {
    const repository = new IndexedDbTrackerRepository({ dbName: dbName() });
    await repository.addAddress(address);
    const transfer: RethTransferRecord = { id: "0xtx:0", trackedAddress: address, transactionHash: "0xtx", transactionIndex: "0", logIndex: "0", blockNumber: "10", capturedAt: 1_700_000_000_000, from: other, to: address, amountWei: "100" };
    const sync: HistoricalSyncState = { address, fromBlock: "10", targetBlock: "20", nextBlock: "11", status: "running", updatedAt: 1_700_000_000_000 };
    await repository.saveHistoricalChunk([transfer], sync);
    await repository.saveHistoricalChunk([transfer], sync);
    expect(await repository.getHistoricalTransfers(address)).toEqual([transfer]);
    expect(JSON.parse(await repository.exportJson())).toMatchObject({ version: 2, data: { historicalTransfers: [transfer], historicalSyncs: [sync] } });
  });

  it("validates an import before replacing existing data", async () => {
    const repository = new IndexedDbTrackerRepository({ dbName: dbName() });
    await repository.addAddress(address);
    await expect(repository.importJson(JSON.stringify({ version: 2, data: { watchedAddresses: [], snapshots: [], rpcUrl: "invalid" } }))).rejects.toThrow();
    expect((await repository.load()).watchedAddresses).toEqual([address]);
  });
});
