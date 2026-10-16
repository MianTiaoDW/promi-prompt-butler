import { useEffect, useRef, useState } from "react";
import { FOLDER_COLORS, getFolderColor } from "../lib/folder-colors";
import { updatePromptFolderColor } from "../lib/prompt-library";
import { Check } from "../components/PromiIcons";
import { showToast } from "../lib/toast";
import type { PromptFolder } from "../types/prompt";

export function FolderColorPicker({ value, onChange, disabled = false }: {
  value?: string; onChange: (color: string) => void; disabled?: boolean;
}) {
  return <div className="folder-color-picker" role="radiogroup" aria-label="收藏夹颜色">
    {FOLDER_COLORS.map((color) => <button key={color.id} type="button" role="radio"
      aria-label={color.name} title={color.name} aria-checked={getFolderColor(value).id === color.id}
      disabled={disabled} className="folder-color-choice" style={{ backgroundColor: color.front, color: color.ink }}
      onClick={() => onChange(color.id)}>
      {getFolderColor(value).id === color.id ? <Check className="h-3.5 w-3.5" /> : null}
    </button>)}
  </div>;
}

export function FolderColorMenu({ folder }: { folder: PromptFolder }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const root = ref.current.getRootNode();
    const outside = (event: Event) => { if (ref.current && !event.composedPath().includes(ref.current)) ref.current.open = false; };
    const key = (event: Event) => {
      if ((event as KeyboardEvent).key === "Escape" && ref.current) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    root.addEventListener("pointerdown", outside);
    root.addEventListener("keydown", key);
    return () => { root.removeEventListener("pointerdown", outside); root.removeEventListener("keydown", key); };
  }, [open]);
  return <details ref={ref} className="folder-color-menu" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-label={`修改收藏夹 ${folder.name} 的颜色`} title="修改收藏夹颜色" onClick={(event) => event.stopPropagation()}>
      <span className="folder-color-dot" style={{ backgroundColor: getFolderColor(folder.color).front }} />
    </summary>
    <div className="folder-color-popover" onClick={(event) => event.stopPropagation()}>
      <span>收藏夹颜色</span>
      <FolderColorPicker value={folder.color} disabled={busy} onChange={(color) => {
        setBusy(true);
        void updatePromptFolderColor(folder.id, color)
          .catch(() => showToast("颜色保存失败，请重试", "error"))
          .finally(() => setBusy(false));
      }} />
    </div>
  </details>;
}
