import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_DASHBOARD_PREFERENCES, type ChainSnapshot, type DashboardPreferences, type EthereumAddress, type TrackerState } from "./domain/types";
import { calculateCumulativeRewardWei } from "./domain/calculations";
import { DEFAULT_RPC_URL, IndexedDbTrackerRepository, ViemEthereumReader, isTrackerError, normalizeAddress } from "./data";
import { getCopy } from "./i18n";
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
  onPreferencesChange?: (preferences: DashboardPreferences) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onImport?: (json: string) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

const repository = new IndexedDbTrackerRepository();
const ethereumReader = new ViemEthereumReader();
const emptyState: TrackerState = { watchedAddresses: [], snapshots: [], rpcUrl: DEFAULT_RPC_URL, preferences: DEFAULT_DASHBOARD_PREFERENCES };

function weiToNumber(wei: string) {
  try { const raw = BigInt(wei); return Number(raw / 10n ** 12n) / 1e6; } catch { return 0; }
}

function formatEth(wei: string, locale: "en" | "it", maximumFractionDigits = 4) {
  return weiToNumber(wei).toLocaleString(locale === "it" ? "it-IT" : "en-US", { minimumFractionDigits: maximumFractionDigits, maximumFractionDigits });
}

function shortAddress(address: string | undefined, fallback: string) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : fallback; }

function isAddress(value: string): value is EthereumAddress { return /^0x[a-fA-F0-9]{40}$/.test(value); }

function latestFor(snapshots: ChainSnapshot[], address?: EthereumAddress) { return snapshots.filter((snapshot) => !address || snapshot.address.toLowerCase() === address.toLowerCase()).sort((a, b) => b.capturedAt - a.capturedAt)[0]; }

function observedReward(snapshots: ChainSnapshot[], address?: EthereumAddress) {
  const rows = snapshots.filter((snapshot) => !address || snapshot.address.toLowerCase() === address.toLowerCase()).sort((a, b) => a.capturedAt - b.capturedAt);
  if (rows.length < 2) return 0;
  return weiToNumber(calculateCumulativeRewardWei(rows).toString());
}

function EmptyDashboard({ onAdd, locale }: { onAdd: (event: FormEvent<HTMLFormElement>) => void; locale: "en" | "it" }) {
  const t = getCopy(locale);
  return <div className="empty-dashboard"><span className="empty-mark"><Icon name="wallet" size={25} /></span><h2>{t.startTitle}</h2><p>{t.startCopy}</p><form onSubmit={onAdd} className="empty-form"><input name="address" aria-label={t.ethereumAddress} placeholder="0x…" autoComplete="off" /><button type="submit" className="button button-primary"><Icon name="plus" size={17} /> {t.add}</button></form></div>;
}

