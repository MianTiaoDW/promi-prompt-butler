import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  Copy,
  Download,
  Upload,
  LoaderCircle,
  PencilLine,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

import { useChromeStorage } from "../hooks/useChromeStorage";
import { saveImageWorkspace } from "../lib/image-library";
import {
  createPromptFolder,
  deletePromptFolder,
  moveFavoriteUp,
  moveFavoriteDown,
  pinFavoriteToTop,
  PROMPT_STORAGE_KEYS,
  recommendPromptTags,
  renamePromptFolder,
  reorderPromptFolders,
  searchPromptRecords,
  updateFavoritePrompt,
} from "../lib/prompt-library";
import { sendRuntimeMessage } from "../lib/runtime";
import { exportPromptsAsZip, importPromptsFromFile } from "../lib/backup";
import { showToast } from "../lib/toast";
import { deletePromptExampleImages } from "../lib/example-images";
import type {
  PromptOptimizationResult,
  SavedPromptRecord
} from "../types/prompt";
import type { PromptFolder } from "../types/prompt";
import type { ExtensionSettings } from "../types/settings";
import { formatPromptGroup, getPromptGroup, isCollectedPrompt } from "../lib/prompt-group";
import { PromptCard } from "./PromptCard";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { PromptOptimizePanel } from "./PromptOptimizePanel";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function FavoritesStudio(props: {
  settings: ExtensionSettings;
  isServiceReady: boolean;
  activeCategory?: string;
  searchQuery?: string;
  onOpenImageStudio: () => void;
  assetFilter?: "all" | "favorite" | "folders";
  openPromptRequest?: { id: string; token: number } | null;
  onPreviewChange?: (promptId: string | null) => void;
}) {
  const { settings, isServiceReady, activeCategory = "收藏", searchQuery = "", onOpenImageStudio, assetFilter = "all", openPromptRequest, onPreviewChange } = props;
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const favoritesStorage = useChromeStorage<SavedPromptRecord[]>(
    PROMPT_STORAGE_KEYS.favorites,
    []
  );
  const foldersStorage = useChromeStorage<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [autoSavedId, setAutoSavedId] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [editingGroupRecord, setEditingGroupRecord] = useState<SavedPromptRecord | null>(null);
  const [promptNotesDraft, setPromptNotesDraft] = useState("");
  const [promptStepsDraft, setPromptStepsDraft] = useState([{ name: "", content: "" }]);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const resetPromptDraft = () => {
    setEditingGroupRecord(null);
    setPromptNotesDraft("");
    setPromptStepsDraft([{ name: "", content: "" }]);
  };
  const [promptTitleDraft, setPromptTitleDraft] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [previewRecord, setPreviewRecord] = useState<SavedPromptRecord | null>(null);
  const [optimizationRecord, setOptimizationRecord] = useState<SavedPromptRecord | null>(null);

  const { value: favorites, setValue: setFavorites, isLoading } = favoritesStorage;
  const { value: folders, setValue: setFolders } = foldersStorage;
  const scopedFolders = useMemo(
    () =>
      folders
        .filter((folder) => assetFilter === "folders" || activeCategory === "收藏" ? true : (folder.scope || "收藏") === activeCategory)
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [activeCategory, assetFilter, folders]
  );
  const activeFolder = scopedFolders.find((folder) => folder.id === selectedFolderId) ?? null;
  const scopedCategoryName = activeFolder ? `${activeFolder.scope || "收藏"}/${activeFolder.name}` : activeCategory;
  const categoryPromptCount = useMemo(
    () =>
      favorites.filter(
        (record) =>
          record.category === activeCategory || record.category.startsWith(`${activeCategory}/`)
      ).length,
    [activeCategory, favorites]
  );

  const filteredFavorites = searchPromptRecords(
    favorites.filter((record) => record.category === scopedCategoryName),
    searchQuery
  );

  const sortedFavorites = [...filteredFavorites].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const categoryAssetRecords = useMemo(() => {
    const categoryRecords = activeCategory === "收藏"
      ? favorites
      : favorites.filter((record) => record.category === activeCategory || record.category.startsWith(`${activeCategory}/`));
    const filteredRecords = assetFilter === "favorite"
      ? categoryRecords.filter((record) => record.isFavorite ?? true)
      : categoryRecords;
    return searchPromptRecords(filteredRecords, searchQuery).sort(
      (left, right) =>
        new Date(right.updatedAt ?? right.createdAt).getTime() -
        new Date(left.updatedAt ?? left.createdAt).getTime()
    );
  }, [activeCategory, assetFilter, favorites, searchQuery]);

  useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedId(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copiedId]);

  useEffect(() => {
  }, [scopedCategoryName]);

  const handleCopy = async (record: SavedPromptRecord) => {
    try {
      await navigator.clipboard.writeText(record.content);
      setCopiedId(record.id);
      showToast("提示词已复制");
      void markRecordUsed(record);
    } catch {
      setPanelMessage("当前页面不允许直接写入剪贴板，请手动复制。");
    }
  };

  const markRecordUsed = async (record: SavedPromptRecord) => {
    const lastUsedAt = new Date().toISOString();
    const updated = await updateFavoritePrompt(record.id, {
      lastUsedAt,
      lastUsed: lastUsedAt,
      usedCount: (record.usedCount ?? record.usageCount ?? 0) + 1,
      usageCount: (record.usageCount ?? record.usedCount ?? 0) + 1
    });
    if (updated) {
      await setFavorites((current) =>
        current.map((item) => (item.id === record.id ? updated : item))
      );
    }
  };

  useEffect(() => {
    if (!openPromptRequest) return;
    if (favoritesStorage.isLoading) return;
    const record = favorites.find((item) => item.id === openPromptRequest.id);
    if (!record) return;
    setPreviewRecord(record);
    void markRecordUsed(record);
  }, [favoritesStorage.isLoading, openPromptRequest?.token]);

  useEffect(() => {
    onPreviewChange?.(previewRecord?.id ?? null);
  }, [onPreviewChange, previewRecord?.id]);

  const toggleRecordFavorite = async (record: SavedPromptRecord) => {
    const currentFavoriteState = record.isFavorite ?? true;
    const updated = await updateFavoritePrompt(record.id, { isFavorite: !currentFavoriteState });
    if (updated) {
      await setFavorites((current) =>
        current.map((item) => (item.id === record.id ? updated : item))
      );
      setPreviewRecord((current) => current?.id === record.id ? updated : current);
      showToast(currentFavoriteState ? "已取消收藏" : "已加入收藏");
    }
  };

  const usePromptInImageStudio = async (record: SavedPromptRecord) => {
    await saveImageWorkspace({
      prompt: record.content,
      lastUpdatedAt: null,
      source: {
        promptId: record.id,
        title: record.title || record.content.slice(0, 28),
        type: record.source ?? (record.id.startsWith("seed-") ? "system-template" : "user-created"),
        format: record.format,
        provider: record.provider,
        model: record.model
      }
    });
    await markRecordUsed(record);
    setPreviewRecord(null);
    onOpenImageStudio();
  };

  const savePreviewContent = async (record: SavedPromptRecord, content: string) => {
    const currentVersion = record.version ?? "1.0";
    const [major, minor] = currentVersion.split(".").map((value) => Number(value) || 0);
    const updated = await updateFavoritePrompt(record.id, {
      content,
      tags: recommendPromptTags(content),
      contentVariants: { ...record.contentVariants, [record.format]: content },
      version: `${major}.${minor + 1}`,
      versions: [...(record.versions ?? []), { id: `${record.id}-${Date.now()}`, version: currentVersion, content: record.content, createdAt: new Date().toISOString(), note: "手动编辑" }]
    });
    if (!updated) return;
    await setFavorites((current) =>
      current.map((item) => (item.id === record.id ? updated : item))
    );
    setPreviewRecord(updated);
    showToast("提示词已更新");
  };

  const flushPendingSave = async (recordId: string, content: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!content.trim()) return;
    const tags = recommendPromptTags(content);
    const updated = await updateFavoritePrompt(recordId, { content, tags });
    if (updated) {
      await setFavorites((current) =>
        current.map((item) => (item.id === recordId ? updated : item))
      );
    }
  };

  const debouncedSave = (recordId: string, content: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      const tags = recommendPromptTags(content);
      const updated = await updateFavoritePrompt(recordId, { content, tags });
      if (updated) {
        await setFavorites((current) =>
          current.map((item) => (item.id === recordId ? updated : item))
        );
        setAutoSavedId(recordId);
        setTimeout(() => setAutoSavedId(null), 2000);
      }
      autoSaveTimerRef.current = null;
    }, 1500);
  };

  const handleSortAction = async (recordId: string, action: "pin" | "up" | "down") => {
    let updated: SavedPromptRecord[];
    if (action === "pin") updated = await pinFavoriteToTop(recordId, scopedCategoryName);
    else if (action === "up") updated = await moveFavoriteUp(recordId, scopedCategoryName);
    else updated = await moveFavoriteDown(recordId, scopedCategoryName);
    await setFavorites(updated);
  };

  const handleCreateFolder = async () => {
    try {
      const folder = await createPromptFolder(folderNameDraft, activeCategory);
      setSelectedFolderId(null);
      setIsCreatingFolder(false);
      setFolderNameDraft("");
      setPanelMessage(`已在"${activeCategory}"下新建文件夹：${folder.name}`);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "新建文件夹失败。");
    }
  };

  const handleRenameFolder = async (folder: PromptFolder) => {
    try {
      const renamedFolder = await renamePromptFolder(folder.id, folderNameDraft);

      if (!renamedFolder) {
        setPanelMessage("重命名失败，未找到文件夹。");
        return;
      }

      await setFolders((current) =>
        current.map((item) => (item.id === folder.id ? renamedFolder : item))
      );
      setRenamingFolderId(null);
      setFolderNameDraft("");
      setPanelMessage(`文件夹已重命名为：${renamedFolder.name}`);
    } catch (error) {
      setPanelMessage(error instanceof Error ? error.message : "重命名失败。");
    }
  };

  const handleDeleteFolder = async (folder: PromptFolder) => {
    const deleted = await deletePromptFolder(folder.id);

    if (!deleted) {
      setPanelMessage("删除失败，未找到文件夹。");
      return;
    }

    await setFolders((current) => current.filter((item) => item.id !== folder.id));
    setSelectedFolderId((current) => (current === folder.id ? null : current));
    setRenamingFolderId(null);
    setFolderNameDraft("");
    setPanelMessage(`已删除文件夹：${folder.name}`);
  };

  const moveFolder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    const orderedIds = scopedFolders.map((folder) => folder.id);
    const sourceIndex = orderedIds.indexOf(sourceId);
    const targetIndex = orderedIds.indexOf(targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const nextOrderedIds = [...orderedIds];
    const [movedId] = nextOrderedIds.splice(sourceIndex, 1);
    nextOrderedIds.splice(targetIndex, 0, movedId);
    await reorderPromptFolders(activeCategory, nextOrderedIds);
    await setFolders((current) => {
      const orderMap = new Map(nextOrderedIds.map((id, index) => [id, index]));
      return current.map((folder) => {
        if (folder.scope !== activeCategory || !orderMap.has(folder.id)) {
          return folder;
        }

        return {
          ...folder,
          order: orderMap.get(folder.id) ?? folder.order
        };
      });
    });
  };

  const handleCreatePrompt = async () => {
    const steps = promptStepsDraft.map((step) => ({ name: step.name.trim(), content: step.content.trim() }));
    const notes = promptNotesDraft.trim();
    const group = { notes, steps };
    const trimmedPrompt = formatPromptGroup(group);

    if (isSavingPrompt || !promptTitleDraft.trim() || steps.some((step) => !step.content)) {
      return;
    }

    const record: SavedPromptRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: promptTitleDraft.trim(),
      createdAt: new Date().toISOString(),
      provider: settings.provider,
      model: settings.reasoningModel || settings.visionModel || "未设置模型",
      format: "cnPrompt",
      content: trimmedPrompt,
      group,
      category: activeFolder ? `${activeFolder.scope || activeCategory}/${activeFolder.name}` : activeCategory,
      source: "user-created",
      tags: []
    };

    setIsSavingPrompt(true);
    try {
      if (editingGroupRecord) {
        const updated = await updateFavoritePrompt(editingGroupRecord.id, { title: record.title, content: record.content, group, tags: [] });
        if (!updated) throw new Error("提示词已删除");
        await setFavorites((current) => current.map((item) => item.id === updated.id ? updated : item));
        setPreviewRecord(updated);
      } else {
        await setFavorites((current) => [record, ...current]);
      }
    } catch {
      showToast("保存失败，请重试");
      return;
    } finally {
      setIsSavingPrompt(false);
    }
    resetPromptDraft();
    setPromptTitleDraft("");
    setIsCreatingPrompt(false);
    setPanelMessage(`已添加提示词到“${activeFolder?.name || activeCategory}”。`);
  };

  const editPromptGroup = (record: SavedPromptRecord) => {
    const group = getPromptGroup(record);
    setEditingGroupRecord(record);
    setPromptTitleDraft(record.title);
    setPromptNotesDraft(group.notes);
    setPromptStepsDraft(group.steps.map((step) => ({ ...step })));
    setPreviewRecord(null);
    setIsCreatingPrompt(true);
  };

  const savePromptGroup = async (record: SavedPromptRecord, group: import("../types/prompt").PromptGroup) => {
    const updated = await updateFavoritePrompt(record.id, { group, content: formatPromptGroup(group), tags: [] });
    if (updated) {
      await setFavorites((current) => current.map((item) => item.id === updated.id ? updated : item));
      setPreviewRecord(updated);
    }
  };

  const handleDeletePrompt = async (record: SavedPromptRecord) => {
    await deletePromptExampleImages(record.id);
    await setFavorites((current) => current.filter((item) => item.id !== record.id));
    setPanelMessage("提示词已删除。");
    showToast("提示词已删除");
  };

  const handleExport = async () => {
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      await exportPromptsAsZip();
      showToast("提示词和示例图已导出为 ZIP");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败，请重试。");
    } finally { setIsBackupBusy(false); }
  };

  const handleImport = () => {
    if (isBackupBusy) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setIsBackupBusy(true);
      try {
        const result = await importPromptsFromFile(file);
        window.dispatchEvent(new Event("prompt-library-updated"));
        showToast(result.favorites || result.folders ? `已导入 ${result.favorites} 个提示词组、${result.images} 张示例图` : "导入完成，没有新增内容。");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "导入失败。");
      } finally { setIsBackupBusy(false); }
    };
    input.click();
  };

  const saveTitleEdit = async (record: SavedPromptRecord) => {
    const updated = await updateFavoritePrompt(record.id, { title: titleDraft.trim() });
    if (updated) {
      await setFavorites((current) =>
        current.map((item) => (item.id === record.id ? updated : item))
      );
    }
    setEditingTitleId(null);
    setTitleDraft("");
  };

  const cancelTitleEdit = () => {
    setEditingTitleId(null);
    setTitleDraft("");
  };

  const optimizePrompt = async (record: SavedPromptRecord, direction?: string) => {
    if (!isServiceReady) {
      setPanelMessage("服务未就绪，请先完成配置并测试连接。");
      return;
    }

    setBusyId(record.id);
    setPanelMessage("正在调用模型优化该条提示词...");

    try {
      const result = await sendRuntimeMessage<PromptOptimizationResult>({
        type: "prompt:optimize",
        payload: {
          settings,
          content: record.content,
          direction
        }
      });

      if (!result.ok) {
        setPanelMessage(`优化失败：${result.message}`);
        return;
      }

      const tags = recommendPromptTags(result.output);
      const currentVersion = record.version ?? "1.0";
      const [major, minor] = currentVersion.split(".").map((value) => Number(value) || 0);
      const updatedRecord = await updateFavoritePrompt(record.id, {
        content: result.output,
        tags,
        contentVariants: { ...record.contentVariants, [record.format]: result.output },
        version: `${major}.${minor + 1}`,
        versions: [
          ...(record.versions ?? []),
          {
            id: `${record.id}-${Date.now()}`,
            version: currentVersion,
            content: record.content,
            createdAt: new Date().toISOString(),
            note: direction || "AI 优化"
          }
        ]
      });

      if (!updatedRecord) {
        setPanelMessage("优化完成，但本地提示词更新失败。");
        return;
      }

      await setFavorites((current) =>
        current.map((item) => (item.id === record.id ? updatedRecord : item))
      );
      setExpandedId(record.id);
      setDraftContent(updatedRecord.content);
      setPreviewRecord((current) => current?.id === record.id ? updatedRecord : current);
      setOptimizationRecord(null);
      setPanelMessage(`AI 优化完成，当前使用模型：${result.model}`);
      showToast(`已生成 ${updatedRecord.version} 版本`);
    } catch (error) {
      setPanelMessage(
        error instanceof Error ? `优化失败：${error.message}` : "优化失败。"
      );
    } finally {
      setBusyId(null);
    }
  };

  const promptCreateDialog = isCreatingPrompt ? (
            <div
              className="absolute inset-x-0 bottom-0 top-14 z-[2147483647] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm"
              onClick={() => {
                setIsCreatingPrompt(false);
                resetPromptDraft();
                setPromptTitleDraft("");
              }}
            >
              <div
                className="aurora-shell min-h-0 max-h-full w-full max-w-[460px] overflow-y-auto overscroll-contain rounded-[1.35rem] p-5"
                role="dialog" aria-modal="true" aria-label="新建提示词组"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="section-label mb-3">
                  {editingGroupRecord ? "编辑提示词组" : "新建提示词组"} · {activeFolder?.name || (activeCategory === "收藏" ? "全部提示词" : activeCategory)}
                </div>
                <label className="mb-2 block text-sm text-white/70" htmlFor="prompt-group-title">提示词组标题</label>
                <input
                  id="prompt-group-title"
                  autoFocus
                  value={promptTitleDraft}
                  onChange={(e) => {
                    setPromptTitleDraft(e.target.value);
                  }}
                  placeholder="为这组提示词起个名字"
                  className="form-field mb-3 w-full rounded-xl px-4 py-2.5 text-sm"
                />
                <label className="mb-2 block text-sm text-white/70" htmlFor="prompt-group-notes">备注（可选）</label>
                <textarea id="prompt-group-notes" value={promptNotesDraft} onChange={(event) => setPromptNotesDraft(event.target.value)} className="form-field mb-4 min-h-[72px] w-full resize-y rounded-xl px-4 py-3 text-sm" placeholder="记录用途、使用顺序或注意事项" />
                <div className="space-y-3">
                  {promptStepsDraft.map((step, index) => (
                    <section key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white/90">{index + 1}</h3>
                        {promptStepsDraft.length > 1 ? <button type="button" className="icon-button" aria-label={`删除第 ${index + 1} 步`} onClick={() => setPromptStepsDraft((current) => current.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></button> : null}
                      </div>
                      <input value={step.name} aria-label={`第 ${index + 1} 步名称`} onChange={(event) => setPromptStepsDraft((current) => current.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} placeholder="步骤名称（可选）" className="form-field mb-3 w-full rounded-xl px-3 py-2.5 text-sm" />
                      <textarea value={step.content} aria-label={`第 ${index + 1} 步正文`} onChange={(event) => setPromptStepsDraft((current) => current.map((item, position) => position === index ? { ...item, content: event.target.value } : item))} className="form-field min-h-[140px] w-full resize-y rounded-xl px-3 py-3 text-sm leading-6" placeholder="输入这一步的提示词正文" />
                    </section>
                  ))}
                </div>
                <button type="button" className="ghost-button mt-3 w-full py-3 text-sm" onClick={() => setPromptStepsDraft((current) => [...current, { name: "", content: "" }])}><Plus className="h-4 w-4" />新增提示词步骤</button>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingPrompt(false);
                      resetPromptDraft();
                      setPromptTitleDraft("");
                    }}
                    className="ghost-button px-5 py-2.5 text-sm"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCreatePrompt();
                    }}
                    disabled={isSavingPrompt || !promptTitleDraft.trim() || promptStepsDraft.some((step) => !step.content.trim())}
                    className="gradient-button px-5 py-2.5 text-sm disabled:opacity-40"
                  >
                    {isSavingPrompt ? "保存中…" : "保存提示词组"}
                  </button>
                </div>
              </div>
            </div>
          ) : null;

  const dialogContainer = libraryRef.current?.closest(".fluxora-shell");
  const promptEditor = promptCreateDialog && dialogContainer ? createPortal(promptCreateDialog, dialogContainer) : promptCreateDialog;

  const renderAssetSection = (title: string, records: SavedPromptRecord[], emptyMessage: string) => (
    <section className="prompt-asset-section">
      <div className="prompt-asset-section-heading flex-wrap">
        <div className="flex items-center gap-2"><h2>{title}</h2><span className="text-xs text-white/50">{records.length}</span></div>
        {assetFilter === "all" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!activeFolder ? <><button type="button" className="icon-button" disabled={isBackupBusy} onClick={handleImport} title="导入 ZIP 或 JSON" aria-label="导入提示词"><Upload className="h-4 w-4" /></button><button type="button" className="icon-button" disabled={isBackupBusy} onClick={() => void handleExport()} title="导出全部提示词和示例图为 ZIP" aria-label="导出提示词 ZIP">{isBackupBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button></> : null}
            <button type="button" className="ghost-button px-3 py-2 text-sm" disabled={isBackupBusy} onClick={() => { setIsCreatingPrompt(true); resetPromptDraft(); setPromptTitleDraft(""); }}><Plus className="h-4 w-4" />添加提示词</button>
          </div>
        ) : null}
      </div>
      {records.length > 0 ? (
        <div className="prompt-asset-grid">
          {records.map((record) => (
            <PromptCard
              key={record.id}
              record={record}
              isCopied={copiedId === record.id}
              isFavorite={record.isFavorite ?? true}
              isOptimizing={busyId === record.id}
              onCopy={() => void handleCopy(record)}
              onOpen={() => {
                setPreviewRecord(record);
                void markRecordUsed(record);
              }}
              onToggleFavorite={() => void toggleRecordFavorite(record)}
              onOptimize={() => setOptimizationRecord(record)}
              onDelete={() => void handleDeletePrompt(record)}
            />
          ))}
        </div>
      ) : (
        <div className="prompt-asset-empty">{emptyMessage}</div>
      )}
    </section>
  );

  const promptPreviewDialog = <PromptPreviewModal
        onEditGroup={() => { if (previewRecord) editPromptGroup(previewRecord); }}
        onSaveGroup={(group) => { if (previewRecord) void savePromptGroup(previewRecord, group); }}
        record={previewRecord}
        isCopied={Boolean(previewRecord && copiedId === previewRecord.id)}
        isFavorite={Boolean(previewRecord && (previewRecord.isFavorite ?? true))}
        onClose={() => setPreviewRecord(null)}
        onCopy={() => { if (previewRecord) void handleCopy(previewRecord); }}
        onSave={(content) => { if (previewRecord) void savePreviewContent(previewRecord, content); }}
        onToggleFavorite={() => { if (previewRecord) void toggleRecordFavorite(previewRecord); }}
        onUsePrompt={() => { if (previewRecord) void usePromptInImageStudio(previewRecord); }}
        onOptimize={() => { if (previewRecord) setOptimizationRecord(previewRecord); }}
      />;

  if (activeFolder) {
    return <div ref={libraryRef} className="prompt-asset-library">
      <div className="flex items-center gap-3"><button type="button" className="ghost-button px-3 py-2 text-xs" onClick={() => { setSelectedFolderId(null); setIsCreatingPrompt(false); resetPromptDraft(); }}><ArrowLeft className="h-4 w-4" />返回收藏夹</button></div>
      {renderAssetSection(activeFolder.name, sortedFavorites, "这个收藏夹还没有提示词")}
      {assetFilter !== "all" ? <button type="button" className="ghost-button px-3 py-2 text-sm" onClick={() => { resetPromptDraft(); setPromptTitleDraft(""); setIsCreatingPrompt(true); }}><Plus className="h-4 w-4" />添加提示词</button> : null}
      {promptEditor}
      {promptPreviewDialog}
      <PromptOptimizePanel record={optimizationRecord} busy={Boolean(optimizationRecord && busyId === optimizationRecord.id)} onClose={() => { if (!busyId) setOptimizationRecord(null); }} onOptimize={(direction) => { if (optimizationRecord) void optimizePrompt(optimizationRecord, direction); }} />
    </div>;
  }

  return (
    <div ref={libraryRef} className="prompt-asset-library">
      {assetFilter === "folders" ? (
        <section className="prompt-folder-browser">
          <header>
            <div><h2>我的收藏夹</h2><span>{scopedFolders.length}</span></div>
            <div>
              <button type="button" onClick={() => { setIsCreatingFolder(true); setFolderNameDraft(""); }} title="新建收藏夹"><Plus className="h-4 w-4" /></button>
            </div>
          </header>
          {isCreatingFolder ? (
            <div className="prompt-folder-create-row">
              <input className="form-field" value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} placeholder="收藏夹名称" autoFocus onKeyDown={(event) => { if (event.key === "Enter") void handleCreateFolder(); }} />
              <button type="button" onClick={() => void handleCreateFolder()} disabled={!folderNameDraft.trim()}><Check className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setIsCreatingFolder(false); setFolderNameDraft(""); }}><X className="h-4 w-4" /></button>
            </div>
          ) : null}
          <div className="prompt-folder-grid">
            {scopedFolders.map((folder) => {
              const folderCategory = `${folder.scope || "收藏"}/${folder.name}`;
              const folderCount = favorites.filter((record) => record.category === folderCategory).length;
              const isRenaming = renamingFolderId === folder.id;
              return (
                <article key={folder.id}>
                  {isRenaming ? (
                    <div className="prompt-folder-create-row"><input className="form-field" value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} autoFocus /><button type="button" onClick={() => void handleRenameFolder(folder)}><Check className="h-4 w-4" /></button><button type="button" onClick={() => { setRenamingFolderId(null); setFolderNameDraft(""); }}><X className="h-4 w-4" /></button></div>
                  ) : (
                    <><button type="button" className="prompt-folder-open" onClick={() => setSelectedFolderId(folder.id)}><strong>{folder.name}</strong><span>{folder.scope || "收藏"} · {folderCount} 条</span></button><div><button type="button" onClick={() => { setRenamingFolderId(folder.id); setFolderNameDraft(folder.name); }} title="重命名"><PencilLine className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handleDeleteFolder(folder)} title="删除"><Trash2 className="h-3.5 w-3.5" /></button></div></>
                  )}
                </article>
              );
            })}
          </div>
          {scopedFolders.length === 0 ? <div className="prompt-asset-empty">还没有收藏夹，可以从右上角新建。</div> : null}
        </section>
      ) : searchQuery.trim() ? (
        renderAssetSection("搜索结果", categoryAssetRecords, "没有找到匹配的提示词，换一个关键词试试。")
      ) : (
        renderAssetSection(assetFilter === "favorite" ? "收藏" : activeCategory === "收藏" ? "全部提示词" : activeCategory, categoryAssetRecords, assetFilter === "favorite" ? "还没有收藏 Prompt" : "当前筛选下还没有提示词")
      )}

      {promptEditor}
      {panelMessage ? <p className="library-status-message">{panelMessage}</p> : null}

      <details className="prompt-library-management">
        <summary>
          <span>收藏夹</span>
          <small>{scopedFolders.length}</small>
        </summary>
      <section className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-white/88">{activeCategory}文件夹</div>
          <div className="rounded-2xl border border-accent/35 bg-transparent px-2.5 py-1 text-xs font-semibold text-accent">
            {categoryPromptCount} 条
          </div>

        </div>


        <div className="mt-4 flex flex-wrap gap-3">
          {scopedFolders.map((folder) => {
            const isRenaming = renamingFolderId === folder.id;
            const isDragging = draggingFolderId === folder.id;

            if (isRenaming) {
              return (
                <div
                  key={folder.id}
                  className="flex h-24 w-24 flex-col justify-between rounded-[1.35rem] border border-accent/35 bg-black/25 p-3"
                >
                  <input
                    value={folderNameDraft}
                    onChange={(event) => {
                      setFolderNameDraft(event.target.value);
                    }}
                    className="w-full bg-transparent text-center text-sm text-white outline-none"
                    placeholder="文件夹名"
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        void handleRenameFolder(folder);
                      }}
                      className="text-accent"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingFolderId(null);
                        setFolderNameDraft("");
                      }}
                      className="text-white/55"
                    >
                      取消
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={folder.id} className="relative">
                <button
                  type="button"
                  draggable
                  onDragStart={() => {
                    setDraggingFolderId(folder.id);
                  }}
                  onDragEnd={() => {
                    setDraggingFolderId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggingFolderId) {
                      return;
                    }
                    void moveFolder(draggingFolderId, folder.id);
                    setDraggingFolderId(null);
                  }}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                  }}
                  onDoubleClick={() => {
                    setRenamingFolderId(folder.id);
                    setFolderNameDraft(folder.name);
                  }}
                  className={[
                    "glass-card flex h-24 w-24 flex-col items-center justify-center rounded-[1.35rem] border text-center transition",
                    "border-white/10 bg-white/[0.06] text-white/70 hover:border-accent/30 hover:text-white",
                    isDragging ? "opacity-60" : ""
                  ].join(" ")}
                >
                  <div className="max-w-full truncate px-2 text-sm font-medium">{folder.name}</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteFolder(folder);
                  }}
                  className="absolute -right-2 -top-2 rounded-full border border-white/10 bg-slate-950/90 p-1.5 text-white/55 transition hover:text-rose-300"
                  aria-label={`删除${folder.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {isCreatingFolder ? (
            <div className="glass-card flex h-24 w-24 flex-col justify-between rounded-[1.35rem] border border-dashed border-accent/35 p-3">
              <input
                value={folderNameDraft}
                onChange={(event) => {
                  setFolderNameDraft(event.target.value);
                }}
                className="w-full bg-transparent text-center text-sm text-white outline-none"
                placeholder="文件夹名"
              />
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    void handleCreateFolder();
                  }}
                  className="text-accent"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setFolderNameDraft("");
                  }}
                  className="text-white/55"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(true);
                setFolderNameDraft("");
              }}
              className="glass-card flex h-24 w-24 items-center justify-center rounded-[1.35rem] border border-dashed border-white/10 text-white/60 transition hover:border-accent/35 hover:text-accent"
              aria-label="新建文件夹"
            >
              <Plus className="h-8 w-8" />
            </button>
          )}
        </div>
      </section>

      {panelMessage ? (
        <p className="library-status-message">{panelMessage}</p>
      ) : null}

      {!isLoading && sortedFavorites.length > 0 ? (
        <section className="space-y-1.5">
          <div className="px-1 mb-2 text-xs text-accent/70">
            {scopedFolders.length > 0 ? `未分类提示词 · ${sortedFavorites.length} 条` : `${activeCategory} · ${sortedFavorites.length} 条`}
          </div>
          {sortedFavorites.map((record, index) => {
            const isExpanded = expandedId === record.id;
            const isBusy = busyId === record.id;
            const isEditingTitle = editingTitleId === record.id;
            const displayTitle = record.title || record.content.slice(0, 28);
            const isFirst = index === 0;
            const isLast = index === sortedFavorites.length - 1;

            return (
              <article key={record.id} className="media-card transition">
                <div className="flex items-center gap-2 px-3 py-2">
                  {isEditingTitle ? (
                    <>
                      <input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); void saveTitleEdit(record); }
                          if (e.key === "Escape") cancelTitleEdit();
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-accent/35 bg-black/25 px-2 py-1 text-xs text-white outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={() => { void saveTitleEdit(record); }} className="shrink-0 rounded-md p-0.5 text-white/55 transition hover:text-accent"><Check className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={cancelTitleEdit} className="shrink-0 rounded-md p-0.5 text-white/55 transition hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-xs text-white/70">{displayTitle}</span>
                      <button type="button" onClick={() => { void handleSortAction(record.id, "pin"); }} disabled={isFirst} className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-20"><Pin className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { void handleSortAction(record.id, "up"); }} disabled={isFirst} className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { void handleSortAction(record.id, "down"); }} disabled={isLast} className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { setEditingTitleId(record.id); setTitleDraft(record.title || ""); }} className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-accent"><PencilLine className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { void handleDeletePrompt(record); }} className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                  <button type="button" onClick={async () => {
                    if (isCollectedPrompt(record)) { editPromptGroup(record); return; }
                    if (isExpanded) { await flushPendingSave(record.id, draftContent); setExpandedId(null); setDraftContent(""); }
                    else { setExpandedId(record.id); setDraftContent(record.content); }
                  }} className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/58 transition hover:border-accent/30 hover:text-white">
                    {isCollectedPrompt(record) ? "编辑" : isExpanded ? "收起" : "展开"}
                  </button>
                </div>
                {isExpanded ? (
                  <div className="border-t border-white/5 px-3 py-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                      <span>{record.provider}</span><span>·</span><span>{record.model}</span><span>·</span><span>{formatTimestamp(record.updatedAt ?? record.createdAt)}</span>
                    </div>
                    <textarea value={draftContent} onChange={(e) => { setDraftContent(e.target.value); debouncedSave(record.id, e.target.value); }} className="form-field min-h-[150px] w-full resize-y leading-6" />
                    {autoSavedId === record.id ? <div className="inline-flex items-center gap-1 text-[11px] text-accent/75"><Check className="h-3 w-3" />已自动保存</div> : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { void handleCopy(record); }} className="ghost-button rounded-xl px-3 py-2 text-xs">
                        {copiedId === record.id ? <><Check className="h-3.5 w-3.5" />已复制</> : <><Copy className="h-3.5 w-3.5" />一键复制</>}
                      </button>
                      <button type="button" onClick={() => { void optimizePrompt(record); }} disabled={isBusy} className="gradient-button rounded-xl px-3 py-2 text-xs">
                        {isBusy ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />优化中...</> : <><Sparkles className="h-3.5 w-3.5" />AI一键优化</>}
                      </button>
                      <button type="button" onClick={() => { void handleDeletePrompt(record); }} className="ghost-button rounded-xl px-3 py-2 text-xs text-rose-300 hover:text-rose-200">
                        <Trash2 className="h-3.5 w-3.5" />删除
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
      </details>

      {promptPreviewDialog}
      <PromptOptimizePanel
        record={optimizationRecord}
        busy={Boolean(optimizationRecord && busyId === optimizationRecord.id)}
        onClose={() => { if (!busyId) setOptimizationRecord(null); }}
        onOptimize={(direction) => { if (optimizationRecord) void optimizePrompt(optimizationRecord, direction); }}
      />
    </div>
  );
}
