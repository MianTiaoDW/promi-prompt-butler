import { useState } from "react";
import { Check, Folder, Plus, X } from "../components/PromiIcons";
import { useModalFocus } from "../hooks/useModalFocus";
import { createPromptFolder } from "../lib/prompt-library";
import { belongsToFolder } from "../lib/prompt-organization";
import type { PromptFolder, SavedPromptRecord } from "../types/prompt";

export function PromptFolderPicker({ record, folders, onClose, onConfirm }: {
  record: SavedPromptRecord;
  folders: PromptFolder[];
  onClose: () => void;
  onConfirm: (folderId: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) onClose(); };
  const dialogRef = useModalFocus<HTMLDivElement>(true, close);
  const createFolder = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const folder = await createPromptFolder(name, "收藏");
      setSelectedId(folder.id);
      setName("");
    } catch (error) { setError(error instanceof Error ? error.message : "新建收藏夹失败，请重试。"); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (busy || !selectedId) return;
    setBusy(true);
    setError("");
    try { await onConfirm(selectedId); }
    catch (error) { setError(error instanceof Error ? error.message : "收藏失败，请重试。"); }
    finally { setBusy(false); }
  };

  return <div className="prompt-folder-picker-backdrop" onClick={close}>
    <div ref={dialogRef} className="prompt-folder-picker" role="dialog" aria-modal="true" aria-label="收藏到文件夹" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
      <header><div><h2>收藏到文件夹</h2><p>{record.title || record.content.slice(0, 32)}</p></div><button type="button" className="icon-button" aria-label="关闭文件夹选择" disabled={busy} onClick={close}><X className="h-4 w-4" /></button></header>
      <div className="prompt-folder-picker-list" role="radiogroup" aria-label="选择收藏夹">
        {folders.map((folder) => <button key={folder.id} type="button" role="radio" aria-checked={selectedId === folder.id} disabled={busy} onClick={() => setSelectedId(folder.id)} className={selectedId === folder.id ? "is-selected" : ""}>
          <Folder className="h-4 w-4 shrink-0" /><span>{folder.name}{belongsToFolder(record, folder) ? <small>已在此收藏夹</small> : null}</span>{selectedId === folder.id ? <Check className="h-4 w-4 shrink-0" /> : null}
        </button>)}
        {folders.length === 0 ? <p className="text-sm text-white/55">还没有收藏夹，在下方新建一个。</p> : null}
      </div>
      <form data-enter-confirm className="prompt-folder-picker-create" onSubmit={(event) => { event.preventDefault(); void createFolder(); }}>
        <label htmlFor="prompt-new-folder-name">新建收藏夹</label>
        <div><input id="prompt-new-folder-name" className="form-field" placeholder="收藏夹名称" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} /><button className="gradient-button px-3 py-2 text-sm" data-enter-submit type="submit" disabled={busy || !name.trim()}><Plus className="h-4 w-4" />新建并选中</button></div>
      </form>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <footer><button type="button" className="ghost-button px-4 py-2 text-sm" disabled={busy} onClick={close}>取消</button><button type="button" className="gradient-button px-4 py-2 text-sm" disabled={busy || !selectedId || !folders.some((folder) => folder.id === selectedId)} onClick={() => void confirm()}>{busy ? "处理中…" : "确认收藏"}</button></footer>
    </div>
  </div>;
}
