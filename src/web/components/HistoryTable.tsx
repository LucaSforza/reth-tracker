import type { ChainSnapshot } from "../domain/types";
import { Icon } from "./Icon";

interface HistoryTableProps { snapshots: ChainSnapshot[]; }

function formatWei(wei: string, fraction = 6) {
  try {
    const negative = wei.startsWith("-");
    const raw = BigInt(negative ? wei.slice(1) : wei);
    const unit = 10n ** 18n;
    const whole = raw / unit;
    const decimals = (raw % unit).toString().padStart(18, "0").slice(0, fraction).replace(/0+$/, "");
    return `${negative ? "−" : ""}${whole.toLocaleString("it-IT")}${decimals ? `,${decimals}` : ""}`;
  } catch { return "—"; }
}

function shortDate(timestamp: number) { return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp)); }

export function HistoryTable({ snapshots }: HistoryTableProps) {
  const rows = [...snapshots].sort((a, b) => b.capturedAt - a.capturedAt);
  if (!rows.length) return <div className="empty-state compact"><span className="empty-icon"><Icon name="chart" size={22} /></span><strong>Nessuna osservazione ancora</strong><p>Avvia un aggiornamento per iniziare a costruire il tuo storico.</p></div>;
  return <div className="history-table-scroll"><table className="history-table"><caption className="sr-only">Storico delle osservazioni rETH</caption><thead><tr><th>Data</th><th>Valore rETH</th><th>Controvalore</th><th>Blocco</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="table-date">{shortDate(row.capturedAt)}</span><small>{new Date(row.capturedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</small></td><td>{formatWei(row.rethBalanceWei)} rETH</td><td className="table-value">{formatWei(row.ethValueWei)} ETH</td><td><code>#{Number(row.blockNumber).toLocaleString("it-IT")}</code></td></tr>)}</tbody></table></div>;
}
