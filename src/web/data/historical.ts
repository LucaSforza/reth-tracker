import { calculateHistoricalProtocolYield } from "../domain/calculations";
import type { EthereumAddress, HistoricalSyncState, HistoricalYieldResult, TrackerRepository } from "../domain/types";
import { TrackerError, isTrackerError } from "./errors";
import type { HistoricalChainReader } from "./ethereum-history";

export const DEFAULT_HISTORY_CHUNK_SIZE = 10_000n;
export const HISTORY_CONFIRMATIONS = 64n;
export const HISTORY_REORG_OVERLAP = 64n;

export interface HistoricalSyncProgress {
  fromBlock: string;
  toBlock: string;
  targetBlock: string;
}

export interface HistoricalSyncOptions {
  fromBlock?: string;
  chunkSize?: bigint;
  signal?: AbortSignal;
  onProgress?: (progress: HistoricalSyncProgress) => void;
}

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new TrackerError("cancelled", "Historical synchronization was cancelled. Saved progress was kept.");
}

export async function synchronizeHistoricalYield(
  address: EthereumAddress,
  rpcUrl: string,
  repository: TrackerRepository,
  reader: HistoricalChainReader,
  options: HistoricalSyncOptions = {},
): Promise<HistoricalYieldResult> {
  const previous = await repository.getHistoricalSync(address);
  const head = BigInt(await reader.getHeadBlock(rpcUrl));
  const target = head > HISTORY_CONFIRMATIONS ? head - HISTORY_CONFIRMATIONS : head;
  const origin = previous?.fromBlock ?? options.fromBlock ?? await reader.findContractStartBlock(rpcUrl);
  const checkpoint = previous ? BigInt(previous.nextBlock) : BigInt(origin);
  let next = previous ? (checkpoint - HISTORY_REORG_OVERLAP > BigInt(origin) ? checkpoint - HISTORY_REORG_OVERLAP : BigInt(origin)) : BigInt(origin);
  let chunkSize = options.chunkSize ?? DEFAULT_HISTORY_CHUNK_SIZE;
  if (chunkSize <= 0n) throw new TrackerError("sync", "Historical chunk size must be positive.");
  let sync: HistoricalSyncState = { address, fromBlock: origin, targetBlock: target.toString(), nextBlock: next.toString(), status: "running", updatedAt: Date.now() };
  await repository.saveHistoricalSync(sync);

  try {
    while (next <= target) {
      cancelled(options.signal);
      const end = next + chunkSize - 1n < target ? next + chunkSize - 1n : target;
      let records;
      try {
        records = await reader.readTransferChunk(address, rpcUrl, next.toString(), end.toString());
      } catch (error) {
        if (isTrackerError(error) && error.code === "rate-limited" && chunkSize > 100n) {
          chunkSize /= 2n;
          continue;
        }
        throw error;
      }
      sync = { ...sync, nextBlock: (end + 1n).toString(), updatedAt: Date.now() };
      await repository.saveHistoricalChunk(records, sync, previous && next < checkpoint ? { fromBlock: next.toString(), toBlock: end.toString() } : undefined);
      options.onProgress?.({ fromBlock: next.toString(), toBlock: end.toString(), targetBlock: target.toString() });
      next = end + 1n;
    }

    cancelled(options.signal);
    const transfers = await repository.getHistoricalTransfers(address);
    const requiredBlocks = [...new Set([...transfers.filter((transfer) => BigInt(transfer.blockNumber) <= target).map((transfer) => transfer.blockNumber), target.toString()])];
    const existing = new Set((await repository.getProtocolRates(requiredBlocks)).map((sample) => sample.blockNumber));
    for (const blockNumber of requiredBlocks) {
      cancelled(options.signal);
      if (!existing.has(blockNumber)) await repository.saveProtocolRates([await reader.readProtocolRate(rpcUrl, blockNumber)]);
    }
    const rates = await repository.getProtocolRates(requiredBlocks);
    const result = calculateHistoricalProtocolYield(address, transfers, rates, target.toString());
    sync = { ...sync, status: "complete", nextBlock: (target + 1n).toString(), updatedAt: Date.now(), completedAt: Date.now() };
    await repository.saveHistoricalSync(sync);
    return result;
  } catch (error) {
    const known = isTrackerError(error) ? error : new TrackerError("sync", error instanceof Error ? error.message : "Historical synchronization failed.", error);
    await repository.saveHistoricalSync({ ...sync, status: known.code === "cancelled" ? "cancelled" : "error", updatedAt: Date.now(), errorCode: known.code, errorMessage: known.message });
    throw known;
  }
}
