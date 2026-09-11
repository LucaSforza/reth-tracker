import { isAddress } from "viem";
import { DEFAULT_DASHBOARD_PREFERENCES, type ChainSnapshot, type DashboardPreferences, type EthereumAddress, type HistoricalSyncState, type ProtocolRateSample, type RethTransferRecord, type TrackerState } from "../domain/types";
import { TrackerError } from "./errors";

const DECIMAL_INTEGER = /^(0|[1-9][0-9]*)$/;

/** Validate and canonicalise a user-provided address without requiring a wallet. */
export function normalizeAddress(value: unknown): EthereumAddress {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new TrackerError(
      "invalid-address",
      "Enter a valid Ethereum address (0x followed by 40 hexadecimal characters).",
    );
  }
  return value.toLowerCase() as EthereumAddress;
}

export function validateRpcUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TrackerError("invalid-rpc-url", "The RPC endpoint cannot be empty.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new TrackerError("invalid-rpc-url", "The RPC endpoint is not a valid URL.", error);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TrackerError("invalid-rpc-url", "The RPC endpoint must use HTTP or HTTPS.");
  }
  return parsed.toString();
}

export function parseWei(value: unknown, field = "amount"): bigint {
  if (typeof value !== "string" || !DECIMAL_INTEGER.test(value)) {
    throw new TrackerError("invalid-data", `${field} must be a non-negative decimal integer.`);
  }
  try {
    return BigInt(value);
  } catch (error) {
    throw new TrackerError("invalid-data", `${field} is not a valid amount.`, error);
  }
}

export function weiString(value: bigint): string {
  if (value < 0n) throw new TrackerError("invalid-data", "A raw amount cannot be negative.");
  return value.toString(10);
}

export function validateSnapshot(value: unknown): ChainSnapshot {
  if (!value || typeof value !== "object") {
    throw new TrackerError("invalid-data", "Snapshot is not valid.");
  }
  const candidate = value as Record<string, unknown>;
  const address = normalizeAddress(candidate.address);
  if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 256) {
    throw new TrackerError("invalid-data", "Snapshot does not have a valid identifier.");
  }
  if (typeof candidate.capturedAt !== "number" || !Number.isSafeInteger(candidate.capturedAt) || candidate.capturedAt <= 0) {
    throw new TrackerError("invalid-data", "Snapshot timestamp is not valid.");
  }
  if (typeof candidate.blockNumber !== "string" || !DECIMAL_INTEGER.test(candidate.blockNumber)) {
    throw new TrackerError("invalid-data", "Block number is not valid.");
  }
  parseWei(candidate.rethBalanceWei, "rethBalanceWei");
  parseWei(candidate.ethValueWei, "ethValueWei");
  parseWei(candidate.ethBalanceWei, "ethBalanceWei");
  parseWei(candidate.rateWei, "rateWei");
  if (candidate.rethDecimals !== undefined &&
      (typeof candidate.rethDecimals !== "number" || !Number.isInteger(candidate.rethDecimals) || candidate.rethDecimals < 0 || candidate.rethDecimals > 36)) {
    throw new TrackerError("invalid-data", "rETH decimals are not valid.");
  }
  return {
    id: candidate.id,
    address,
    capturedAt: candidate.capturedAt,
    blockNumber: candidate.blockNumber,
    rethBalanceWei: candidate.rethBalanceWei as string,
    ethValueWei: candidate.ethValueWei as string,
    ethBalanceWei: candidate.ethBalanceWei as string,
    rateWei: candidate.rateWei as string,
    ...(candidate.rethDecimals === undefined ? {} : { rethDecimals: candidate.rethDecimals as number }),
  };
}

export function validateState(value: unknown): TrackerState {
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Imported data is not valid.");
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.watchedAddresses) || !Array.isArray(candidate.snapshots)) {
    throw new TrackerError("invalid-data", "The imported data format is not recognised.");
  }
  const watchedAddresses = [...new Set(candidate.watchedAddresses.map(normalizeAddress))];
  const snapshots = candidate.snapshots.map(validateSnapshot);
  for (const snapshot of snapshots) {
    if (!watchedAddresses.includes(snapshot.address)) watchedAddresses.push(snapshot.address);
  }
  const selectedAddress = candidate.selectedAddress === undefined
    ? undefined
    : normalizeAddress(candidate.selectedAddress);
  if (selectedAddress && !watchedAddresses.includes(selectedAddress)) {
    throw new TrackerError("invalid-data", "The selected address is not being watched.");
  }
  const rpcUrl = validateRpcUrl(candidate.rpcUrl);
  const preferences = candidate.preferences === undefined ? DEFAULT_DASHBOARD_PREFERENCES : validatePreferences(candidate.preferences);
  const historicalTransfers = candidate.historicalTransfers === undefined ? [] : requireArray(candidate.historicalTransfers, "historicalTransfers").map(validateTransfer);
  const protocolRates = candidate.protocolRates === undefined ? [] : requireArray(candidate.protocolRates, "protocolRates").map(validateProtocolRate);
  const historicalSyncs = candidate.historicalSyncs === undefined ? [] : requireArray(candidate.historicalSyncs, "historicalSyncs").map(validateHistoricalSync);
  return { watchedAddresses, selectedAddress, snapshots, rpcUrl, preferences, historicalTransfers, protocolRates, historicalSyncs };
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new TrackerError("invalid-data", `${field} must be an array.`);
  return value;
}

