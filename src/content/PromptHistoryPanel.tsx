import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Download, Eye, RotateCcw } from "lucide-react";
import type { ImageHistoryEntry } from "../types/image";
import { MOTION } from "../lib/motion";
import { ImagePreviewModal } from "./ImagePreviewModal";

export function PromptHistoryPanel(props: {
  entries: ImageHistoryEntry[];
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  onRestore: (entry: ImageHistoryEntry) => void;
  onDownload: (entry: ImageHistoryEntry) => void;
  onViewPrompt: (entry: ImageHistoryEntry) => void;
}) {
  const [previewEntry, setPreviewEntry] = useState<ImageHistoryEntry | null>(null);
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <section className="image-history-panel">
        <div className="image-history-heading">
          <button type="button" onClick={props.onToggle}>创作历史 <span>{props.entries.length}</span><ChevronDown className={`h-4 w-4 ${props.open ? "rotate-180" : ""}`} /></button>
          {props.entries.length > 0 ? <button type="button" onClick={props.onClear}>清空记录</button> : null}
        </div>
        <AnimatePresence initial={false}>
        {props.open ? (
          <motion.div className="image-history-collapsible" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: shouldReduceMotion ? 0 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}>
          {props.entries.length === 0 ? (
            <p className="prompt-history-empty">生成图片后，会在这里保存可恢复的创作环境。</p>
          ) : <div className="prompt-history-list">
            {props.entries.map((entry) => (
              <article key={entry.id}>
                <button
                  type="button"
                  className="prompt-history-thumbnail"
                  onClick={() => setPreviewEntry(entry)}
                  title="放大查看图片"
                  aria-label="放大查看历史生成图片"
                >
                  <img src={entry.url} alt="历史生成作品缩略图" loading="lazy" decoding="async" />
                  <span><Eye className="h-4 w-4" /></span>
                </button>
                <button type="button" className="prompt-history-main" onClick={() => props.onRestore(entry)} title="恢复此次创作环境">
                  <strong>{entry.promptTitle || entry.prompt.slice(0, 40)}</strong>
                  {entry.promptId ? <small>来源：Prompt 资产</small> : <small>来源：临时创作</small>}
                  <span>{entry.model} · {entry.aspectRatio} · {entry.resolution}</span>
                  <time>{new Date(entry.generatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                </button>
                <button type="button" className="prompt-history-icon" onClick={() => props.onViewPrompt(entry)} title="查看 Prompt" disabled={!entry.promptId}><Eye className="h-3.5 w-3.5" /></button>
                <button type="button" className="prompt-history-icon" onClick={() => props.onRestore(entry)} title="恢复"><RotateCcw className="h-3.5 w-3.5" /></button>
                <button type="button" className="prompt-history-icon" onClick={() => props.onDownload(entry)} title="下载"><Download className="h-3.5 w-3.5" /></button>
              </article>
            ))}
          </div>}
          </motion.div>
        ) : null}
        </AnimatePresence>
      </section>

      <ImagePreviewModal
        image={previewEntry ? {
          id: previewEntry.id,
          url: previewEntry.url,
          alt: previewEntry.promptTitle || "历史生成作品大图预览"
        } : null}
        onClose={() => setPreviewEntry(null)}
      />
    </>
  );
}
