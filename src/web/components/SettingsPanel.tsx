import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { DashboardPreferences, StoragePersistenceStatus } from "../domain/types";
import { getCopy } from "../i18n";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  rpcUrl: string;
  preferences: DashboardPreferences;
  onRpcUrlChange?: (rpcUrl: string) => void | Promise<void>;
  onPreferencesChange?: (preferences: DashboardPreferences) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onImport?: (json: string) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  storagePersistence?: StoragePersistenceStatus;
  onRequestStoragePersistence?: () => void | Promise<void>;
  mutationsDisabled?: boolean;
}

export function SettingsPanel({ rpcUrl, preferences, onRpcUrlChange, onPreferencesChange, onExport, onImport, onClear, storagePersistence, onRequestStoragePersistence, mutationsDisabled = false }: SettingsPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rpc, setRpc] = useState(rpcUrl);
  const [notice, setNotice] = useState("");
  const t = getCopy(preferences.locale);

  useEffect(() => setRpc(rpcUrl), [rpcUrl]);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImport) return;
    try { await onImport(await file.text()); setNotice(t.dataImported); } catch { setNotice(t.invalidFile); }
    event.target.value = "";
  };

  const saveRpc = async () => {
    try { await onRpcUrlChange?.(rpc); setNotice(t.endpointSaved); }
    catch { setNotice(t.endpointInvalid); }
  };

  const exportData = async () => {
    try { await onExport?.(); setNotice(t.backupExported); }
    catch { setNotice(t.exportFailed); }
  };

  const setLocale = (locale: DashboardPreferences["locale"]) => {
    void onPreferencesChange?.({ ...preferences, locale });
  };

  const toggleSection = (section: keyof DashboardPreferences["visibleSections"]) => {
    void onPreferencesChange?.({
      ...preferences,
      visibleSections: { ...preferences.visibleSections, [section]: !preferences.visibleSections[section] },
    });
  };

  return <section className={`settings-panel ${open ? "is-open" : ""}`} id="impostazioni">
    <button type="button" className="settings-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="settings-toggle-icon"><Icon name="settings" size={18} /></span><span><strong>{t.settings}</strong><small>{t.settingsSummary}</small></span><Icon name="chevron" size={18} /></button>
    {open && <div className="settings-content">
      <div className="settings-section preference-block"><label htmlFor="language-select">{t.language}</label><div className="language-options" role="group" aria-label={t.language}><button id="language-select" type="button" className={`language-option ${preferences.locale === "en" ? "selected" : ""}`} aria-pressed={preferences.locale === "en"} onClick={() => setLocale("en")}>EN <span>{t.english}</span></button><button type="button" className={`language-option ${preferences.locale === "it" ? "selected" : ""}`} aria-pressed={preferences.locale === "it"} onClick={() => setLocale("it")}>IT <span>{t.italian}</span></button></div></div>
      <div className="settings-section preference-block"><strong>{t.visibleSections}</strong><p className="field-help">{t.visibleSectionsHelp}</p><div className="section-options">
        <label><input type="checkbox" checked={preferences.visibleSections.overview} onChange={() => toggleSection("overview")} /> <span>{t.overviewSection}</span></label>
        <label><input type="checkbox" checked={preferences.visibleSections.chart} onChange={() => toggleSection("chart")} /> <span>{t.chartSection}</span></label>
        <label><input type="checkbox" checked={preferences.visibleSections.history} onChange={() => toggleSection("history")} /> <span>{t.historySection}</span></label>
      </div></div>
      <div className="settings-section"><label htmlFor="rpc-url">{t.rpcEndpoint}</label><p className="field-help">{t.rpcHelp}</p><div className="rpc-row"><input id="rpc-url" type="url" value={rpc} onChange={(event) => setRpc(event.target.value)} placeholder="https://..." /><button type="button" className="button button-secondary" onClick={saveRpc}>{t.save}</button></div></div>
      <div className="settings-section data-actions"><div><strong>{t.yourData}</strong><p>{t.dataHelp}</p></div><div className="action-row"><button type="button" className="button button-secondary" onClick={() => void exportData()}><Icon name="download" size={16} /> {t.export}</button><button type="button" className="button button-secondary" onClick={() => input.current?.click()} disabled={mutationsDisabled}><Icon name="upload" size={16} /> {t.import}</button><input ref={input} type="file" accept="application/json,.json" onChange={importFile} hidden disabled={mutationsDisabled} /></div></div>
      <div className="settings-section persistence-block"><strong>{t.localPersistence}</strong><p role="status" data-status={storagePersistence?.state ?? "checking"} className={`persistence-status persistence-${storagePersistence?.state ?? "checking"}`}>{storagePersistence?.state === "granted" ? t.persistenceGranted : storagePersistence?.state === "not-granted" ? t.persistenceNotGranted : storagePersistence?.state === "error" ? t.persistenceError : storagePersistence?.state === "unsupported" ? t.persistenceUnsupported : t.persistenceChecking}</p>{storagePersistence?.state !== "checking" && storagePersistence?.state !== "granted" && storagePersistence?.state !== "unsupported" && <button type="button" className="button button-secondary" onClick={() => void onRequestStoragePersistence?.()}>{t.requestPersistence}</button>}<p className="field-help">{t.persistenceBoundary}</p></div>
      <div className="settings-danger"><button type="button" className="text-danger" disabled={mutationsDisabled} onClick={() => { if (window.confirm(t.clearConfirm)) void onClear?.(); }}><Icon name="trash" size={16} /> {t.clearLocalData}</button></div>{notice && <p className="settings-notice" role="status"><Icon name="check" size={15} /> {notice}</p>}
    </div>}
  </section>;
}
