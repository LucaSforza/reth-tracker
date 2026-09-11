import type { ChainSnapshot, RewardPoint } from "./types";
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
