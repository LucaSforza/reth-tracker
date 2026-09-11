import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectStoragePersistence, requestStoragePersistence } from "./storage-persistence";

const originalStorage = navigator.storage;

function mockStorage(value: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, "storage", { configurable: true, value });
}

afterEach(() => {
  Object.defineProperty(navigator, "storage", { configurable: true, value: originalStorage });
});

describe("browser storage persistence", () => {
  it("reports unsupported browsers without failing", async () => {
    mockStorage(undefined);
    await expect(inspectStoragePersistence()).resolves.toEqual({ state: "unsupported", persisted: false });
    await expect(requestStoragePersistence()).resolves.toEqual({ state: "unsupported", persisted: false });
  });

  it("does not request persistence when it was already granted", async () => {
    const persist = vi.fn();
    mockStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(requestStoragePersistence()).resolves.toEqual({ state: "granted", persisted: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistence and reports a browser denial", async () => {
    mockStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    await expect(requestStoragePersistence()).resolves.toEqual({ state: "not-granted", persisted: false });
  });

  it("turns browser API failures into a non-fatal status", async () => {
    mockStorage({ persisted: vi.fn().mockRejectedValue(new Error("blocked")), persist: vi.fn() });
    await expect(inspectStoragePersistence()).resolves.toEqual({ state: "error", persisted: false });
  });
});
