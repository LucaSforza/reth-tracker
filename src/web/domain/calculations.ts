import type { ChainSnapshot, EthereumAddress, HistoricalYieldResult, ProtocolRateSample, RethTransferRecord, RewardPoint } from "./types";
import { parseWei } from "../data/validation";

/** rETH's exchange-rate contract methods return 1e18-scaled ETH per rETH. */
export const RATE_SCALE = 10n ** 18n;

export interface BigIntRewardPoint extends ChainSnapshot {
  intervalRewardWei: bigint;
  cumulativeRewardWei: bigint;
}

/**
 * Estimate the reward between two observations.
 *
 * Deposits and withdrawals are deliberately not counted as yield: the prior
 * rETH balance is multiplied by the change in the protocol rate. A negative
 * value is retained because it can represent a rate decrease/slashing event.
 */
export function calculateIntervalRewardWei(previous: ChainSnapshot, current: ChainSnapshot): bigint {
  assertSameAddress(previous, current);
  const previousBalance = parseWei(previous.rethBalanceWei, "previous rethBalanceWei");
  const rateDelta = parseWei(current.rateWei, "current rateWei") - parseWei(previous.rateWei, "previous rateWei");
  return (previousBalance * rateDelta) / RATE_SCALE;
}

export function calculateCumulativeRewardWei(snapshots: readonly ChainSnapshot[]): bigint {
  return aggregateRewardsBigInt(snapshots).at(-1)?.cumulativeRewardWei ?? 0n;
}

/** Aggregate chronological observations, returning serialisable decimal strings. */
export function aggregateRewards(snapshots: readonly ChainSnapshot[]): RewardPoint[] {
  return aggregateRewardsBigInt(snapshots).map((point) => ({
    ...point,
    intervalRewardWei: point.intervalRewardWei.toString(10),
    cumulativeRewardWei: point.cumulativeRewardWei.toString(10),
  }));
}

/** BigInt variant useful to charts and calculations that should not lose precision. */
export function aggregateRewardsBigInt(snapshots: readonly ChainSnapshot[]): BigIntRewardPoint[] {
  if (snapshots.length === 0) return [];
  const ordered = [...snapshots].sort((left, right) => left.capturedAt - right.capturedAt || left.id.localeCompare(right.id));
  const firstAddress = ordered[0].address.toLowerCase();
  if (ordered.some((snapshot) => snapshot.address.toLowerCase() !== firstAddress)) {
    throw new Error("Cannot aggregate snapshots belonging to different addresses.");
  }

  let cumulativeRewardWei = 0n;
  return ordered.map((snapshot, index) => {
    // Parse every raw field before returning, so malformed imported data fails
    // close to its source rather than producing a misleading chart.
    parseWei(snapshot.rethBalanceWei, "rethBalanceWei");
    parseWei(snapshot.ethValueWei, "ethValueWei");
    parseWei(snapshot.ethBalanceWei, "ethBalanceWei");
    parseWei(snapshot.rateWei, "rateWei");
    const intervalRewardWei = index === 0 ? 0n : calculateIntervalRewardWei(ordered[index - 1], snapshot);
    cumulativeRewardWei += intervalRewardWei;
    return { ...snapshot, intervalRewardWei, cumulativeRewardWei };
  });
}

export function assertSameAddress(left: ChainSnapshot, right: ChainSnapshot): void {
  if (left.address.toLowerCase() !== right.address.toLowerCase()) {
    throw new Error("Snapshots must belong to the same address.");
  }
}

function compareTransfer(left: RethTransferRecord, right: RethTransferRecord): number {
  for (const field of ["blockNumber", "transactionIndex", "logIndex"] as const) {
    const a = BigInt(left[field]);
    const b = BigInt(right[field]);
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return left.id.localeCompare(right.id);
}

/** Reconstruct ETH backing accrued while an address held rETH. Transfers only change exposure. */
export function calculateHistoricalProtocolYield(
  address: EthereumAddress,
  transfers: readonly RethTransferRecord[],
  rates: readonly ProtocolRateSample[],
  targetBlock: string,
): HistoricalYieldResult {
  const account = address.toLowerCase();
  const ordered = [...transfers].sort(compareTransfer);
  if (ordered.some((transfer) => transfer.trackedAddress.toLowerCase() !== account)) {
    throw new Error("Cannot aggregate historical transfers belonging to different addresses.");
  }
  const rateByBlock = new Map(rates.map((sample) => [sample.blockNumber, sample]));
  const groups = new Map<string, RethTransferRecord[]>();
  for (const transfer of ordered) {
    parseWei(transfer.amountWei, "transfer amountWei");
    const group = groups.get(transfer.blockNumber) ?? [];
    group.push(transfer);
    groups.set(transfer.blockNumber, group);
  }

  let started = false;
  let balance = 0n;
  let cumulative = 0n;
  let previousRate = 0n;
  let firstIncomingBlock: string | undefined;
  const points: HistoricalYieldResult["points"] = [];

  for (const [blockNumber, blockTransfers] of groups) {
    if (BigInt(blockNumber) > BigInt(targetBlock)) break;
    const incoming = blockTransfers.some((transfer) => transfer.to.toLowerCase() === account && transfer.from.toLowerCase() !== account);
    if (!started && !incoming) continue;
    const sample = rateByBlock.get(blockNumber);
    if (!sample) throw new Error(`Missing protocol rate for block ${blockNumber}.`);
    const rate = parseWei(sample.rateWei, "rateWei");
    let intervalYield = 0n;
    if (started) {
      intervalYield = (balance * (rate - previousRate)) / RATE_SCALE;
      cumulative += intervalYield;
    } else {
      started = true;
      firstIncomingBlock = blockNumber;
    }

    for (const transfer of blockTransfers) {
      const amount = parseWei(transfer.amountWei, "transfer amountWei");
      const fromSelf = transfer.from.toLowerCase() === account;
      const toSelf = transfer.to.toLowerCase() === account;
      if (toSelf && !fromSelf) balance += amount;
      if (fromSelf && !toSelf) balance -= amount;
    }
    if (balance < 0n) throw new Error(`Historical rETH balance became negative at block ${blockNumber}.`);
    previousRate = rate;
    points.push({
      address,
      blockNumber,
      capturedAt: sample.capturedAt,
      balanceWei: balance.toString(10),
      rateWei: rate.toString(10),
      intervalYieldWei: intervalYield.toString(10),
      cumulativeYieldWei: cumulative.toString(10),
    });
  }

  const terminal = rateByBlock.get(targetBlock);
  if (!terminal) throw new Error(`Missing protocol rate for terminal block ${targetBlock}.`);
  if (started && points.at(-1)?.blockNumber !== targetBlock) {
    const terminalRate = parseWei(terminal.rateWei, "terminal rateWei");
    const intervalYield = (balance * (terminalRate - previousRate)) / RATE_SCALE;
    cumulative += intervalYield;
    points.push({
      address,
      blockNumber: targetBlock,
      capturedAt: terminal.capturedAt,
      balanceWei: balance.toString(10),
      rateWei: terminalRate.toString(10),
      intervalYieldWei: intervalYield.toString(10),
      cumulativeYieldWei: cumulative.toString(10),
    });
  }

  return {
    address,
    ...(firstIncomingBlock ? { firstIncomingBlock } : {}),
    terminalBlock: targetBlock,
    terminalBalanceWei: balance.toString(10),
    cumulativeYieldWei: cumulative.toString(10),
    points,
  };
}
