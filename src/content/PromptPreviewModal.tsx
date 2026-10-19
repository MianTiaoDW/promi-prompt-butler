import { FavoriteButton } from "./FavoriteButton";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Close, Copy, Eye, Image, PencilLine, Plus, Sparkles, X } from "../components/PromiIcons";

import type { PromptGroup, PromptOutputFormat, SavedPromptRecord } from "../types/prompt";
import { useModalFocus } from "../hooks/useModalFocus";
import { MOTION } from "../lib/motion";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { dataUrlToObjectUrl, deleteExampleImageAsset, getExampleImagePayload, MAX_EXAMPLE_IMAGES, saveExampleImage } from "../lib/example-images";
import { updateFavoritePrompt } from "../lib/prompt-library";
import { getPromptGroup, isCollectedPrompt } from "../lib/prompt-group";
import { PromptGroupSteps } from "./PromptGroupSteps";
import { showToast } from "../lib/toast";

interface PromptPreviewModalProps {
  record: SavedPromptRecord | null;
  isCopied: boolean;
  isFavorite: boolean;
  onClose: () => void;
  onCopy: () => void;
  onSave: (content: string) => void;
  onEditGroup?: () => void;
  onSaveGroup?: (group: PromptGroup) => Promise<void>;
  onToggleFavorite: () => void;
  onUsePrompt?: () => void;
  onOptimize?: () => void;
  sourceLabel?: string;
  showLibraryActions?: boolean;
  allowEditing?: boolean;
}

const sectionLabels: Record<PromptOutputFormat, string> = {
  cnPrompt: "中文提示词",
  enPrompt: "English Prompt",
  structuredPrompt: "高级结构 JSON"
};

