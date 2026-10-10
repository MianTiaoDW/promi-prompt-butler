import { useEffect, useState } from "react";
import { dataUrlToObjectUrl, getExampleImagePayload } from "../lib/example-images";
import { getPromptGroup, isCollectedPrompt } from "../lib/prompt-group";
import { Check, Copy, Heart, Images, LoaderCircle, Sparkles, Trash2 } from "lucide-react";

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
  onDelete
}: PromptCardProps) {
  const collected = isCollectedPrompt(record);
  const group = getPromptGroup(record);
  const [exampleUrl, setExampleUrl] = useState<string | null>(null);
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
    <article className="prompt-asset-card">
      <div className="flex min-w-0 flex-1 gap-4">
      <button type="button" className="prompt-card-open" onClick={onOpen}>
        <h3>{title}</h3>
        <p>{collected ? group.notes || group.steps[0]?.content : record.content}</p>
      </button>
      {exampleUrl ? <button type="button" className="w-[32%] max-w-[160px] shrink-0 self-stretch overflow-hidden rounded-xl" onClick={onOpen} aria-label="查看提示词示例图"><img src={exampleUrl} alt={`${title}的示例图`} className="h-full min-h-[100px] w-full object-cover" loading="lazy" /></button> : null}
      </div>

      {!collected ? <div className={`prompt-card-case-count ${linkedImageCount > 0 ? "has-cases" : ""}`}>
        <Images className="h-3.5 w-3.5" />
        {linkedImageCount > 0 ? `${linkedImageCount} 张示例图` : "暂无示例图"}
      </div> : null}

      <footer className="prompt-card-footer">
        {!collected ? <div className="prompt-asset-tags">
          {record.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div> : <span className="text-xs text-white/45">{group.steps.length} 步</span>}
        <div className="prompt-card-actions">
          <button type="button" onClick={onCopy} title="复制提示词" aria-label="复制提示词">
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          {!collected ? <>
          <button type="button" onClick={onOptimize} disabled={isOptimizing} title="AI 优化" aria-label="AI 优化">
            {isOptimizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
          </> : null}
          <button
            type="button"
            onClick={onToggleFavorite}
            title={isFavorite ? "取消收藏" : "收藏"}
            aria-label={isFavorite ? "取消收藏" : "收藏"}
            className={isFavorite ? "prompt-card-action-favorite" : ""}
          >
            <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button type="button" onClick={onDelete} title="删除 Prompt" aria-label="删除 Prompt" className="prompt-card-action-delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </article>
  );
}
