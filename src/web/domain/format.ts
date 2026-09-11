import { RATE_SCALE } from "./calculations";

function asBigInt(value: bigint | string | number): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Display values must be safe integers.");
    return BigInt(value);
  }
  if (!/^-?[0-9]+$/.test(value)) throw new Error("Display values must be decimal integers.");
  return BigInt(value);
}

/** Format a raw integer amount without converting it to Number/float. */
export function formatUnits(value: bigint | string | number, decimals = 18, maxFractionDigits = 6): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) throw new Error("Invalid decimals.");
  if (!Number.isInteger(maxFractionDigits) || maxFractionDigits < 0 || maxFractionDigits > decimals) {
    throw new Error("Invalid fractional precision.");
  }
  const amount = asBigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const integer = absolute / base;
  if (maxFractionDigits === 0 || decimals === 0) return `${negative ? "-" : ""}${integer}`;
  const fraction = absolute % base;
  if (fraction === 0n) return `${negative ? "-" : ""}${integer}`;
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  return fractionText.length === 0
    ? `${negative ? "-" : ""}${integer}`
    : `${negative ? "-" : ""}${integer}.${fractionText}`;
}

export const formatWei = (value: bigint | string | number, maxFractionDigits = 6): string =>
  formatUnits(value, 18, maxFractionDigits);

export const formatEth = formatWei;

export function formatRate(value: bigint | string | number, maxFractionDigits = 6): string {
  return formatUnits(value, 18, maxFractionDigits);
}

/** Format a ratio as a percentage with integer arithmetic and truncation. */
export function formatPercentage(
  numerator: bigint | string | number,
  denominator: bigint | string | number,
  decimals = 2,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("Invalid percentage precision.");
  const denominatorValue = asBigInt(denominator);
  if (denominatorValue === 0n) return "—";
  const numeratorValue = asBigInt(numerator);
  const scale = 10n ** BigInt(decimals);
  const scaled = (numeratorValue * 100n * scale) / denominatorValue;
  return formatUnits(scaled, decimals, decimals) + "%";
}

export function formatRewardPercent(rewardWei: bigint | string | number, principalWei: bigint | string | number, decimals = 2): string {
  return formatPercentage(rewardWei, principalWei, decimals);
}

export function formatRateAsEth(value: bigint | string | number, maxFractionDigits = 6): string {
  return formatUnits(value, Number(RATE_SCALE.toString().length - 1), maxFractionDigits);
}
