import { isAddress } from "viem";
import type { ChainSnapshot, EthereumAddress, TrackerState } from "../domain/types";
import { TrackerError } from "./errors";

const DECIMAL_INTEGER = /^(0|[1-9][0-9]*)$/;

/** Validate and canonicalise a user-provided address without requiring a wallet. */
export function normalizeAddress(value: unknown): EthereumAddress {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new TrackerError(
      "invalid-address",
      "Inserisci un indirizzo Ethereum valido (0x seguito da 40 caratteri esadecimali).",
    );
  }
  return value.toLowerCase() as EthereumAddress;
}

export function validateRpcUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TrackerError("invalid-rpc-url", "L'endpoint RPC non può essere vuoto.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new TrackerError("invalid-rpc-url", "L'endpoint RPC non è un URL valido.", error);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TrackerError("invalid-rpc-url", "L'endpoint RPC deve usare HTTP o HTTPS.");
  }
  return parsed.toString();
}

export function parseWei(value: unknown, field = "amount"): bigint {
  if (typeof value !== "string" || !DECIMAL_INTEGER.test(value)) {
    throw new TrackerError("invalid-data", `${field} deve essere un intero decimale non negativo.`);
  }
  try {
    return BigInt(value);
  } catch (error) {
    throw new TrackerError("invalid-data", `${field} non è un importo valido.`, error);
  }
}

export function weiString(value: bigint): string {
  if (value < 0n) throw new TrackerError("invalid-data", "Un importo raw non può essere negativo.");
  return value.toString(10);
}

export function validateSnapshot(value: unknown): ChainSnapshot {
  if (!value || typeof value !== "object") {
    throw new TrackerError("invalid-data", "Snapshot non valido.");
  }
  const candidate = value as Record<string, unknown>;
  const address = normalizeAddress(candidate.address);
  if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 256) {
    throw new TrackerError("invalid-data", "Lo snapshot non ha un identificativo valido.");
  }
  if (typeof candidate.capturedAt !== "number" || !Number.isSafeInteger(candidate.capturedAt) || candidate.capturedAt <= 0) {
    throw new TrackerError("invalid-data", "La data dello snapshot non è valida.");
  }
  if (typeof candidate.blockNumber !== "string" || !DECIMAL_INTEGER.test(candidate.blockNumber)) {
    throw new TrackerError("invalid-data", "Il numero di blocco non è valido.");
  }
  parseWei(candidate.rethBalanceWei, "rethBalanceWei");
  parseWei(candidate.ethValueWei, "ethValueWei");
  parseWei(candidate.ethBalanceWei, "ethBalanceWei");
  parseWei(candidate.rateWei, "rateWei");
  if (candidate.rethDecimals !== undefined &&
      (typeof candidate.rethDecimals !== "number" || !Number.isInteger(candidate.rethDecimals) || candidate.rethDecimals < 0 || candidate.rethDecimals > 36)) {
    throw new TrackerError("invalid-data", "Il numero di decimali rETH non è valido.");
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
  if (!value || typeof value !== "object") throw new TrackerError("invalid-data", "Dati importati non validi.");
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.watchedAddresses) || !Array.isArray(candidate.snapshots)) {
    throw new TrackerError("invalid-data", "Il formato dei dati importati non è riconosciuto.");
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
    throw new TrackerError("invalid-data", "L'indirizzo selezionato non è tra quelli osservati.");
  }
  const rpcUrl = validateRpcUrl(candidate.rpcUrl);
  return { watchedAddresses, selectedAddress, snapshots, rpcUrl };
}
