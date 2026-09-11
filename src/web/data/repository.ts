import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_DASHBOARD_PREFERENCES, type ChainSnapshot, type DashboardPreferences, type EthereumAddress, type TrackerRepository, type TrackerState } from "../domain/types";
import { DEFAULT_RPC_URL } from "./ethereum";
import { TrackerError } from "./errors";
import { normalizeAddress, validatePreferences, validateRpcUrl, validateSnapshot, validateState } from "./validation";

const DB_VERSION = 1;
const DEFAULT_DB_NAME = "reth-tracker";
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
}

export interface IndexedDbRepositoryOptions {
  dbName?: string;
  defaultRpcUrl?: string;
  snapshotBucketMs?: number;
}

export interface TrackerExport {
  version: 1;
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

  constructor(options: IndexedDbRepositoryOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.defaultRpcUrl = validateRpcUrl(options.defaultRpcUrl ?? DEFAULT_RPC_URL);
    this.bucketMs = options.snapshotBucketMs ?? DEFAULT_SNAPSHOT_BUCKET_MS;
    if (!Number.isSafeInteger(this.bucketMs) || this.bucketMs <= 0) throw new Error("snapshotBucketMs must be a positive integer");
  }

  private db(): Promise<IDBPDatabase<TrackerDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<TrackerDbSchema>(this.dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("addresses")) db.createObjectStore("addresses");
          if (!db.objectStoreNames.contains("snapshots")) {
            const store = db.createObjectStore("snapshots");
            store.createIndex("by-address", "address");
          }
          if (!db.objectStoreNames.contains("preferences")) db.createObjectStore("preferences");
        },
      }).catch((error) => {
        this.dbPromise = undefined;
        throw storageError(error);
      });
    }
    return this.dbPromise;
  }

  private async readState(db: IDBPDatabase<TrackerDbSchema>): Promise<TrackerState> {
    const [addresses, snapshots, rpcValue, selectedValue, preferencesValue] = await Promise.all([
      db.getAll("addresses"),
      db.getAll("snapshots"),
      db.get("preferences", RPC_PREFERENCE_KEY),
      db.get("preferences", SELECTED_ADDRESS_KEY),
      db.get("preferences", DASHBOARD_PREFERENCES_KEY),
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
      const payload: TrackerExport = { version: 1, exportedAt: Date.now(), data };
      return JSON.stringify(payload, null, 2);
    } catch (error) { throw storageError(error); }
  }

  async importJson(json: string): Promise<TrackerState> {
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch (error) { throw new TrackerError("invalid-data", "The imported file does not contain valid JSON.", error); }
    try {
      if (!parsed || typeof parsed !== "object") throw new TrackerError("invalid-data", "The imported data format is not recognised.");
      const candidate = parsed as Record<string, unknown>;
      if (candidate.version !== undefined && candidate.version !== 1) throw new TrackerError("invalid-data", "The imported data version is not supported.");
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
      return this.readState(db);
    } catch (error) { throw storageError(error); }
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
      return this.readState(db);
    } catch (error) { throw storageError(error); }
  }
}

export const TrackerRepositoryImpl = IndexedDbTrackerRepository;