export function PromptPreviewModal({
  record,
  isCopied,
  isFavorite,
  onClose,
  onCopy,
  onSave,
  onEditGroup,
  onSaveGroup,
  onToggleFavorite,
  onUsePrompt,
  onOptimize,
  sourceLabel,
  showLibraryActions = true,
  allowEditing = true
}: PromptPreviewModalProps) {
  const collected = Boolean(record && isCollectedPrompt(record));
  const group = record ? getPromptGroup(record) : null;
  const [expandedSections, setExpandedSections] = useState<PromptOutputFormat[]>(["cnPrompt"]);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [exampleIds, setExampleIds] = useState<string[]>([]);
  const [exampleUrls, setExampleUrls] = useState<Record<string, string | null>>({});
  const [previewExample, setPreviewExample] = useState<{ id: string; url: string } | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [isUpdatingExamples, setIsUpdatingExamples] = useState(false);
  const replaceIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useModalFocus<HTMLElement>(Boolean(record), onClose);

  useEffect(() => {
    if (!record) return;
    setDraftContent(record.content);
    setIsEditing(false);
    setPreviewExample(null);
    setExampleIds((record.exampleImageIds ?? []).slice(0, MAX_EXAMPLE_IMAGES));
    setReplaceMode(false);
    setExpandedSections(["cnPrompt"]);
  }, [record]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    setExampleUrls({});
    void Promise.all(exampleIds.map(async (id) => {
      try {
        const payload = await getExampleImagePayload(id);
        if (!payload) return [id, null] as const;
        const url = dataUrlToObjectUrl(payload.dataUrl);
        objectUrls.push(url);
        return [id, url] as const;
      } catch {
        return [id, null] as const;
      }
    })).then((entries) => { if (!cancelled) setExampleUrls(Object.fromEntries(entries)); });
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [exampleIds]);

  const persistIds = async (ids: string[]) => {
    await updateFavoritePrompt(record!.id, { exampleImageIds: ids, imageStorageVersion: 2, linkedImages: [] });
    setExampleIds(ids);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !record) return;
    const replacementIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;
    try {
      const available = replacementIndex === null ? MAX_EXAMPLE_IMAGES - exampleIds.length : 1;
      if (files.length > available) throw new Error(`最多还能添加 ${available} 张示例图，请重新选择。`);
      const selected = Array.from(files).slice(0, available);
      if (selected.length === 0) throw new Error("已达到 3 张上限，请先选择要替换的图片。");
      const nextIds = [...exampleIds];
      for (const file of selected) {
        const targetIndex = replacementIndex ?? nextIds.length;
        const saved = await saveExampleImage({ promptId: record.id, image: file, source: "upload", sortOrder: targetIndex, replaceImageId: replacementIndex === null ? undefined : nextIds[replacementIndex] });
        if (replacementIndex !== null) {
          if (nextIds.some((id, index) => id === saved.image.id && index !== replacementIndex)) {
            throw new Error("这张图片已经存在于当前 Prompt 的示例图中。");
          }
          const oldId = nextIds[replacementIndex];
          nextIds[replacementIndex] = saved.image.id;
          if (oldId && oldId !== saved.image.id) await deleteExampleImageAsset(oldId);
        } else if (!nextIds.includes(saved.image.id)) nextIds.push(saved.image.id);
      }
      await persistIds(nextIds.slice(0, MAX_EXAMPLE_IMAGES));
      setReplaceMode(false);
      showToast("示例图已添加");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "示例图上传失败。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const replaceAt = (index: number) => {
    replaceIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const deleteAt = async (index: number) => {
    if (isUpdatingExamples) return;
    setIsUpdatingExamples(true);
    try {
      const imageId = exampleIds[index];
      await deleteExampleImageAsset(imageId);
      await persistIds(exampleIds.filter((_, itemIndex) => itemIndex !== index));
      setPreviewExample(null);
      showToast("示例图已删除");
    } catch { showToast("删除示例图失败，请重试", "error"); }
    finally { setIsUpdatingExamples(false); }
  };

  const setCoverImage = async (imageId: string) => {
    if (isUpdatingExamples || exampleIds[0] === imageId) return;
    setIsUpdatingExamples(true);
    try {
      await persistIds([imageId, ...exampleIds.filter(id => id !== imageId)]);
      showToast("已更新卡片示例图");
    } catch { showToast("设置示例图失败，请重试", "error"); }
    finally { setIsUpdatingExamples(false); }
  };

  const toggleSection = (format: PromptOutputFormat) => {
    setExpandedSections((current) =>
      current.includes(format)
        ? current.filter((item) => item !== format)
        : [...current, format]
    );
  };

  return (
    <AnimatePresence>
      {record ? (
        <motion.div
          className="prompt-preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : MOTION.modalMs / 1000 }}
          onMouseDown={onClose}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-preview-title"
            tabIndex={-1}
            data-enter-confirm className="prompt-preview-modal"
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : MOTION.modalMs / 1000, ease: MOTION.easeOut }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="prompt-preview-header">
              <div className="min-w-0 flex-1">
                <h2 id="prompt-preview-title">{record.title || record.content.slice(0, 32)}</h2>
                {collected ? (group?.notes ? <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/55">{group.notes}</p> : null) : <>
                <div className="prompt-asset-tags">
                  {record.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="prompt-preview-meta">
                  <span>{record.category.split("/").slice(-1)[0]}</span>
                  <span>使用 {record.usageCount ?? record.usedCount ?? 0} 次</span>
                  <span>{record.lastUsed ?? record.lastUsedAt ? `最近使用 ${new Date(record.lastUsed ?? record.lastUsedAt ?? "").toLocaleDateString("zh-CN")}` : "尚未使用"}</span>
                  <span>v{record.version ?? "1.0"}</span>
                </div>
                <p className="prompt-preview-source">来源：{sourceLabel ?? (record.source === "ai-generated" ? "AI 生成" : record.source === "system-template" || record.id.startsWith("seed-") ? "系统模板" : "用户创建")}</p>
                </>}
              </div>
              {showLibraryActions ? <FavoriteButton active={isFavorite} onToggle={onToggleFavorite} className="prompt-preview-favorite" /> : null}
              <button type="button" onClick={onClose} aria-label="关闭预览"><X className="h-4 w-4" /></button>
            </header>

            <div className="prompt-preview-content">
              {collected && group ? <PromptGroupSteps key={record.id} group={group} onSave={onSaveGroup} /> : <>
              {(["cnPrompt", "enPrompt", "structuredPrompt"] as PromptOutputFormat[]).map((format) => {
                const sectionContent = record.contentVariants?.[format] ?? (record.format === format ? record.content : "");
                const hasContent = Boolean(sectionContent);
                const isExpanded = expandedSections.includes(format);
                return (
                  <section key={format} className="prompt-preview-section">
                    <button type="button" onClick={() => toggleSection(format)} aria-expanded={isExpanded}>
                      <span>{sectionLabels[format]}</span>
                      <ChevronDown className={`h-4 w-4 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded ? (
                        <motion.div
                          className="prompt-preview-collapsible"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: shouldReduceMotion ? 0 : MOTION.fastMs / 1000, ease: MOTION.easeOut }}
                        >
                          {hasContent ? isEditing ? (
                            <textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} className="form-field prompt-preview-editor" />
                          ) : (
                            <pre>{sectionContent}</pre>
                          ) : (
                            <p>该资产暂未包含{sectionLabels[format]}版本。</p>
                          )}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </section>
                );
              })}
              </>}
              <section className="prompt-preview-cases">
                <div className="prompt-preview-cases-heading"><span>示例效果 {exampleIds.length}/3</span></div>
                {exampleIds.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {exampleIds.map((imageId, index) => {
                      const url = exampleUrls[imageId];
                      return (
                        <div key={imageId} className="prompt-example-item">
                          <div className={`prompt-example-image ${replaceMode ? "is-replacing" : ""}`}>
                            <button type="button" className="prompt-example-view" aria-label={replaceMode ? `替换示例图 ${index + 1}` : `查看示例图 ${index + 1}`} disabled={isUpdatingExamples || (!url && !replaceMode)} onClick={() => replaceMode ? replaceAt(index) : url && setPreviewExample({ id: imageId, url })}>
                              {url ? <img src={url} alt={`示例图 ${index + 1}`} loading="lazy" decoding="async" onError={() => setExampleUrls((current) => ({ ...current, [imageId]: null }))} /> : <span className="prompt-example-unavailable">{url === undefined ? "加载中…" : "图片不可用，请重新上传"}</span>}
                              <span className="prompt-example-eye">{replaceMode ? "替换此图" : <Eye className="h-5 w-5" />}</span>
                            </button>
                            <button type="button" className="prompt-example-delete" aria-label={`删除示例图 ${index + 1}`} title="删除示例图" disabled={isUpdatingExamples} onClick={() => void deleteAt(index)}><Close className="h-3.5 w-3.5" /></button>
                          </div>
                          <button type="button" className="prompt-example-cover" aria-pressed={index === 0} title={index === 0 ? "当前卡片显示此图" : "在外面的卡片上显示此图"} disabled={isUpdatingExamples || !url} onClick={() => void setCoverImage(imageId)}>设为示例图</button>
                        </div>
                      );
                    })}
                  </div>
                ) : <p>暂无示例图<br />上传效果图，方便以后快速判断这个 Prompt 的实际生成效果。</p>}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={exampleIds.length < MAX_EXAMPLE_IMAGES} className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
                <button type="button" className="ghost-button mt-3 px-3 py-2 text-xs" onClick={() => exampleIds.length >= MAX_EXAMPLE_IMAGES ? setReplaceMode((value) => !value) : fileInputRef.current?.click()}>
                  <Plus className="h-3.5 w-3.5" />{exampleIds.length >= MAX_EXAMPLE_IMAGES ? (replaceMode ? "取消替换" : "替换示例图") : "上传示例图"}
                </button>
              </section>
            </div>

            <footer className="prompt-preview-actions">
              {collected ? (allowEditing && onEditGroup ? <button type="button" onClick={onEditGroup}><PencilLine className="h-4 w-4" />编辑</button> : null) : <>
              <button type="button" onClick={onCopy}>{isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{isCopied ? "已复制" : "一键复制 Prompt"}</button>
              {allowEditing ? isEditing ? (
                <button type="button" className="gradient-button" data-enter-submit onClick={() => { onSave(draftContent); setIsEditing(false); }}><Check className="h-4 w-4" />保存编辑</button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSections((current) => current.includes(record.format) ? current : [...current, record.format]);
                    setIsEditing(true);
                  }}
                >
                  <PencilLine className="h-4 w-4" />编辑
                </button>
              ) : null}
              {onUsePrompt ? <button type="button" className="prompt-preview-primary" onClick={onUsePrompt}><Image className="h-4 w-4" />发送到图像工坊</button> : null}
              {onOptimize ? <button type="button" className="prompt-preview-primary" onClick={onOptimize}><Sparkles className="h-4 w-4" />AI 优化 Prompt</button> : null}
              </>}
            </footer>
          </motion.section>
          <ImagePreviewModal
            image={previewExample ? { ...previewExample, alt: "示例图大图预览" } : null}
            onClose={() => setPreviewExample(null)}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
