import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  rpcUrl: string;
  onRpcUrlChange?: (rpcUrl: string) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onImport?: (json: string) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

export function SettingsPanel({ rpcUrl, onRpcUrlChange, onExport, onImport, onClear }: SettingsPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rpc, setRpc] = useState(rpcUrl);
  const [notice, setNotice] = useState("");
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImport) return;
    try { await onImport(await file.text()); setNotice("Dati importati"); } catch { setNotice("File non valido"); }
    event.target.value = "";
  };
  const saveRpc = async () => {
    try { await onRpcUrlChange?.(rpc); setNotice("Endpoint salvato"); }
    catch { setNotice("Endpoint non valido o non disponibile"); }
  };
  const exportData = async () => {
    try { await onExport?.(); setNotice("Backup esportato"); }
    catch { setNotice("Impossibile esportare il backup"); }
  };
  return <section className={`settings-panel ${open ? "is-open" : ""}`} id="impostazioni">
    <button type="button" className="settings-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="settings-toggle-icon"><Icon name="settings" size={18} /></span><span><strong>Impostazioni e dati</strong><small>RPC, backup locale e privacy</small></span><Icon name="chevron" size={18} /></button>
    {open && <div className="settings-content"><div className="settings-section"><label htmlFor="rpc-url">Endpoint RPC Ethereum</label><p className="field-help">Usato solo dal tuo browser. Preferisci un endpoint personale per evitare limiti di traffico.</p><div className="rpc-row"><input id="rpc-url" type="url" value={rpc} onChange={(event) => setRpc(event.target.value)} placeholder="https://..." /><button type="button" className="button button-secondary" onClick={saveRpc}>Salva</button></div></div><div className="settings-section data-actions"><div><strong>I tuoi dati restano tuoi</strong><p>Esporta o importa lo storico in formato JSON. Nessun dato viene inviato a un server.</p></div><div className="action-row"><button type="button" className="button button-secondary" onClick={() => void exportData()}><Icon name="download" size={16} /> Esporta</button><button type="button" className="button button-secondary" onClick={() => input.current?.click()}><Icon name="upload" size={16} /> Importa</button><input ref={input} type="file" accept="application/json,.json" onChange={importFile} hidden /></div></div><div className="settings-danger"><button type="button" className="text-danger" onClick={() => { if (window.confirm("Cancellare tutti i dati locali?")) void onClear?.(); }}><Icon name="trash" size={16} /> Cancella dati locali</button></div>{notice && <p className="settings-notice" role="status"><Icon name="check" size={15} /> {notice}</p>}</div>}
  </section>;
}
