import type { ChainSnapshot } from "../domain/types";
import type { Locale } from "../domain/types";
import { getCopy } from "../i18n";
import { Icon } from "./Icon";

interface HistoryTableProps { snapshots: ChainSnapshot[]; locale: Locale; }

function formatWei(wei: string, locale: Locale, fraction = 6) {
  try {
    const negative = wei.startsWith("-");
    const raw = BigInt(negative ? wei.slice(1) : wei);
    const unit = 10n ** 18n;
    const whole = raw / unit;
    const decimals = (raw % unit).toString().padStart(18, "0").slice(0, fraction).replace(/0+$/, "");
    return `${negative ? "−" : ""}${whole.toLocaleString(locale === "it" ? "it-IT" : "en-US")}${decimals ? `${locale === "it" ? "," : "."}${decimals}` : ""}`;
  } catch { return "—"; }
}

function shortDate(timestamp: number, locale: Locale) { return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp)); }

export function HistoryTable({ snapshots, locale }: HistoryTableProps) {
  const t = getCopy(locale);
  const rows = [...snapshots].sort((a, b) => b.capturedAt - a.capturedAt);
  if (!rows.length) return <div className="empty-state compact"><span className="empty-icon"><Icon name="chart" size={22} /></span><strong>{t.noObservations}</strong><p>{t.noObservationsCopy}</p></div>;
  const numberLocale = locale === "it" ? "it-IT" : "en-US";
  return <div className="history-table-scroll"><table className="history-table"><caption className="sr-only">{t.observationHistory}</caption><thead><tr><th>{t.date}</th><th>{t.rethValue}</th><th>{t.equivalentValue}</th><th>{t.block}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="table-date">{shortDate(row.capturedAt, locale)}</span><small>{new Date(row.capturedAt).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })}</small></td><td>{formatWei(row.rethBalanceWei, locale)} rETH</td><td className="table-value">{formatWei(row.ethValueWei, locale)} ETH</td><td><code>#{Number(row.blockNumber).toLocaleString(numberLocale)}</code></td></tr>)}</tbody></table></div>;
}
