import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_DASHBOARD_PREFERENCES, type ChainSnapshot, type DashboardPreferences, type EthereumAddress, type HistoricalSyncState, type ProtocolRateSample, type RethTransferRecord, type TrackerRepository, type TrackerState } from "../domain/types";
import { DEFAULT_RPC_URL } from "./ethereum";
import { TrackerError } from "./errors";
import { normalizeAddress, validateHistoricalSync, validatePreferences, validateProtocolRate, validateRpcUrl, validateSnapshot, validateState, validateTransfer } from "./validation";

export const DB_VERSION = 2;
const DEFAULT_DB_NAME = "reth-tracker";
const DB_OPEN_TIMEOUT_MS = 4_000;
export const DEFAULT_SNAPSHOT_BUCKET_MS = 60_000;
const RPC_PREFERENCE_KEY = "rpcUrl";
const SELECTED_ADDRESS_KEY = "selectedAddress";
const DASHBOARD_PREFERENCES_KEY = "dashboardPreferences";

interface AddressRecord {
  address: EthereumAddress;
  addedAt: number;
}

interface TrackerDbSchema extends DBSchema {
  addresses: { key: string; value: AddressRecord };
  snapshots: { key: string; value: ChainSnapshot; indexes: { "by-address": string } };
  preferences: { key: string; value: string };
  transfers: { key: string; value: RethTransferRecord; indexes: { "by-address": string } };
  rates: { key: string; value: ProtocolRateSample };
  sync: { key: string; value: HistoricalSyncState };
}

interface HistoryDbSchema extends DBSchema {
  transfers: { key: string; value: RethTransferRecord; indexes: { "by-address": string } };
  rates: { key: string; value: ProtocolRateSample };
  sync: { key: string; value: HistoricalSyncState };
}

export interface IndexedDbRepositoryOptions {
  dbName?: string;
  defaultRpcUrl?: string;
  snapshotBucketMs?: number;
}

export interface TrackerExport {
  version: 2;
  exportedAt: number;
  data: TrackerState;
}

function storageError(error: unknown): TrackerError {
  if (error instanceof TrackerError) return error;
  return new TrackerError("storage", "Unable to read or save the browser's local data.", error);
}

function snapshotKey(snapshot: Pick<ChainSnapshot, "address" | "capturedAt">, bucketMs: number): string {
  return `${snapshot.address.toLowerCase()}:${Math.floor(snapshot.capturedAt / bucketMs)}`;
}

function transferKey(transfer: Pick<RethTransferRecord, "trackedAddress" | "id">): string {
  return `${transfer.trackedAddress.toLowerCase()}:${transfer.id}`;
}

function deduplicateSnapshots(snapshots: readonly ChainSnapshot[], bucketMs: number): ChainSnapshot[] {
  const byKey = new Map<string, ChainSnapshot>();
  for (const snapshot of snapshots) byKey.set(snapshotKey(snapshot, bucketMs), snapshot);
  return [...byKey.values()].sort((left, right) => left.capturedAt - right.capturedAt || left.address.localeCompare(right.address));
}

/** IndexedDB-backed local repository; no server, cookie, wallet, or private key is involved. */
export class IndexedDbTrackerRepository implements TrackerRepository {
  private readonly dbName: string;
  private readonly defaultRpcUrl: string;
  private readonly bucketMs: number;
  private dbPromise?: Promise<IDBPDatabase<TrackerDbSchema>>;
  private historyDbPromise?: Promise<IDBPDatabase<HistoryDbSchema>>;
  private legacyMain = false;

  constructor(options: IndexedDbRepositoryOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.defaultRpcUrl = validateRpcUrl(options.defaultRpcUrl ?? DEFAULT_RPC_URL);
    this.bucketMs = options.snapshotBucketMs ?? DEFAULT_SNAPSHOT_BUCKET_MS;
    if (!Number.isSafeInteger(this.bucketMs) || this.bucketMs <= 0) throw new Error("snapshotBucketMs must be a positive integer");
  }

