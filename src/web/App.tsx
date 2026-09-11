import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ChainSnapshot, EthereumAddress, TrackerState } from "./domain/types";
import { Icon } from "./components/Icon";
import { ObservationChart } from "./components/ObservationChart";
import { HistoryTable } from "./components/HistoryTable";
import { SettingsPanel } from "./components/SettingsPanel";
import "./styles.css";

export type DashboardStatus = "idle" | "loading" | "error";

export interface DashboardProps {
  state: TrackerState;
  status?: DashboardStatus;
  errorMessage?: string;
  onAddAddress?: (address: EthereumAddress) => void | Promise<void>;
  onRemoveAddress?: (address: EthereumAddress) => void | Promise<void>;
  onSelectAddress?: (address?: EthereumAddress) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onRpcUrlChange?: (rpcUrl: string) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onImport?: (json: string) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

const DEMO_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" as EthereumAddress;
const now = Date.now();
const demoSnapshots: ChainSnapshot[] = [
  { id: "demo-1", address: DEMO_ADDRESS, capturedAt: now - 1000 * 60 * 60 * 24 * 28, blockNumber: "19483001", rethBalanceWei: "3205000000000000000", ethValueWei: "3628990000000000000", ethBalanceWei: "410000000000000000", rateWei: "1132250000000000000" },
  { id: "demo-2", address: DEMO_ADDRESS, capturedAt: now - 1000 * 60 * 60 * 24 * 21, blockNumber: "19512010", rethBalanceWei: "3205000000000000000", ethValueWei: "3637880000000000000", ethBalanceWei: "410000000000000000", rateWei: "1135020000000000000" },
  { id: "demo-3", address: DEMO_ADDRESS, capturedAt: now - 1000 * 60 * 60 * 24 * 14, blockNumber: "19540882", rethBalanceWei: "3205000000000000000", ethValueWei: "3648320000000000000", ethBalanceWei: "410000000000000000", rateWei: "1138280000000000000" },
  { id: "demo-4", address: DEMO_ADDRESS, capturedAt: now - 1000 * 60 * 60 * 24 * 7, blockNumber: "19570011", rethBalanceWei: "3205000000000000000", ethValueWei: "3661220000000000000", ethBalanceWei: "410000000000000000", rateWei: "1142300000000000000" },
  { id: "demo-5", address: DEMO_ADDRESS, capturedAt: now - 1000 * 60 * 60 * 24, blockNumber: "19594820", rethBalanceWei: "3205000000000000000", ethValueWei: "3666980000000000000", ethBalanceWei: "410000000000000000", rateWei: "1144090000000000000" },
];

const demoState: TrackerState = { watchedAddresses: [DEMO_ADDRESS], selectedAddress: DEMO_ADDRESS, snapshots: demoSnapshots, rpcUrl: "https://cloudflare-eth.com" };

function weiToNumber(wei: string) {
  try { const raw = BigInt(wei); return Number(raw / 10n ** 12n) / 1e6; } catch { return 0; }
}

function formatEth(wei: string, maximumFractionDigits = 4) {
  return weiToNumber(wei).toLocaleString("it-IT", { minimumFractionDigits: maximumFractionDigits, maximumFractionDigits });
}

function formatRate(wei: string) { return weiToNumber(wei).toLocaleString("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }

function shortAddress(address?: string) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Nessun indirizzo"; }

function isAddress(value: string): value is EthereumAddress { return /^0x[a-fA-F0-9]{40}$/.test(value); }

function latestFor(snapshots: ChainSnapshot[], address?: EthereumAddress) { return snapshots.filter((snapshot) => !address || snapshot.address.toLowerCase() === address.toLowerCase()).sort((a, b) => b.capturedAt - a.capturedAt)[0]; }

function changeBetween(snapshots: ChainSnapshot[], address?: EthereumAddress) {
  const rows = snapshots.filter((snapshot) => !address || snapshot.address.toLowerCase() === address.toLowerCase()).sort((a, b) => a.capturedAt - b.capturedAt);
  if (rows.length < 2) return 0;
  return weiToNumber(rows[rows.length - 1].ethValueWei) - weiToNumber(rows[0].ethValueWei);
}

function EmptyDashboard({ onAdd }: { onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="empty-dashboard"><span className="empty-mark"><Icon name="wallet" size={25} /></span><h2>Inizia dal tuo wallet</h2><p>Inserisci un indirizzo Ethereum qui sopra per osservare valore, tasso di conversione e rendimento nel tempo.</p><form onSubmit={onAdd} className="empty-form"><input name="address" aria-label="Indirizzo Ethereum" placeholder="0x…" autoComplete="off" /><button type="submit" className="button button-primary"><Icon name="plus" size={17} /> Aggiungi</button></form></div>;
}

export function Dashboard({ state, status = "idle", errorMessage, onAddAddress, onRemoveAddress, onSelectAddress, onRefresh, onRpcUrlChange, onExport, onImport, onClear }: DashboardProps) {
  const [addressValue, setAddressValue] = useState("");
  const [addressError, setAddressError] = useState("");
  const selectedAddress = state.selectedAddress ?? state.watchedAddresses[0];
  const selectedSnapshots = useMemo(() => state.snapshots.filter((snapshot) => !selectedAddress || snapshot.address.toLowerCase() === selectedAddress.toLowerCase()), [state.snapshots, selectedAddress]);
  const latest = latestFor(state.snapshots, selectedAddress);
  const first = [...selectedSnapshots].sort((a, b) => a.capturedAt - b.capturedAt)[0];
  const delta = changeBetween(state.snapshots, selectedAddress);
  const percent = first && latest && weiToNumber(first.ethValueWei) ? (delta / weiToNumber(first.ethValueWei)) * 100 : 0;
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = addressValue.trim();
    if (!isAddress(candidate)) { setAddressError("Inserisci un indirizzo Ethereum valido (0x + 40 caratteri). "); return; }
    setAddressError(""); await onAddAddress?.(candidate); setAddressValue("");
  };
  const addressForm = <form className="address-form" onSubmit={onSubmit}><label htmlFor="address-input" className="sr-only">Indirizzo Ethereum da monitorare</label><Icon name="wallet" size={18} /><input id="address-input" value={addressValue} onChange={(event) => setAddressValue(event.target.value)} placeholder="Inserisci un indirizzo Ethereum" autoComplete="off" spellCheck={false} aria-describedby={addressError ? "address-error" : undefined} />{addressValue && <button type="button" className="clear-input" aria-label="Svuota indirizzo" onClick={() => setAddressValue("")}>×</button>}<button type="submit" className="button button-primary"><Icon name="plus" size={16} /> Aggiungi</button></form>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#dashboard" aria-label="rETH Compass, dashboard"><span className="brand-symbol"><span /></span><span>rETH <em>Compass</em></span></a><nav className="main-nav" aria-label="Navigazione principale"><a className="active" href="#dashboard">Dashboard</a><a href="#storico">Storico</a><a href="#impostazioni">Impostazioni</a></nav><div className="network-badge"><span className="pulse-dot" /> Ethereum mainnet <Icon name="chevron" size={13} /></div><button type="button" className="mobile-menu" aria-label="Apri menu"><Icon name="menu" size={20} /></button></header>
    <main className="main-content" id="dashboard">
      <section className="hero"><div><p className="eyebrow">rETH / PORTFOLIO CONSOLE</p><h1>Capisci cosa sta facendo<br /><span>il tuo rETH.</span></h1><p className="hero-copy">Un modo semplice e privato per osservare il valore del tuo staking. I dati restano nel browser, sempre.</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-middle" /><div className="orbit-core"><span>r</span></div><div className="orbit-dot dot-a" /><div className="orbit-dot dot-b" /></div></section>
      <section className="watch-bar" aria-labelledby="watch-title"><div className="section-label"><span className="label-kicker">01</span><h2 id="watch-title">I tuoi indirizzi</h2></div>{addressForm}{addressError && <p className="form-error" id="address-error" role="alert">{addressError}</p>}{state.watchedAddresses.length > 0 && <div className="address-list" aria-label="Indirizzi osservati">{state.watchedAddresses.map((address) => <div key={address} className={`address-pill ${address.toLowerCase() === selectedAddress?.toLowerCase() ? "selected" : ""}`}><button type="button" onClick={() => void onSelectAddress?.(address)} aria-pressed={address.toLowerCase() === selectedAddress?.toLowerCase()}><span className="address-identicon">{address.slice(2, 4).toUpperCase()}</span><span>{shortAddress(address)}</span>{address.toLowerCase() === selectedAddress?.toLowerCase() && <span className="selected-dot" />}</button><button type="button" className="remove-address" aria-label={`Rimuovi ${shortAddress(address)}`} onClick={() => void onRemoveAddress?.(address)}>×</button></div>)}</div>}</section>
      {status === "error" && <div className="state-banner error" role="alert"><Icon name="info" size={18} /><span>{errorMessage ?? "Non è stato possibile aggiornare i dati. Controlla l'endpoint RPC e riprova."}</span><button type="button" className="button button-small" onClick={() => void onRefresh?.()}>Riprova</button></div>}
      {status === "loading" && <div className="state-banner loading" role="status"><span className="spinner" /> Lettura della blockchain in corso…</div>}
      {!state.watchedAddresses.length ? <EmptyDashboard onAdd={onSubmit} /> : <>
        <section className="overview-section" aria-labelledby="overview-title"><div className="section-heading"><div><p className="section-kicker">02 / PANORAMICA</p><h2 id="overview-title">La tua posizione</h2></div><div className="heading-actions"><span className="last-updated">{latest ? `Aggiornato ${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(latest.capturedAt))}` : "In attesa di dati"}</span><button type="button" className="button button-icon-label" onClick={() => void onRefresh?.()} disabled={status === "loading"}><Icon name="refresh" size={16} /> Aggiorna</button></div></div><div className="selected-address"><span className="address-identicon large">{selectedAddress?.slice(2, 4).toUpperCase()}</span><span><small>Indirizzo selezionato</small><strong>{shortAddress(selectedAddress)}</strong></span><span className="chain-tag">ETH</span></div><div className="metric-grid"><article className="metric-card primary"><div className="metric-top"><span>Valore protocollare</span><span className="metric-icon"><Icon name="chart" size={17} /></span></div><strong className="metric-number">{latest ? formatEth(latest.ethValueWei) : "—"} <small>ETH</small></strong><span className="metric-foot">Valore rETH convertito in ETH</span></article><article className="metric-card"><div className="metric-top"><span>Saldo rETH</span><span className="metric-icon"><Icon name="wallet" size={17} /></span></div><strong className="metric-number">{latest ? formatEth(latest.rethBalanceWei) : "—"} <small>rETH</small></strong><span className="metric-foot">Saldo dell'ultimo blocco letto</span></article><article className="metric-card"><div className="metric-top"><span>Crescita osservata</span><span className="metric-icon positive"><Icon name="arrowUpRight" size={17} /></span></div><strong className="metric-number positive">{delta >= 0 ? "+" : "−"}{Math.abs(delta).toLocaleString("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <small>ETH</small></strong><span className="metric-foot"><span className="positive">{percent >= 0 ? "+" : ""}{percent.toFixed(2)}%</span> dal primo dato</span></article><article className="metric-card"><div className="metric-top"><span>Tasso rETH</span><span className="metric-icon rate">↗</span></div><strong className="metric-number">{latest ? formatRate(latest.rateWei) : "—"} <small>ETH</small></strong><span className="metric-foot">1 rETH in ETH · dato on-chain</span></article></div></section>
        <section className="insight-card"><span className="insight-icon"><Icon name="info" size={21} /></span><div><h3>Rendimento osservato, non promessa di rendimento</h3><p>La crescita indicata riflette la differenza tra le osservazioni disponibili e può includere variazioni del saldo. Non è una stima completa della vita dell'investimento né un calcolo fiscale.</p></div><a href="https://docs.rocketpool.net/" target="_blank" rel="noreferrer">Come funziona <Icon name="external" size={14} /></a></section>
        <section className="chart-section" aria-labelledby="chart-title"><div className="section-heading"><div><p className="section-kicker">03 / OSSERVAZIONI</p><h2 id="chart-title">Valore nel tempo</h2></div><div className="chart-legend"><span /> Valore protocollare <span className="legend-muted" /> Osservazioni</div></div><div className="chart-card"><ObservationChart snapshots={selectedSnapshots} /></div></section>
        <section className="history-section" id="storico" aria-labelledby="history-title"><div className="section-heading"><div><p className="section-kicker">04 / REGISTRO</p><h2 id="history-title">Storico osservazioni</h2></div><span className="observation-count">{selectedSnapshots.length} {selectedSnapshots.length === 1 ? "osservazione" : "osservazioni"}</span></div><div className="history-card"><HistoryTable snapshots={selectedSnapshots} /></div></section>
      </>}
      <SettingsPanel rpcUrl={state.rpcUrl} onRpcUrlChange={onRpcUrlChange} onExport={onExport} onImport={onImport} onClear={onClear} />
    </main>
    <footer className="footer"><span>rETH Compass <span className="footer-separator">/</span> i tuoi dati restano nel tuo browser</span><span className="footer-links"><a href="https://rocketpool.net/" target="_blank" rel="noreferrer">Rocket Pool <Icon name="external" size={12} /></a><a href="https://github.com/" target="_blank" rel="noreferrer">Open source <Icon name="external" size={12} /></a></span></footer>
  </div>;
}

export function App() {
  const [state, setState] = useState<TrackerState>(demoState);
  const [status, setStatus] = useState<DashboardStatus>("idle");
  const addAddress = async (address: EthereumAddress) => setState((current) => ({ ...current, watchedAddresses: current.watchedAddresses.includes(address) ? current.watchedAddresses : [...current.watchedAddresses, address], selectedAddress: address }));
  const removeAddress = async (address: EthereumAddress) => setState((current) => { const watched = current.watchedAddresses.filter((item) => item !== address); return { ...current, watchedAddresses: watched, selectedAddress: current.selectedAddress === address ? watched[0] : current.selectedAddress, snapshots: current.snapshots.filter((snapshot) => snapshot.address !== address) }; });
  const refresh = async () => { setStatus("loading"); await new Promise((resolve) => window.setTimeout(resolve, 450)); setStatus("idle"); };
  const exportData = async () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "reth-compass-backup.json"; link.click(); URL.revokeObjectURL(url); };
  const importData = async (json: string) => { const incoming = JSON.parse(json) as TrackerState; if (!Array.isArray(incoming.watchedAddresses) || !Array.isArray(incoming.snapshots)) throw new Error("Invalid backup"); setState(incoming); };
  return <Dashboard state={state} status={status} onAddAddress={addAddress} onRemoveAddress={removeAddress} onSelectAddress={(address) => setState((current) => ({ ...current, selectedAddress: address }))} onRefresh={refresh} onRpcUrlChange={(rpcUrl) => setState((current) => ({ ...current, rpcUrl }))} onExport={exportData} onImport={importData} onClear={async () => setState({ watchedAddresses: [], snapshots: [], rpcUrl: state.rpcUrl })} />;
}

export default App;