function validateBlockString(value: unknown, field: string): string {
  if (typeof value !== "string" || !DECIMAL_INTEGER.test(value)) throw new TrackerError("invalid-data", `${field} is not a valid block number.`);
  return value;
}

function validateTimestamp(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new TrackerError("invalid-data", `${field} is not a valid timestamp.`);
  return value;
}

export function validateTransfer(value: unknown): RethTransferRecord {
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Historical transfer is not valid.");
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.transactionHash !== "string" || !item.id || !item.transactionHash) throw new TrackerError("invalid-data", "Historical transfer identifier is not valid.");
  parseWei(item.amountWei, "amountWei");
  return {
    id: item.id,
    trackedAddress: normalizeAddress(item.trackedAddress),
    transactionHash: item.transactionHash,
    transactionIndex: validateBlockString(item.transactionIndex, "transactionIndex"),
    logIndex: validateBlockString(item.logIndex, "logIndex"),
    blockNumber: validateBlockString(item.blockNumber, "blockNumber"),
    capturedAt: validateTimestamp(item.capturedAt, "capturedAt"),
    from: normalizeAddress(item.from),
    to: normalizeAddress(item.to),
    amountWei: item.amountWei as string,
    ...(typeof item.blockHash === "string" ? { blockHash: item.blockHash } : {}),
  };
}

export function validateProtocolRate(value: unknown): ProtocolRateSample {
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Protocol rate is not valid.");
  const item = value as Record<string, unknown>;
  parseWei(item.rateWei, "rateWei");
  return {
    blockNumber: validateBlockString(item.blockNumber, "blockNumber"),
    capturedAt: validateTimestamp(item.capturedAt, "capturedAt"),
    rateWei: item.rateWei as string,
    ...(typeof item.blockHash === "string" ? { blockHash: item.blockHash } : {}),
  };
}

export function validateHistoricalSync(value: unknown): HistoricalSyncState {
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Historical sync state is not valid.");
  const item = value as Record<string, unknown>;
  if (!["running", "error", "cancelled", "complete"].includes(item.status as string)) throw new TrackerError("invalid-data", "Historical sync status is not valid.");
  return {
    address: normalizeAddress(item.address),
    fromBlock: validateBlockString(item.fromBlock, "fromBlock"),
    targetBlock: validateBlockString(item.targetBlock, "targetBlock"),
    nextBlock: validateBlockString(item.nextBlock, "nextBlock"),
    status: item.status as HistoricalSyncState["status"],
    updatedAt: validateTimestamp(item.updatedAt, "updatedAt"),
    ...(typeof item.completedAt === "number" ? { completedAt: validateTimestamp(item.completedAt, "completedAt") } : {}),
    ...(typeof item.errorCode === "string" ? { errorCode: item.errorCode } : {}),
    ...(typeof item.errorMessage === "string" ? { errorMessage: item.errorMessage } : {}),
  };
}

export function validatePreferences(value: unknown): DashboardPreferences {
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Imported preferences are not valid.");
  const candidate = value as Record<string, unknown>;
  if (candidate.locale !== "en" && candidate.locale !== "it") throw new TrackerError("invalid-data", "The selected language is not supported.");
  const sections = candidate.visibleSections;
  if (!sections || typeof sections !== "object") throw new TrackerError("invalid-data", "Visible dashboard sections are not valid.");
  const visible = sections as Record<string, unknown>;
  if (!["overview", "chart", "history"].every((key) => typeof visible[key] === "boolean")) {
    throw new TrackerError("invalid-data", "Visible dashboard sections are not valid.");
  }
  return {
    locale: candidate.locale,
    visibleSections: {
      overview: visible.overview as boolean,
      chart: visible.chart as boolean,
      history: visible.history as boolean,
    },
  };
}