  private db(): Promise<IDBPDatabase<TrackerDbSchema>> {
    if (!this.dbPromise) {
      let blocked = false;
      const opening = openDB<TrackerDbSchema>(this.dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("addresses")) db.createObjectStore("addresses");
          if (!db.objectStoreNames.contains("snapshots")) {
            const store = db.createObjectStore("snapshots");
            store.createIndex("by-address", "address");
          }
          if (!db.objectStoreNames.contains("preferences")) db.createObjectStore("preferences");
          if (!db.objectStoreNames.contains("transfers")) {
            const store = db.createObjectStore("transfers");
            store.createIndex("by-address", "trackedAddress");
          }
          if (!db.objectStoreNames.contains("rates")) db.createObjectStore("rates");
          if (!db.objectStoreNames.contains("sync")) db.createObjectStore("sync");
        },
        blocked() { blocked = true; },
      }).catch((error) => {
        throw storageError(error);
      });
      const timeout = new Promise<never>((_, reject) => {
        globalThis.setTimeout(() => reject(new TrackerError(
          "storage",
          blocked
            ? "The local database is waiting for another rETH Compass tab to close. Close older tabs for this site, then reload; existing data is preserved."
            : "The browser local database did not open in time. Reload the page and try again; existing data is preserved.",
        )), DB_OPEN_TIMEOUT_MS);
      });
      this.dbPromise = Promise.race([opening, timeout]).catch(async (error) => {
        // A previously opened v1 tab can keep an IndexedDB upgrade pending.
        // Read the legacy stores at their current version so existing data
        // remains available; history records use a separate additive DB.
        if (error instanceof TrackerError && error.code === "storage") {
          try {
            const legacyOpening = openDB<TrackerDbSchema>(this.dbName);
            const legacy = await Promise.race([
              legacyOpening,
              new Promise<never>((_, reject) => globalThis.setTimeout(() => reject(new Error("legacy database timeout")), 2_000)),
            ]);
            this.legacyMain = true;
            return legacy;
          } catch { /* fall through to the actionable storage error */ }
        }
        this.dbPromise = undefined;
        throw storageError(error);
      });
    }
    return this.dbPromise;
  }

  private async historyDb(): Promise<IDBPDatabase<HistoryDbSchema>> {
    if (!this.legacyMain) return this.db() as unknown as IDBPDatabase<HistoryDbSchema>;
    if (!this.historyDbPromise) {
      this.historyDbPromise = openDB<HistoryDbSchema>(`${this.dbName}-history`, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("transfers")) {
            const store = db.createObjectStore("transfers");
            store.createIndex("by-address", "trackedAddress");
          }
          if (!db.objectStoreNames.contains("rates")) db.createObjectStore("rates");
          if (!db.objectStoreNames.contains("sync")) db.createObjectStore("sync");
        },
      });
    }
    return this.historyDbPromise;
  }

  private async readState(db: IDBPDatabase<TrackerDbSchema>): Promise<TrackerState> {
    const [addresses, snapshots, rpcValue, selectedValue, preferencesValue] = await Promise.all([
      db.getAll("addresses"),
      db.getAll("snapshots"),
      db.get("preferences", RPC_PREFERENCE_KEY),
      db.get("preferences", SELECTED_ADDRESS_KEY),
      db.get("preferences", DASHBOARD_PREFERENCES_KEY),
    ]);
    const history = await this.historyDb();
    const [transfers, rates, syncs] = await Promise.all([
      history.getAll("transfers"),
      history.getAll("rates"),
      history.getAll("sync"),
    ]);
    const watchedAddresses = addresses.map((record) => normalizeAddress(record.address));
    const selectedAddress = selectedValue === undefined ? undefined : normalizeAddress(selectedValue);
    let preferences = DEFAULT_DASHBOARD_PREFERENCES;
    if (preferencesValue !== undefined) {
      try { preferences = validatePreferences(JSON.parse(preferencesValue)); } catch { /* Recover from malformed local preferences. */ }
    }
    return {
      watchedAddresses,
      ...(selectedAddress && watchedAddresses.includes(selectedAddress) ? { selectedAddress } : {}),
      snapshots: deduplicateSnapshots(snapshots.map(validateSnapshot), this.bucketMs),
      rpcUrl: rpcValue === undefined ? this.defaultRpcUrl : validateRpcUrl(rpcValue),
      preferences,
      historicalTransfers: transfers.map(validateTransfer),
      protocolRates: rates.map(validateProtocolRate),
      historicalSyncs: syncs.map(validateHistoricalSync),
    };
  }

  async load(): Promise<TrackerState> {
    try { return await this.readState(await this.db()); } catch (error) { throw storageError(error); }
  }

  async addAddress(value: EthereumAddress): Promise<TrackerState> {
    const address = normalizeAddress(value);
    try {
      const db = await this.db();
      const tx = db.transaction(["addresses", "preferences"], "readwrite");
      const existing = await tx.objectStore("addresses").get(address);
      await tx.objectStore("addresses").put(existing ?? { address, addedAt: Date.now() }, address);
      const selected = await tx.objectStore("preferences").get(SELECTED_ADDRESS_KEY);
      if (selected === undefined) await tx.objectStore("preferences").put(address, SELECTED_ADDRESS_KEY);
      await tx.done;
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async removeAddress(value: EthereumAddress): Promise<TrackerState> {
    const address = normalizeAddress(value);
    try {
      const db = await this.db();
      const tx = db.transaction(["addresses", "snapshots", "preferences"], "readwrite");
      await tx.objectStore("addresses").delete(address);
      const snapshots = await tx.objectStore("snapshots").index("by-address").getAll(address);
      for (const snapshot of snapshots) await tx.objectStore("snapshots").delete(snapshotKey(snapshot, this.bucketMs));
      const selected = await tx.objectStore("preferences").get(SELECTED_ADDRESS_KEY);
      if (selected?.toLowerCase() === address) await tx.objectStore("preferences").delete(SELECTED_ADDRESS_KEY);
      await tx.done;
      const history = await this.historyDb();
      const historyTx = history.transaction(["transfers", "sync"], "readwrite");
      const transfers = await historyTx.objectStore("transfers").index("by-address").getAll(address);
      for (const transfer of transfers) await historyTx.objectStore("transfers").delete(transferKey(transfer));
      await historyTx.objectStore("sync").delete(address);
      await historyTx.done;
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async saveSnapshot(value: ChainSnapshot): Promise<TrackerState> {
    const snapshot = validateSnapshot(value);
    try {
      const db = await this.db();
      const tx = db.transaction("snapshots", "readwrite");
      // The time bucket is the key, making rapid refreshes idempotent. The
      // newest observation in a bucket replaces the older one.
      await tx.store.put(snapshot, snapshotKey(snapshot, this.bucketMs));
      await tx.done;
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async setRpcUrl(value: string): Promise<TrackerState> {
    const rpcUrl = validateRpcUrl(value);
    try {
      const db = await this.db();
      await db.put("preferences", rpcUrl, RPC_PREFERENCE_KEY);
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async setPreferences(value: DashboardPreferences): Promise<TrackerState> {
    const preferences = validatePreferences(value);
    try {
      const db = await this.db();
      await db.put("preferences", JSON.stringify(preferences), DASHBOARD_PREFERENCES_KEY);
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async selectAddress(value?: EthereumAddress): Promise<TrackerState> {
    const address = value === undefined ? undefined : normalizeAddress(value);
    try {
      const db = await this.db();
      if (address !== undefined) {
        const exists = await db.get("addresses", address);
        if (!exists) throw new TrackerError("invalid-address", "The address must be added before it can be selected.");
        await db.put("preferences", address, SELECTED_ADDRESS_KEY);
      } else {
        await db.delete("preferences", SELECTED_ADDRESS_KEY);
      }
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async exportJson(): Promise<string> {
    try {
      const data = await this.load();
      const payload: TrackerExport = { version: 2, exportedAt: Date.now(), data };
      return JSON.stringify(payload, null, 2);
    } catch (error) { throw storageError(error); }
  }

  async importJson(json: string): Promise<TrackerState> {
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch (error) { throw new TrackerError("invalid-data", "The imported file does not contain valid JSON.", error); }
    try {
      if (!parsed || typeof parsed !== "object") throw new TrackerError("invalid-data", "The imported data format is not recognised.");
      const candidate = parsed as Record<string, unknown>;
      if (candidate.version !== undefined && candidate.version !== 1 && candidate.version !== 2) throw new TrackerError("invalid-data", "The imported data version is not supported.");
      const state = validateState(candidate.data ?? parsed);
      const snapshots = deduplicateSnapshots(state.snapshots, this.bucketMs);
      const db = await this.db();
      const tx = db.transaction(["addresses", "snapshots", "preferences"], "readwrite");
      await Promise.all([
        tx.objectStore("addresses").clear(),
        tx.objectStore("snapshots").clear(),
        tx.objectStore("preferences").clear(),
      ]);
      for (const address of state.watchedAddresses) await tx.objectStore("addresses").put({ address, addedAt: Date.now() }, address);
      for (const snapshot of snapshots) await tx.objectStore("snapshots").put(snapshot, snapshotKey(snapshot, this.bucketMs));
      await tx.objectStore("preferences").put(state.rpcUrl, RPC_PREFERENCE_KEY);
      if (state.selectedAddress) await tx.objectStore("preferences").put(state.selectedAddress, SELECTED_ADDRESS_KEY);
      await tx.objectStore("preferences").put(JSON.stringify(state.preferences ?? DEFAULT_DASHBOARD_PREFERENCES), DASHBOARD_PREFERENCES_KEY);
      await tx.done;
      const history = await this.historyDb();
      const historyTx = history.transaction(["transfers", "rates", "sync"], "readwrite");
      await Promise.all([
        historyTx.objectStore("transfers").clear(),
        historyTx.objectStore("rates").clear(),
        historyTx.objectStore("sync").clear(),
      ]);
      for (const transfer of state.historicalTransfers ?? []) await historyTx.objectStore("transfers").put(transfer, transferKey(transfer));
      for (const rate of state.protocolRates ?? []) await historyTx.objectStore("rates").put(rate, rate.blockNumber);
      for (const sync of state.historicalSyncs ?? []) await historyTx.objectStore("sync").put(sync, sync.address);
      await historyTx.done;
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }

  async saveHistoricalChunk(records: readonly RethTransferRecord[], syncValue: HistoricalSyncState, replaceRange?: { fromBlock: string; toBlock: string }): Promise<void> {
    const sync = validateHistoricalSync(syncValue);
    const transfers = records.map(validateTransfer);
    if (transfers.some((transfer) => transfer.trackedAddress !== sync.address)) throw new TrackerError("invalid-data", "Historical records do not match the sync address.");
    try {
      const db = await this.historyDb();
      const tx = db.transaction(["transfers", "sync"], "readwrite");
      if (replaceRange) {
        const from = BigInt(replaceRange.fromBlock);
        const to = BigInt(replaceRange.toBlock);
        const existing = await tx.objectStore("transfers").index("by-address").getAll(sync.address);
        for (const transfer of existing) {
          const block = BigInt(transfer.blockNumber);
          if (block >= from && block <= to) await tx.objectStore("transfers").delete(transferKey(transfer));
        }
      }
      for (const transfer of transfers) await tx.objectStore("transfers").put(transfer, transferKey(transfer));
      await tx.objectStore("sync").put(sync, sync.address);
      await tx.done;
    } catch (error) { throw storageError(error); }
  }

  async saveProtocolRates(values: readonly ProtocolRateSample[]): Promise<void> {
    const samples = values.map(validateProtocolRate);
    try {
      const db = await this.historyDb();
      const tx = db.transaction("rates", "readwrite");
      for (const sample of samples) await tx.store.put(sample, sample.blockNumber);
      await tx.done;
    } catch (error) { throw storageError(error); }
  }

  async getHistoricalTransfers(value: EthereumAddress): Promise<RethTransferRecord[]> {
    const address = normalizeAddress(value);
    try {
      const records = await (await this.historyDb()).getAllFromIndex("transfers", "by-address", address);
      return records.map(validateTransfer).sort((a, b) => {
        const block = BigInt(a.blockNumber) - BigInt(b.blockNumber);
        if (block !== 0n) return block < 0n ? -1 : 1;
        const log = BigInt(a.logIndex) - BigInt(b.logIndex);
        return log === 0n ? a.id.localeCompare(b.id) : log < 0n ? -1 : 1;
      });
    } catch (error) { throw storageError(error); }
  }

  async getProtocolRates(blockNumbers?: readonly string[]): Promise<ProtocolRateSample[]> {
    try {
      const db = await this.historyDb();
      if (!blockNumbers) return (await db.getAll("rates")).map(validateProtocolRate);
      const values = await Promise.all(blockNumbers.map((block) => db.get("rates", block)));
      return values.filter((value): value is ProtocolRateSample => value !== undefined).map(validateProtocolRate);
    } catch (error) { throw storageError(error); }
  }

  async getHistoricalSync(value: EthereumAddress): Promise<HistoricalSyncState | undefined> {
    const address = normalizeAddress(value);
    try {
      const sync = await (await this.historyDb()).get("sync", address);
      return sync === undefined ? undefined : validateHistoricalSync(sync);
    } catch (error) { throw storageError(error); }
  }

  async saveHistoricalSync(value: HistoricalSyncState): Promise<void> {
    const sync = validateHistoricalSync(value);
    try { await (await this.historyDb()).put("sync", sync, sync.address); } catch (error) { throw storageError(error); }
  }

  async clear(): Promise<TrackerState> {
    try {
      const db = await this.db();
      const tx = db.transaction(["addresses", "snapshots", "preferences"], "readwrite");
      await Promise.all([
        tx.objectStore("addresses").clear(),
        tx.objectStore("snapshots").clear(),
        tx.objectStore("preferences").clear(),
      ]);
      await tx.done;
      const history = await this.historyDb();
      const historyTx = history.transaction(["transfers", "rates", "sync"], "readwrite");
      await Promise.all([
        historyTx.objectStore("transfers").clear(),
        historyTx.objectStore("rates").clear(),
        historyTx.objectStore("sync").clear(),
      ]);
      await historyTx.done;
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }
}

export const TrackerRepositoryImpl = IndexedDbTrackerRepository;
