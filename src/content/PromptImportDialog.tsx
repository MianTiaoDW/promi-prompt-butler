import { useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";

export function PromptImportDialog({ file, busy, onImport, onClose }: {
  file: File;
  busy: boolean;
  onImport: (mode: "append" | "replace") => void;
  onClose: () => void;
}) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const ref = useModalFocus<HTMLDivElement>(true, () => { if (!busy) onClose(); });
  return <div className="prompt-save-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="prompt-import-title" tabIndex={-1} className="prompt-save-modal prompt-import-modal">
      <div className="prompt-import-body">
      <h2 id="prompt-import-title">{confirmReplace ? "确认覆盖提示词库？" : "选择导入方式"}</h2>
      <p className="prompt-import-filename">{file.name}</p>
      <p className="prompt-import-description">{confirmReplace
        ? "当前所有提示词和收藏夹将被导入文件替换，此操作无法撤销。API 设置和创作历史不受影响。"
        : "追加保留原有提示词，跳过重复内容；覆盖用导入文件替换当前所有提示词和收藏夹。"}</p>
      </div>
      <footer className="flex flex-wrap justify-end gap-3">
        <button type="button" className="ghost-button" disabled={busy} onClick={onClose}>取消</button>
        {confirmReplace ? <>
          <button type="button" className="ghost-button" disabled={busy} onClick={() => setConfirmReplace(false)}>返回</button>
          <button type="button" className="gradient-button" disabled={busy} onClick={() => onImport("replace")}>{busy ? "导入中…" : "确认覆盖"}</button>
        </> : <>
          <button type="button" className="gradient-button" disabled={busy} onClick={() => setConfirmReplace(true)}>覆盖导入</button>
          <button type="button" className="gradient-button" disabled={busy} onClick={() => onImport("append")}>{busy ? "导入中…" : "追加导入"}</button>
        </>}
      </footer>
    </div>
  </div>;
}
