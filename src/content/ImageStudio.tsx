import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Download,
  LoaderCircle,
  Save,
  Sparkles,
  X
} from "../components/PromiIcons";

import { useChromeStorage } from "../hooks/useChromeStorage";
import { useExtensionSettings } from "../hooks/useExtensionSettings";
import {
  defaultImageWorkspaceState,
  IMAGE_STORAGE_KEYS
} from "../lib/image-library";
import { getImageConnectionSettings } from "../lib/provider-presets";
import { toUserFacingError } from "../lib/error-messages";
import { PROMPT_STORAGE_KEYS, savePromptToFavorites } from "../lib/prompt-library";
import { bindExampleImage, MAX_EXAMPLE_IMAGES, saveExampleImage } from "../lib/example-images";
import { storageGet, storageSet } from "../lib/storage";
import { sendRuntimeMessage, sendRuntimeMessageLong } from "../lib/runtime";
import { clearImageTask, failImageTask, getImageTask, startImageTask, subscribeImageTask } from "../lib/task-broker";
import { showToast } from "../lib/toast";
import type { GeneratedImageAsset, ImageGenerationResult, ImageHistoryEntry, ImageWorkspaceState } from "../types/image";
import type { SavedPromptRecord } from "../types/prompt";
import type { ExtensionSettings } from "../types/settings";
import { IMAGE_ASPECT_RATIOS, IMAGE_COUNTS, IMAGE_RESOLUTIONS } from "../types/settings";
import { PromptHistoryPanel } from "./PromptHistoryPanel";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { ImageParameterSelect } from "./ImageParameterSelect";
import { MOTION } from "../lib/motion";

function getGalleryAspectClass(aspectRatio: ExtensionSettings["imageAspectRatio"]) {
  if (aspectRatio === "1:1") return "aspect-square";
  if (aspectRatio === "16:9" || aspectRatio === "3:1" || aspectRatio === "8:1" || aspectRatio === "21:1") {
    return "aspect-video";
  }
  if (aspectRatio === "4:3") return "aspect-[4/3]";
  return "aspect-[3/4]";
}

