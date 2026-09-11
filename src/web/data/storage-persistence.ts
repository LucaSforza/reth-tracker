import type { StoragePersistenceStatus } from "../domain/types";

/** Inspect browser durability without prompting or mutating application data. */
export async function inspectStoragePersistence(): Promise<StoragePersistenceStatus> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persisted) return { state: "unsupported", persisted: false };
  try {
    const persisted = await storage.persisted();
    return { state: persisted ? "granted" : "not-granted", persisted };
  } catch {
    return { state: "error", persisted: false };
  }
}

/** Ask the browser to protect this origin's local data from automatic eviction. */
export async function requestStoragePersistence(): Promise<StoragePersistenceStatus> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persisted || !storage.persist) return { state: "unsupported", persisted: false };
  try {
    if (await storage.persisted()) return { state: "granted", persisted: true };
    const persisted = await storage.persist();
    return { state: persisted ? "granted" : "not-granted", persisted };
  } catch {
    return { state: "error", persisted: false };
  }
}