export function Dashboard({ state, status = "idle", errorMessage, onAddAddress, onRemoveAddress, onSelectAddress, onRefresh, onRpcUrlChange, onPreferencesChange, onExport, onImport, onClear }: DashboardProps) {
  const [addressValue, setAddressValue] = useState("");
  const [addressError, setAddressError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const preferences = state.preferences ?? DEFAULT_DASHBOARD_PREFERENCES;
  const locale = preferences.locale;
  const t = getCopy(locale);
  const numberLocale = locale === "it" ? "it-IT" : "en-US";
  const selectedAddress = state.selectedAddress ?? state.watchedAddresses[0];
  const selectedSnapshots = useMemo(() => state.snapshots.filter((snapshot) => !selectedAddress || snapshot.address.toLowerCase() === selectedAddress.toLowerCase()), [state.snapshots, selectedAddress]);
  const latest = latestFor(state.snapshots, selectedAddress);
  const first = [...selectedSnapshots].sort((a, b) => a.capturedAt - b.capturedAt)[0];
  const delta = observedReward(state.snapshots, selectedAddress);
  const percent = first && latest && weiToNumber(first.ethValueWei) ? (delta / weiToNumber(first.ethValueWei)) * 100 : 0;
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = addressValue.trim();
    if (!isAddress(candidate)) { setAddressError(t.validAddress); return; }
    setAddressError(""); await onAddAddress?.(candidate); setAddressValue("");
  };
  const addressForm = <form className="address-form" onSubmit={onSubmit}><label htmlFor="address-input" className="sr-only">{t.addressToWatch}</label><Icon name="wallet" size={18} /><input id="address-input" value={addressValue} onChange={(event) => setAddressValue(event.target.value)} placeholder={t.addressPlaceholder} autoComplete="off" spellCheck={false} aria-describedby={addressError ? "address-error" : undefined} />{addressValue && <button type="button" className="clear-input" aria-label={t.clearAddress} onClick={() => setAddressValue("")}>×</button>}<button type="submit" className="button button-primary"><Icon name="plus" size={16} /> {t.add}</button></form>;
  const updatedLabel = latest ? `${t.updated} ${new Intl.DateTimeFormat(numberLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(latest.capturedAt))}` : t.waitingForData;

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { if (addressError) setAddressError(t.validAddress); }, [locale]);

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#dashboard" aria-label={`rETH Compass, ${t.navDashboard}`}><span className="brand-symbol"><span /></span><span>rETH <em>Compass</em></span></a><nav className={`main-nav ${mobileNavOpen ? "is-open" : ""}`} aria-label={t.navDashboard}><a className="active" href="#dashboard" onClick={() => setMobileNavOpen(false)}>{t.navDashboard}</a><a href="#storico" onClick={() => setMobileNavOpen(false)}>{t.navHistory}</a><a href="#impostazioni" onClick={() => setMobileNavOpen(false)}>{t.navSettings}</a></nav><div className="network-badge"><span className="pulse-dot" /> {t.network} <Icon name="chevron" size={13} /></div><button type="button" className="mobile-menu" aria-label={mobileNavOpen ? t.closeMenu : t.openMenu} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((value) => !value)}><Icon name="menu" size={20} /></button></header>
    <main className="main-content" id="dashboard">
      <section className="hero"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.heroTitle}<br /><span>{t.heroTitleAccent}</span></h1><p className="hero-copy">{t.heroCopy}</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-middle" /><div className="orbit-core"><span>r</span></div><div className="orbit-dot dot-a" /><div className="orbit-dot dot-b" /></div></section>
      <section className="watch-bar" aria-labelledby="watch-title"><div className="section-label"><span className="label-kicker">01</span><h2 id="watch-title">{t.watchedAddresses}</h2></div>{addressForm}{addressError && <p className="form-error" id="address-error" role="alert">{addressError}</p>}{state.watchedAddresses.length > 0 && <div className="address-list" aria-label={t.watchedAddresses}>{state.watchedAddresses.map((address) => <div key={address} className={`address-pill ${address.toLowerCase() === selectedAddress?.toLowerCase() ? "selected" : ""}`}><button type="button" onClick={() => void onSelectAddress?.(address)} aria-pressed={address.toLowerCase() === selectedAddress?.toLowerCase()}><span className="address-identicon">{address.slice(2, 4).toUpperCase()}</span><span>{shortAddress(address, t.waitingForData)}</span>{address.toLowerCase() === selectedAddress?.toLowerCase() && <span className="selected-dot" />}</button><button type="button" className="remove-address" aria-label={`${t.remove} ${shortAddress(address, t.waitingForData)}`} onClick={() => void onRemoveAddress?.(address)}>×</button></div>)}</div>}</section>
      {status === "error" && <div className="state-banner error" role="alert"><Icon name="info" size={18} /><span>{errorMessage ?? t.updateError}</span><button type="button" className="button button-small" onClick={() => void onRefresh?.()}>{t.retry}</button></div>}
      {status === "loading" && <div className="state-banner loading" role="status"><span className="spinner" /> {t.loading}</div>}
      {!state.watchedAddresses.length ? <EmptyDashboard onAdd={onSubmit} locale={locale} /> : <>
        {preferences.visibleSections.overview && <section className="overview-section" aria-labelledby="overview-title"><div className="section-heading"><div><p className="section-kicker">{t.overviewKicker}</p><h2 id="overview-title">{t.yourPosition}</h2></div><div className="heading-actions"><span className="last-updated">{updatedLabel}</span><button type="button" className="button button-icon-label" onClick={() => void onRefresh?.()} disabled={status === "loading"}><Icon name="refresh" size={16} /> {t.refresh}</button></div></div><div className="selected-address"><span className="address-identicon large">{selectedAddress?.slice(2, 4).toUpperCase()}</span><span><small>{t.selectedAddress}</small><strong>{shortAddress(selectedAddress, t.waitingForData)}</strong></span><span className="chain-tag">ETH</span></div><div className="metric-grid"><article className="metric-card primary"><div className="metric-top"><span>{t.protocolValue}</span><span className="metric-icon"><Icon name="chart" size={17} /></span></div><strong className="metric-number">{latest ? formatEth(latest.ethValueWei, locale) : "—"} <small>ETH</small></strong><span className="metric-foot">{t.protocolValueHelp}</span></article><article className="metric-card"><div className="metric-top"><span>{t.rethBalance}</span><span className="metric-icon"><Icon name="wallet" size={17} /></span></div><strong className="metric-number">{latest ? formatEth(latest.rethBalanceWei, locale) : "—"} <small>rETH</small></strong><span className="metric-foot">{t.rethBalanceHelp}</span></article><article className="metric-card"><div className="metric-top"><span>{t.observedGrowth}</span><span className="metric-icon positive"><Icon name="arrowUpRight" size={17} /></span></div><strong className="metric-number positive">{delta >= 0 ? "+" : "−"}{Math.abs(delta).toLocaleString(numberLocale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <small>ETH</small></strong><span className="metric-foot"><span className="positive">{percent >= 0 ? "+" : ""}{percent.toFixed(2)}%</span> {t.sinceFirst}</span></article><article className="metric-card"><div className="metric-top"><span>{t.rethRate}</span><span className="metric-icon rate">↗</span></div><strong className="metric-number">{latest ? formatEth(latest.rateWei, locale) : "—"} <small>ETH</small></strong><span className="metric-foot">{t.rateHelp}</span></article></div></section>}
        {preferences.visibleSections.overview && <section className="insight-card"><span className="insight-icon"><Icon name="info" size={21} /></span><div><h3>{t.observedYieldTitle}</h3><p>{t.observedYieldCopy}</p></div><a href="https://docs.rocketpool.net/" target="_blank" rel="noreferrer">{t.howItWorks} <Icon name="external" size={14} /></a></section>}
        {preferences.visibleSections.chart && <section className="chart-section" aria-labelledby="chart-title"><div className="section-heading"><div><p className="section-kicker">{t.observationsKicker}</p><h2 id="chart-title">{t.valueOverTime}</h2></div><div className="chart-legend"><span /> {t.protocolValueLegend} <span className="legend-muted" /> {t.observationsLegend}</div></div><div className="chart-card"><ObservationChart snapshots={selectedSnapshots} locale={locale} /></div></section>}
        {preferences.visibleSections.history && <section className="history-section" id="storico" aria-labelledby="history-title"><div className="section-heading"><div><p className="section-kicker">{t.historyKicker}</p><h2 id="history-title">{t.observationHistory}</h2></div><span className="observation-count">{selectedSnapshots.length} {selectedSnapshots.length === 1 ? t.observation : t.observations}</span></div><div className="history-card"><HistoryTable snapshots={selectedSnapshots} locale={locale} /></div></section>}
      </>}
      <SettingsPanel rpcUrl={state.rpcUrl} preferences={preferences} onRpcUrlChange={onRpcUrlChange} onPreferencesChange={onPreferencesChange} onExport={onExport} onImport={onImport} onClear={onClear} />
    </main>
    <footer className="footer"><span>rETH Compass <span className="footer-separator">/</span> {t.footer}</span><span className="footer-links"><a href="https://rocketpool.net/" target="_blank" rel="noreferrer">Rocket Pool <Icon name="external" size={12} /></a><a href="https://github.com/LucaSforza/reth-tracker" target="_blank" rel="noreferrer">Open source <Icon name="external" size={12} /></a></span></footer>
  </div>;
}

export function App() {
  const [state, setState] = useState<TrackerState>(emptyState);
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>();

  const reportError = (error: unknown) => {
    setStatus("error");
    setErrorMessage(isTrackerError(error) || error instanceof Error ? error.message : getCopy(state.preferences?.locale ?? "en").unexpectedError);
  };

  useEffect(() => {
    let active = true;
    repository.load()
      .then((loaded) => { if (active) { setState(loaded); setStatus("idle"); } })
      .catch((error) => { if (active) reportError(error); });
    return () => { active = false; };
  }, []);

  const captureSnapshot = async (address: EthereumAddress, rpcUrl: string) => {
    const snapshot = await ethereumReader.readSnapshot(address, rpcUrl);
    const saved = await repository.saveSnapshot(snapshot);
    setState(saved);
  };

  const addAddress = async (value: EthereumAddress) => {
    setStatus("loading"); setErrorMessage(undefined);
    try { const address = normalizeAddress(value); await repository.addAddress(address); const selected = await repository.selectAddress(address); setState(selected); await captureSnapshot(address, selected.rpcUrl); setStatus("idle"); }
    catch (error) { reportError(error); }
  };

  const removeAddress = async (address: EthereumAddress) => {
    try { setState(await repository.removeAddress(address)); setStatus("idle"); setErrorMessage(undefined); }
    catch (error) { reportError(error); }
  };

  const selectAddress = async (address?: EthereumAddress) => {
    try { setState(await repository.selectAddress(address)); }
    catch (error) { reportError(error); }
  };

  const refresh = async () => {
    const address = state.selectedAddress ?? state.watchedAddresses[0];
    if (!address) return;
    setStatus("loading"); setErrorMessage(undefined);
    try { await captureSnapshot(address, state.rpcUrl); setStatus("idle"); }
    catch (error) { reportError(error); }
  };

  const saveRpcUrl = async (rpcUrl: string) => {
    try { setState(await repository.setRpcUrl(rpcUrl)); setStatus("idle"); setErrorMessage(undefined); }
    catch (error) { reportError(error); throw error; }
  };

  const savePreferences = async (preferences: DashboardPreferences) => {
    try { setState(await repository.setPreferences(preferences)); setErrorMessage(undefined); }
    catch (error) { reportError(error); throw error; }
  };

  const exportData = async () => {
    try { const blob = new Blob([await repository.exportJson()], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "reth-compass-backup.json"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
    catch (error) { reportError(error); }
  };

  const importData = async (json: string) => {
    try { setState(await repository.importJson(json)); setStatus("idle"); setErrorMessage(undefined); }
    catch (error) { reportError(error); throw error; }
  };

  const clearData = async () => {
    try { setState(await repository.clear()); setStatus("idle"); setErrorMessage(undefined); }
    catch (error) { reportError(error); }
  };

  return <Dashboard state={state} status={status} errorMessage={errorMessage} onAddAddress={addAddress} onRemoveAddress={removeAddress} onSelectAddress={selectAddress} onRefresh={refresh} onRpcUrlChange={saveRpcUrl} onPreferencesChange={savePreferences} onExport={exportData} onImport={importData} onClear={clearData} />;
}

export default App;
