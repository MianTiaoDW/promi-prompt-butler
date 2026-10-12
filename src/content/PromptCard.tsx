import { ImagePreviewModal } from "./ImagePreviewModal";
import { FavoriteButton } from "./FavoriteButton";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { DragEventHandler, KeyboardEventHandler } from "react";
import { dataUrlToObjectUrl, getExampleImagePayload } from "../lib/example-images";
import { getPromptGroup, isCollectedPrompt } from "../lib/prompt-group";
import { Check, Copy, Eye, FolderPlus, GripVertical, Images, LoaderCircle, Sparkles, Trash2 } from "lucide-react";

import type { SavedPromptRecord } from "../types/prompt";

interface PromptCardProps {
  record: SavedPromptRecord;
  isCopied: boolean;
  isFavorite: boolean;
  isOptimizing: boolean;
  onCopy: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onOptimize: () => void;
  onDelete: () => void;
  onCollectToFolder: () => void;
  onDragStart: DragEventHandler<HTMLElement>;
  onDragEnd: DragEventHandler<HTMLElement>;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onReorderKey: KeyboardEventHandler<HTMLButtonElement>;
  isDragging: boolean;
  isDropTarget: boolean;
  isPreview: boolean;
}

export function PromptCard({
  record,
  isCopied,
  isFavorite,
  isOptimizing,
  onCopy,
  onOpen,
  onToggleFavorite,
  onOptimize,
  onDelete,
  onCollectToFolder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onReorderKey,
  isDragging,
  isDropTarget,
  isPreview
}: PromptCardProps) {
  const reduceMotion = useReducedMotion();
  const collected = isCollectedPrompt(record);
  const group = getPromptGroup(record);
  const [exampleUrl, setExampleUrl] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const firstImageId = record.exampleImageIds?.[0];
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setExampleUrl(null);
    if (firstImageId) void getExampleImagePayload(firstImageId).then((payload) => {
      if (!cancelled && payload) {
        objectUrl = dataUrlToObjectUrl(payload.dataUrl);
        setExampleUrl(objectUrl);
      }
    }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [firstImageId]);
  const title = record.title || record.content.slice(0, 32);
  const linkedImageCount = record.exampleImageIds?.length ?? 0;

  return (
    <>
    <motion.article
      layout={reduceMotion ? false : "position"}
      initial={false}
      animate={{ scale: !reduceMotion && isDragging ? 1.035 : 1, rotate: !reduceMotion && isDragging ? -1 : 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 23, mass: 0.8 }}
      className={`prompt-asset-card ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""} ${isPreview ? "is-sort-preview" : ""}`}
      onDragOver={onDragOver} onDrop={onDrop}>
      <div className="flex min-w-0 flex-1 gap-4">
      <button type="button" className="prompt-card-open" onClick={onOpen}>
        <h3>{title}</h3>
        <p>{collected ? group.notes || group.steps[0]?.content : record.content}</p>
      </button>
      {exampleUrl ? <button type="button" className="prompt-card-image-preview w-[32%] max-w-[160px] shrink-0 self-stretch overflow-hidden rounded-xl" onClick={() => setIsImagePreviewOpen(true)} aria-label="查看提示词示例图"><img src={exampleUrl} alt={`${title}的示例图`} className="h-full min-h-[100px] w-full object-cover" loading="lazy" /><span className="prompt-card-image-eye"><Eye className="h-5 w-5" /></span></button> : null}
      </div>

      {!collected ? <div className={`prompt-card-case-count ${linkedImageCount > 0 ? "has-cases" : ""}`}>
        <Images className="h-3.5 w-3.5" />
        {linkedImageCount > 0 ? `${linkedImageCount} 张示例图` : "暂无示例图"}
      </div> : null}

      <footer className="prompt-card-footer">
        {!collected ? <div className="prompt-asset-tags">
          {record.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div> : <span className="whitespace-nowrap text-xs text-white/45">{group.steps.length} 步</span>}
        <div className="prompt-card-actions">
          <button type="button" className="prompt-drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onKeyDown={onReorderKey} title="拖动调整顺序，也可用方向键调整" aria-label="调整提示词顺序"><GripVertical className="h-4 w-4" /></button>
          <button type="button" onClick={onCopy} title="复制提示词" aria-label="复制提示词">
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          {!collected ? <>
          <button type="button" onClick={onOptimize} disabled={isOptimizing} title="AI 优化" aria-label="AI 优化">
            {isOptimizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
          </> : null}
          <FavoriteButton active={isFavorite} onToggle={onToggleFavorite} />
          <button type="button" onClick={onCollectToFolder} title="收藏到文件夹" aria-label="收藏到文件夹"><FolderPlus className="h-4 w-4" /></button>
          <button type="button" onClick={onDelete} title="删除 Prompt" aria-label="删除 Prompt" className="prompt-card-action-delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </motion.article>
    <ImagePreviewModal image={isImagePreviewOpen && exampleUrl ? { id: firstImageId, url: exampleUrl, alt: `${title}的示例图` } : null} onClose={() => setIsImagePreviewOpen(false)} />
    </>
  );
}