export function ImageStudio(props: {
  settings: ExtensionSettings;
  isServiceReady: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { settings } = props;
  const { setImageResolution, setImageCount, setImageAspectRatio, updateSettings } = useExtensionSettings();
  const workspaceStorage = useChromeStorage<ImageWorkspaceState>(
    IMAGE_STORAGE_KEYS.workspace,
    defaultImageWorkspaceState
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<ImageGenerationResult | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedImageAsset | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewPromptRecord, setPreviewPromptRecord] = useState<SavedPromptRecord | null>(null);
  const [savedExampleIds, setSavedExampleIds] = useState<Set<string>>(new Set());
  const [pendingExampleImage, setPendingExampleImage] = useState<GeneratedImageAsset | null>(null);
  const generationLockRef = useRef(false);

  const historyStorage = useChromeStorage<ImageHistoryEntry[]>(IMAGE_STORAGE_KEYS.history, []);
  useEffect(() => {
    let cancelled = false;
    void sendRuntimeMessage<{ ok: boolean; entries?: ImageHistoryEntry[]; message?: string }>({ type: "image-history:read" }).then(result => {
      if (cancelled) return;
      if (result.ok) setImageHistory(result.entries ?? []);
      else showToast(result.message ?? "读取创作历史失败", "error");
    }).catch(() => { if (!cancelled) showToast("读取创作历史失败", "error"); });
    return () => { cancelled = true; };
  }, [historyStorage.value]);
  const clearHistory = async () => {
    try {
      const result = await sendRuntimeMessage<{ ok: boolean }>({ type: "image-history:clear" });
      if (!result.ok) throw new Error("清空创作历史失败");
      setImageHistory([]);
    } catch { showToast("清空创作历史失败", "error"); }
  };

  const { value: workspace, setValue: setWorkspace } = workspaceStorage;
  const sourcePromptRecord: SavedPromptRecord | null = workspace.source ? {
    id: workspace.source.promptId ?? "temporary-image-workspace-prompt",
    title: workspace.source.title,
    createdAt: workspace.lastUpdatedAt ?? new Date().toISOString(),
    provider: workspace.source.provider ?? settings.provider,
    model: workspace.source.model ?? settings.imageModel,
    format: workspace.source.format,
    content: workspace.prompt,
    category: "收藏",
    tags: [],
    source: workspace.source.type === "temporary" ? "ai-generated" : workspace.source.type
  } : null;

  const imageConnection = getImageConnectionSettings(settings);
  const imageConfigurationMessage = !imageConnection.apiKey
    ? "未配置生图 API Key，请前往设置页补充"
    : !imageConnection.baseUrl
      ? "未配置生图 Base URL，请前往设置页补充"
      : !settings.imageModel.trim()
        ? "未配置生图模型，请前往设置页补充"
        : "";
  const canGenerate = Boolean(!imageConfigurationMessage && workspace.prompt.trim());

  useEffect(() => {
    const applyTaskState = (task: Awaited<ReturnType<typeof getImageTask>>) => {
      if (task.status === "submitting" || task.status === "generating") {
        setIsGenerating(true);
        return;
      }
      if ((task.status === "success" || task.status === "error") && task.result) {
        setGenerationResult(task.result);
        setIsGenerating(false);
        return;
      }
      if (task.status === "error" && task.errorMessage) {
        const friendly = toUserFacingError(task.errorMessage);
        setGenerationResult({
          ok: false,
          provider: settings.provider,
          model: settings.imageModel,
          generatedAt: task.finishedAt ?? new Date().toISOString(),
          message: friendly.message
        });
      }
      setIsGenerating(false);
    };

    void getImageTask().then((task) => {
      if (task.status === "success" || task.status === "error") {
        void clearImageTask();
        return;
      }
      applyTaskState(task);
    });
    return subscribeImageTask(applyTaskState);
  }, [settings.imageModel, settings.provider]);

  const handleGenerate = async () => {
    if (generationLockRef.current || isGenerating) return;
    generationLockRef.current = true;
    setPreviewImage(null);
    setIsGenerating(true);

    try {
      await startImageTask();
      const result = await sendRuntimeMessageLong<ImageGenerationResult>(
        {
          type: "image:generate",
          payload: {
            settings,
            source: workspace.source,
            input: {
              prompt: workspace.prompt,
              count: settings.imageCount,
              resolution: settings.imageResolution,
              aspectRatio: settings.imageAspectRatio
            }
          }
        },
        async () => {
          const task = await getImageTask();
          if ((task.status === "success" || task.status === "error") && task.result) {
            return task.result;
          }
          return null;
        }
      );

      setGenerationResult(result);
      if (result.ok && result.historySaveError) showToast(result.historySaveError, "error");


    } catch (error) {
      const friendly = toUserFacingError(error);
      await failImageTask(friendly.technicalDetails);
      setGenerationResult({
        ok: false,
        provider: settings.provider,
        model: settings.imageModel,
        generatedAt: new Date().toISOString(),
        message: friendly.message
      });
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    try {
      await sendRuntimeMessage({ type: "image:cancel" });
    } catch {
      // 取消消息本身失败不影响 UI 重置
    }
    setIsGenerating(false);
    await clearImageTask();
  };

  const handleDownload = async (urls: string[], imageId?: string) => {
    if (imageId) {
      setDownloadingId(imageId);
    } else {
      setIsDownloadingAll(true);
    }

    try {
      await sendRuntimeMessage<number[]>({
        type: "image:download",
        payload: {
          urls
        }
      });
      showToast("已开始下载~");
    } catch (error) {
      showToast("下载失败，请重试。");
    } finally {
      setDownloadingId(null);
      setIsDownloadingAll(false);
    }
  };

  const handleSetExampleImage = async (image: GeneratedImageAsset, replaceIndex?: number) => {
    const promptId = workspace.source?.promptId;
    if (!promptId) {
      showToast("请先保存 Prompt，再将图片设为示例图。");
      return;
    }
    try {
      const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
      const record = records.find((item) => item.id === promptId);
      if (!record) throw new Error("请先保存 Prompt，再将图片设为示例图。");
      if ((record.exampleImageIds?.length ?? 0) >= MAX_EXAMPLE_IMAGES && replaceIndex === undefined) {
        setPendingExampleImage(image);
        return;
      }
      const saved = await saveExampleImage({
        promptId,
        source: "generated",
        image: image.url,
        sortOrder: replaceIndex ?? (record.exampleImageIds?.length ?? 0),
        replaceImageId: replaceIndex === undefined ? undefined : record.exampleImageIds?.[replaceIndex]
      });
      await bindExampleImage(promptId, saved.image.id, replaceIndex);
      setSavedExampleIds((current) => new Set(current).add(image.id));
      setPendingExampleImage(null);
      showToast(saved.duplicate ? "该图片已经是示例图" : "示例图已添加");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "示例图保存失败，请重试。");
    }
  };

  const openPromptAsset = async (promptId?: string) => {
    if (!promptId) {
      setPreviewPromptRecord(sourcePromptRecord);
      return;
    }
    const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
    const record = records.find((item) => item.id === promptId);
    if (record) setPreviewPromptRecord(record);
    else showToast("对应 Prompt 资产已不存在");
  };

  const saveCurrentPrompt = async () => {
    if (!workspace.prompt.trim()) return;
    if (workspace.source?.promptId) {
      showToast("该 Prompt 已在提示词库中");
      return;
    }
    const record = await savePromptToFavorites({
      provider: workspace.source?.provider ?? settings.provider,
      model: workspace.source?.model ?? settings.imageModel,
      format: workspace.source?.format ?? "cnPrompt",
      content: workspace.prompt,
      title: workspace.source?.title || workspace.prompt.slice(0, 28),
      category: "收藏/其他",
      source: workspace.source?.type === "temporary" ? "ai-generated" : workspace.source?.type === "ai-generated" || workspace.source?.type === "system-template" ? workspace.source.type : "user-created",
      isFavorite: true
    });
    await setWorkspace({
      ...workspace,
      source: {
        promptId: record.id,
        title: record.title,
        type: record.source ?? "user-created",
        format: record.format,
        provider: record.provider,
        model: record.model
      },
      lastUpdatedAt: new Date().toISOString()
    });
    showToast("已保存到提示词库");
  };

  const restoreHistoryEntry = async (entry: ImageHistoryEntry) => {
    await setWorkspace({ prompt: entry.prompt, lastUpdatedAt: new Date().toISOString(), source: entry.promptSource });
    await updateSettings({
      ...settings,
      imageModel: entry.model || settings.imageModel,
      imageResolution: entry.resolution as ExtensionSettings["imageResolution"],
      imageAspectRatio: entry.aspectRatio as ExtensionSettings["imageAspectRatio"],
      imageCount: entry.count as ExtensionSettings["imageCount"]
    });
    showToast("已恢复此次创作环境");
  };

  return (
    <div className="image-workbench">
      <section className="image-compose-card">
        <div className="image-workbench-heading">
          <div className="section-label">AI 图像生成</div>
          <div className="section-hint">
            调整生成参数，完善提示词，然后开始创作。
          </div>
        </div>



        <div className="image-parameter-bar">
          <ImageParameterSelect label="图像比例" value={settings.imageAspectRatio} options={IMAGE_ASPECT_RATIOS.map(value => ({ value, label: value }))} onChange={value => { void setImageAspectRatio(value as typeof settings.imageAspectRatio); }} />
          <ImageParameterSelect label="分辨率" value={settings.imageResolution} options={IMAGE_RESOLUTIONS.map(value => ({ value, label: value }))} onChange={value => { void setImageResolution(value as typeof settings.imageResolution); }} />
          <ImageParameterSelect label="生成数量" value={String(settings.imageCount)} options={IMAGE_COUNTS.map(value => ({ value: String(value), label: `${value} 张` }))} onChange={value => { void setImageCount(Number(value) as typeof settings.imageCount); }} />
        </div>

        <textarea
          value={workspace.prompt}
          onChange={(event) => {
            void setWorkspace({
              ...workspace,
              prompt: event.target.value,
              lastUpdatedAt: new Date().toISOString()
            });
          }}
          placeholder="输入用于生图的最终提示词，或先在角色设定页生成后自动带入。"
          className="form-field image-prompt-input"
        />

        <div className="image-generate-actions">
          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={!canGenerate || isGenerating}
            className="gradient-button image-generate-button"
          >
            {isGenerating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "生成中..." : "生成图片"}
          </button>

          {isGenerating ? (
            <button
              type="button"
              onClick={() => {
                void handleCancel();
              }}
              className="ghost-button image-cancel-button border-rose-400/30 bg-rose-400/10 text-rose-300 hover:text-rose-200"
            >
              <X className="h-4 w-4" />
              取消生图
            </button>
          ) : null}

        </div>

        {imageConfigurationMessage ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm leading-6 text-white/58">
            {imageConfigurationMessage}
          </div>
        ) : null}
      </section>

      <section className="image-results-panel" aria-busy={isGenerating}>
        <div className="image-results-heading">
          <div>
            <div className="section-label">本次生成结果</div>
            <div className="section-hint">生成后自动保存至 prompt-butler／创作历史</div>
          </div>
          {!isGenerating && generationResult?.ok ? <div className="image-asset-actions"><button type="button" disabled={isDownloadingAll} onClick={() => void handleDownload(generationResult.images.map((image) => image.url))}><Download className="h-4 w-4" />{isDownloadingAll ? "保存中" : "保存作品"}</button><button type="button" onClick={() => void saveCurrentPrompt()}><Save className="h-4 w-4" />保存 Prompt</button></div> : null}
        </div>

        {isGenerating ? (
          <div className="image-generation-status" role="status" aria-live="polite">
            正在生成新图片，完成后将在这里显示
          </div>
        ) : null}

        {isGenerating ? (
          <div className="image-results-grid" aria-hidden="true">
            {Array.from({ length: settings.imageCount }).map((_, index) => (
              <article key={`skeleton-${index + 1}`} className="media-card media-loading-card">
                <div className={`${getGalleryAspectClass(settings.imageAspectRatio)} media-loading-placeholder w-full`}>
                  <div className="media-loading-content">
                    <span className="media-loading-icon"><LoaderCircle className={`h-7 w-7 ${shouldReduceMotion ? "" : "animate-spin"}`} /></span>
                    <strong>图片生成中</strong>
                    <span>完成后将在这里显示</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!isGenerating && generationResult && !generationResult.ok ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-200">
            <p>{generationResult.message}</p>
            <button type="button" className="ghost-button mt-3 px-3 py-2 text-xs" onClick={() => { void handleGenerate(); }}>
              重试生成
            </button>
            {generationResult.technicalDetails && generationResult.technicalDetails !== generationResult.message ? (
              <div className="mt-3 text-xs text-white/55">
                <button type="button" className="inline-flex items-center gap-1" aria-expanded={showTechnicalDetails} onClick={() => setShowTechnicalDetails((current) => !current)}>
                  查看技术详情 <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTechnicalDetails ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showTechnicalDetails ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: shouldReduceMotion ? 0 : MOTION.fastMs / 1000, ease: MOTION.easeOut }} className="overflow-hidden">
                      <pre className="mt-2 whitespace-pre-wrap break-words">{generationResult.technicalDetails}</pre>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isGenerating && generationResult?.ok ? (
          <div className="image-results-grid">
            {generationResult.images.map((image) => (
              <article
                key={image.id}
                className="media-card"
              >
                <div className="group relative cursor-pointer">
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`${getGalleryAspectClass(settings.imageAspectRatio)} generated-image-reveal w-full object-cover transition duration-300 group-hover:scale-[1.015]`}
                    onClick={() => {
                      setPreviewImage(image);
                    }}
                  />
                  {workspace.source?.promptId ? (
                    <button
                      type="button"
                      className="image-prompt-source-badge"
                      onClick={(event) => { event.stopPropagation(); void openPromptAsset(workspace.source?.promptId); }}
                    >
                      来自 Prompt
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDownload([image.url], image.id);
                    }}
                    disabled={downloadingId === image.id}
                    className="image-overlay-action absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingId === image.id ? "下载中" : "下载"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); void handleSetExampleImage(image); }}
                    disabled={savedExampleIds.has(image.id)}
                    className="image-overlay-action absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savedExampleIds.has(image.id) ? "已设为示例图" : "设为示例图"}
                  </button>
                </div>
                <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/45">生成后自动保存至 prompt-butler／创作历史</div>
                {image.revisedPrompt ? (
                  <div className="border-t border-white/10 px-3 py-3 text-xs leading-5 text-white/45">
                    {image.revisedPrompt}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {!isGenerating && !generationResult ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm leading-6 text-white/45">
            生成完成后在此展示图片网格
          </div>
        ) : null}

        {pendingExampleImage ? (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-white/75">
            <p>已保存 3 张示例图，请选择要替换的位置：</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: MAX_EXAMPLE_IMAGES }).map((_, index) => (
                <button key={index} type="button" className="ghost-button px-3 py-2 text-xs" onClick={() => void handleSetExampleImage(pendingExampleImage, index)}>
                  替换第 {index + 1} 张
                </button>
              ))}
              <button type="button" className="ghost-button px-3 py-2 text-xs" onClick={() => setPendingExampleImage(null)}>取消</button>
            </div>
          </div>
        ) : null}
      </section>

      <PromptHistoryPanel
        entries={imageHistory}
        open={showHistory}
        onToggle={() => setShowHistory((current) => !current)}
        onClear={() => { void clearHistory(); }}
        onRestore={(entry) => { void restoreHistoryEntry(entry); }}
        onDownload={(entry) => { void handleDownload([entry.url], entry.id); }}
        onViewPrompt={(entry) => { void openPromptAsset(entry.promptId); }}
      />

      <PromptPreviewModal
        record={previewPromptRecord}
        isCopied={false}
        isFavorite={Boolean(previewPromptRecord?.isFavorite)}
        sourceLabel={previewPromptRecord?.id === "temporary-image-workspace-prompt" ? "临时 Prompt" : undefined}
        showLibraryActions={false}
        allowEditing={false}
        onClose={() => setPreviewPromptRecord(null)}
        onCopy={() => { if (previewPromptRecord) void navigator.clipboard.writeText(previewPromptRecord.content).then(() => showToast("提示词已复制")); }}
        onSave={() => undefined}
        onToggleFavorite={() => { void saveCurrentPrompt(); }}
      />

      <ImagePreviewModal
        image={previewImage ? { id: previewImage.id, url: previewImage.url, alt: "生成结果大图预览" } : null}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
