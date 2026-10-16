import { CollectionFolder } from "./CollectionFolder";
import { FolderColorMenu, FolderColorPicker } from "./FolderColorPicker";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Upload,
  LoaderCircle,
  Plus,
  Trash2,
  X
} from "../components/PromiIcons";

import { useChromeStorage } from "../hooks/useChromeStorage";
import { saveImageWorkspace } from "../lib/image-library";
import {
  createPromptFolder,
  deletePromptFolder,
  PROMPT_STORAGE_KEYS,
  recommendPromptTags,
  renamePromptFolder,
  reorderPromptFolders,
  searchPromptRecords,
  updateFavoritePrompt,
} from "../lib/prompt-library";
import { sendRuntimeMessage } from "../lib/runtime";
import { exportPromptsAsZip, importPromptsFromFile, readPromptBackup } from "../lib/backup";
import { PromptImportDialog } from "./PromptImportDialog";
import { showToast } from "../lib/toast";
import { deletePromptExampleImages } from "../lib/example-images";
import type {
  PromptOptimizationResult,
  SavedPromptRecord
} from "../types/prompt";
import type { PromptFolder } from "../types/prompt";
import type { ExtensionSettings } from "../types/settings";
import { formatPromptGroup, getPromptGroup } from "../lib/prompt-group";
import { belongsToFolder, collectPromptToFolder, moveOrderedId, movePromptToTop, reorderPromptRecords, sortPromptRecords } from "../lib/prompt-organization";
import { PromptFolderPicker } from "./PromptFolderPicker";
import { PromptCard } from "./PromptCard";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { PromptOptimizePanel } from "./PromptOptimizePanel";

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
  const reduceMotion = useReducedMotion();
  const { settings, isServiceReady, activeCategory = "收藏", searchQuery = "", onOpenImageStudio, assetFilter = "all", openPromptRequest, onPreviewChange } = props;
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const favoritesStorage = useChromeStorage<SavedPromptRecord[]>(
    PROMPT_STORAGE_KEYS.favorites,
    []
  );
  const foldersStorage = useChromeStorage<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [folderColorDraft, setFolderColorDraft] = useState("blue");
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
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
  const [previewRecord, setPreviewRecord] = useState<SavedPromptRecord | null>(null);
  const [optimizationRecord, setOptimizationRecord] = useState<SavedPromptRecord | null>(null);

  const { value: favorites, setValue: setFavorites } = favoritesStorage;
  const { value: folders, setValue: setFolders } = foldersStorage;
  const scopedFolders = useMemo(() => [...folders].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)), [folders]);
  const activeFolder = scopedFolders.find((folder) => folder.id === selectedFolderId) ?? null;
  const sortedFavorites = sortPromptRecords(searchPromptRecords(favorites.filter((record) => activeFolder && belongsToFolder(record, activeFolder)), searchQuery));
  const categoryAssetRecords = useMemo(() => sortPromptRecords(searchPromptRecords(
    assetFilter === "favorite" ? favorites.filter((record) => record.isFavorite ?? false) : favorites,
    searchQuery
  )), [assetFilter, favorites, searchQuery]);
  const [folderPickerRecord, setFolderPickerRecord] = useState<SavedPromptRecord | null>(null);
  const [draggingPromptId, setDraggingPromptId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const sortingRef = useRef(false);
  const droppingRef = useRef(false);
  const cancelFolderRename = useRef(false);
  const folderDragEndedAt = useRef(0);
  const dragOrderRef = useRef<string[]>([]);
  const finishDrag = () => {
    if (droppingRef.current) return;
    setDraggingPromptId(null);
    setDraggingFolderId(null);
    setDropTargetId(null);
  };
  const commitDrop = async (save: () => Promise<void>) => {
    droppingRef.current = true;
    try { await save(); }
    finally { droppingRef.current = false; finishDrag(); }
  };
  const previewOrder = <T extends { id: string },>(records: T[], sourceId: string | null) => {
    if (!sourceId || !dropTargetId) return records;
    const byId = new Map(records.map((record) => [record.id, record]));
    const originalIds = dragOrderRef.current.length ? dragOrderRef.current : records.map((record) => record.id);
    const previewIds = moveOrderedId(originalIds, sourceId, dropTargetId);
    return [...previewIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!), ...records.filter((record) => !originalIds.includes(record.id))];
  };

  useEffect(() => { setSelectedFolderId(null); setFolderPickerRecord(null); }, [assetFilter]);

  const movePrompt = async (sourceId: string, targetId: string, records: SavedPromptRecord[]) => {
    if (sourceId === targetId || sortingRef.current) return;
    sortingRef.current = true;
    try {
      const next = await reorderPromptRecords(moveOrderedId(records.map((record) => record.id), sourceId, targetId));
      await setFavorites(next);
      showToast("提示词顺序已保存");
    } catch { showToast("保存顺序失败，请重试", "error"); }
    finally { sortingRef.current = false; }
  };

  const handleMoveToTop = async (promptId: string) => {
    if (sortingRef.current) return;
    sortingRef.current = true;
    try {
      await movePromptToTop(promptId);
      showToast("提示词已移到最前面");
    } catch { showToast("置顶失败，请重试", "error"); }
    finally { sortingRef.current = false; }
  };

  useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedId(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const handleCopy = async (record: SavedPromptRecord) => {
    try {
      await navigator.clipboard.writeText(record.content);
      setCopiedId(record.id);
      showToast("提示词已复制");
      void markRecordUsed(record);
    } catch {
      showToast("当前页面不允许直接写入剪贴板，请手动复制。");
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
    const currentFavoriteState = record.isFavorite ?? false;
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

  const handleCreateFolder = async () => {
    try {
      const folder = await createPromptFolder(folderNameDraft, "收藏", folderColorDraft);
      await setFolders((current) => current.some((item) => item.id === folder.id) ? current : [...current, folder]);
      setSelectedFolderId(null);
      setIsCreatingFolder(false);
      setFolderNameDraft("");
      showToast(`已新建收藏夹：${folder.name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "新建文件夹失败。");
    }
  };

  const handleRenameFolder = async (folder: PromptFolder) => {
    try {
      const renamedFolder = await renamePromptFolder(folder.id, folderNameDraft);

      if (!renamedFolder) {
        showToast("重命名失败，未找到文件夹。");
        return;
      }

      await setFolders((current) =>
        current.map((item) => (item.id === folder.id ? renamedFolder : item))
      );
      setRenamingFolderId(null);
      setFolderNameDraft("");
      showToast(`文件夹已重命名为：${renamedFolder.name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "重命名失败。");
    }
  };

  const handleDeleteFolder = async (folder: PromptFolder) => {
    const deleted = await deletePromptFolder(folder.id);

    if (!deleted) {
      showToast("删除失败，未找到文件夹。");
      return;
    }

    await setFolders((current) => current.filter((item) => item.id !== folder.id));
    setSelectedFolderId((current) => (current === folder.id ? null : current));
    setRenamingFolderId(null);
    setFolderNameDraft("");
    showToast(`已删除收藏夹：${folder.name}`);
  };

  const moveFolder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    if (sortingRef.current) return;
    sortingRef.current = true;
    try {
      const nextIds = moveOrderedId(scopedFolders.map((folder) => folder.id), sourceId, targetId);
      await setFolders(await reorderPromptFolders(null, nextIds));
      showToast("收藏夹顺序已保存");
    } catch { showToast("保存顺序失败，请重试", "error"); }
    finally { sortingRef.current = false; }
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
      category: "收藏",
      folderIds: activeFolder ? [activeFolder.id] : [],
      order: favorites.reduce((max, item) => Math.max(max, item.order ?? -1), -1) + 1,
      source: "user-created",
      isFavorite: false,
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
        await setFavorites((current) => [...current, record]);
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
    showToast(`已添加提示词到“${activeFolder?.name || activeCategory}”。`);
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
    if (!updated) throw new Error("提示词已删除，无法保存修改。");
    if (updated) {
      await setFavorites((current) => current.map((item) => item.id === updated.id ? updated : item));
      setPreviewRecord(updated);
    }
  };

  const handleDeletePrompt = async (record: SavedPromptRecord) => {
    await deletePromptExampleImages(record.id);
    await setFavorites((current) => current.filter((item) => item.id !== record.id));
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
        await readPromptBackup(file);
        setImportFile(file);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "导入失败。");
      } finally { setIsBackupBusy(false); }
    };
    input.click();
  };

  const [importFile, setImportFile] = useState<File | null>(null);
  const confirmImport = async (mode: "append" | "replace") => {
    if (!importFile || isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const result = await importPromptsFromFile(importFile, mode);
      window.dispatchEvent(new Event("prompt-library-updated"));
      setSelectedFolderId(null);
      setPreviewRecord(null);
      setImportFile(null);
      showToast(`${mode === "replace" ? "已覆盖导入" : "已追加"} ${result.favorites} 个提示词组，跳过 ${result.skipped} 条重复内容、导入 ${result.images} 张示例图`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导入失败。", "error");
    } finally { setIsBackupBusy(false); }
  };

  const optimizePrompt = async (record: SavedPromptRecord, direction?: string) => {
    if (!isServiceReady) {
      showToast("服务未就绪，请先完成配置并测试连接。");
      return;
    }

    setBusyId(record.id);
    showToast("正在调用模型优化该条提示词...");

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
        showToast(`优化失败：${result.message}`);
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
        showToast("优化完成，但本地提示词更新失败。");
        return;
      }

      await setFavorites((current) =>
        current.map((item) => (item.id === record.id ? updatedRecord : item))
      );
      setPreviewRecord((current) => current?.id === record.id ? updatedRecord : current);
      setOptimizationRecord(null);
      showToast(`已生成 ${updatedRecord.version} 版本`);
    } catch (error) {
      showToast(
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
                data-enter-confirm role="dialog" aria-modal="true" aria-label="新建提示词组"
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
                    data-enter-submit disabled={isSavingPrompt || !promptTitleDraft.trim() || promptStepsDraft.some((step) => !step.content.trim())}
                    className="gradient-button px-5 py-2.5 text-sm disabled:opacity-40"
                  >
                    {isSavingPrompt ? "保存中…" : "保存提示词组"}
                  </button>
                </div>
              </div>
            </div>
          ) : null;

  const dialogContainer = libraryRef.current?.closest(".fluxora-shell");
  const importDialog = importFile ? <PromptImportDialog file={importFile} busy={isBackupBusy} onClose={() => setImportFile(null)} onImport={(mode) => void confirmImport(mode)} /> : null;
  const importModal = importDialog && dialogContainer ? createPortal(importDialog, dialogContainer) : importDialog;
  const promptEditor = promptCreateDialog && dialogContainer ? createPortal(promptCreateDialog, dialogContainer) : promptCreateDialog;
  const folderPicker = folderPickerRecord ? <PromptFolderPicker
    key={folderPickerRecord.id}
    record={favorites.find((record) => record.id === folderPickerRecord.id) ?? folderPickerRecord}
    folders={scopedFolders}
    onClose={() => setFolderPickerRecord(null)}
    onConfirm={async (folderId) => {
      const updated = await collectPromptToFolder(folderPickerRecord.id, folderId);
      await setFavorites((current) => current.map((record) => record.id === updated.id ? updated : record));
      setPreviewRecord((current) => current?.id === updated.id ? updated : current);
      setFolderPickerRecord(null);
      showToast("已收藏到文件夹");
    }}
  /> : null;
  const folderPickerDialog = folderPicker && dialogContainer ? createPortal(folderPicker, dialogContainer) : folderPicker;

  const renderAssetSection = (title: string, records: SavedPromptRecord[], emptyMessage: string) => (
    <section className="prompt-asset-section">
      <div className="prompt-asset-section-heading flex-wrap">
        <div className="flex items-center gap-2"><h2>{title}</h2><span className="text-xs text-white/50">{records.length}</span></div>
        {assetFilter === "all" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!activeFolder ? <><button type="button" className="icon-button" disabled={isBackupBusy} onClick={handleImport} title="导入 ZIP 或 JSON" aria-label="导入提示词"><Upload className="h-4 w-4" /></button><button type="button" className="icon-button" disabled={isBackupBusy} onClick={() => void handleExport()} title="导出全部提示词和示例图为 ZIP" aria-label="导出提示词 ZIP">{isBackupBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button></> : null}
            <button type="button" className="gradient-button prompt-add-button px-3 py-2 text-sm" disabled={isBackupBusy} onClick={() => { setIsCreatingPrompt(true); resetPromptDraft(); setPromptTitleDraft(""); }}><Plus className="h-4 w-4" />添加提示词</button>
          </div>
        ) : null}
      </div>
      {records.length > 0 ? (
        <div className="prompt-asset-grid">
          {previewOrder(records, draggingPromptId).map((record, index) => (
            <PromptCard
              folders={folders.filter((folder) => belongsToFolder(record, folder)).sort((left, right) => left.order - right.order)}
              key={record.id}
              record={record}
              isCopied={copiedId === record.id}
              isFavorite={record.isFavorite ?? false}
              isOptimizing={busyId === record.id}
              onCopy={() => void handleCopy(record)}
              onOpen={() => {
                setPreviewRecord(record);
                void markRecordUsed(record);
              }}
              onToggleFavorite={() => void toggleRecordFavorite(record)}
              onOptimize={() => setOptimizationRecord(record)}
              onDelete={() => void handleDeletePrompt(record)}
              onCollectToFolder={() => setFolderPickerRecord(record)}
              onMoveToTop={() => void handleMoveToTop(record.id)}
              isDragging={draggingPromptId === record.id}
              isDropTarget={Boolean(dropTargetId && draggingPromptId === record.id)}
              isPreview={Boolean(draggingPromptId && draggingPromptId !== record.id && records[index]?.id !== record.id)}
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData("application/x-prompt-butler-prompt", record.id);
                event.dataTransfer.effectAllowed = "move";
                const card = event.currentTarget.closest("article");
                if (card) event.dataTransfer.setDragImage(card, 24, 24);
                dragOrderRef.current = records.map((item) => item.id);
                setDraggingPromptId(record.id);
              }}
              onDragEnd={finishDrag}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("application/x-prompt-butler-prompt")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (record.id !== draggingPromptId) setDropTargetId(record.id);
              }}
              onDrop={(event) => {
                const sourceId = event.dataTransfer.getData("application/x-prompt-butler-prompt");
                if (!sourceId) return;
                event.preventDefault();
                event.stopPropagation();
                void commitDrop(() => movePrompt(sourceId, dropTargetId ?? record.id, records));
              }}
              onReorderKey={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                event.preventDefault();
                const index = records.findIndex((item) => item.id === record.id);
                const next = records[index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1)];
                if (next) void movePrompt(record.id, next.id, records);
              }}
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
        onSaveGroup={async (group) => { if (!previewRecord) throw new Error("提示词详情已关闭。"); await savePromptGroup(previewRecord, group); }}
        record={previewRecord}
        isCopied={Boolean(previewRecord && copiedId === previewRecord.id)}
        isFavorite={Boolean(previewRecord && (previewRecord.isFavorite ?? false))}
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
      {assetFilter !== "all" ? <button type="button" className="gradient-button prompt-add-button px-3 py-2 text-sm" onClick={() => { resetPromptDraft(); setPromptTitleDraft(""); setIsCreatingPrompt(true); }}><Plus className="h-4 w-4" />添加提示词</button> : null}
      {promptEditor}
      {folderPickerDialog}
      {importModal}
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
              <button type="button" onClick={() => { setIsCreatingFolder(true); setFolderNameDraft(""); setFolderColorDraft("blue"); }} title="新建收藏夹"><Plus className="h-4 w-4" /></button>
            </div>
          </header>
          {isCreatingFolder ? (
            <div data-enter-confirm className="prompt-folder-create-row">
              <input className="folder-create-input" aria-label="新建收藏夹名称" value={folderNameDraft} onChange={(event) => setFolderNameDraft(event.target.value)} placeholder="收藏夹名称" autoFocus />
              <FolderColorPicker value={folderColorDraft} onChange={setFolderColorDraft} />
              <button type="button" className="folder-create-confirm" aria-label="确认新建收藏夹" data-enter-submit onClick={() => void handleCreateFolder()} disabled={!folderNameDraft.trim()}><Check className="h-4 w-4" /></button>
              <button type="button" className="folder-create-cancel" aria-label="取消新建收藏夹" onClick={() => { setIsCreatingFolder(false); setFolderNameDraft(""); }}><X className="h-4 w-4" /></button>
            </div>
          ) : null}
          <div className="prompt-folder-grid folder-float-grid">
            {previewOrder(scopedFolders, draggingFolderId).map((folder, index) => {
              const folderRecords = sortPromptRecords(favorites.filter((record) => belongsToFolder(record, folder)));
              const isRenaming = renamingFolderId === folder.id;
              return (
                <motion.article key={folder.id}
                  draggable={!isRenaming}
                  onDragStartCapture={(event) => {
                    if ((event.target as HTMLElement).closest('.collection-folder-actions')) { event.preventDefault(); return; }
                    event.stopPropagation();
                    event.dataTransfer.setData("application/x-prompt-butler-folder", folder.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setDragImage(event.currentTarget, 24, 24);
                    dragOrderRef.current = scopedFolders.map((item) => item.id);
                    setDraggingFolderId(folder.id);
                  }}
                  onDragEndCapture={() => { folderDragEndedAt.current = Date.now(); finishDrag(); }}
                  layout={reduceMotion ? false : "position"}
                  initial={false}
                  animate={{ scale: !reduceMotion && draggingFolderId === folder.id ? 1.045 : 1, rotate: !reduceMotion && draggingFolderId === folder.id ? -1.5 : 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 23, mass: 0.8 }}
                  className={`${hoveredFolderId === folder.id && !draggingFolderId ? "is-hovered" : ""} ${draggingFolderId === folder.id ? "is-dragging" : ""} ${dropTargetId && draggingFolderId === folder.id ? "is-drop-target" : ""} ${draggingFolderId && draggingFolderId !== folder.id && scopedFolders[index]?.id !== folder.id ? "is-sort-preview" : ""}`}
                  onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes("application/x-prompt-butler-folder")) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (folder.id !== draggingFolderId) setDropTargetId(folder.id);
                  }}
                  onDrop={(event) => {
                    const sourceId = event.dataTransfer.getData("application/x-prompt-butler-folder");
                    if (!sourceId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    void commitDrop(() => moveFolder(sourceId, dropTargetId ?? folder.id));
                  }}>
                  <CollectionFolder
                    name={folder.name} color={folder.color} records={folderRecords} disabled={Boolean(draggingFolderId) || isRenaming}
                    onOpen={() => { if (!isRenaming && !draggingFolderId && Date.now() - folderDragEndedAt.current > 250) setSelectedFolderId(folder.id); }}
                    onRename={() => { cancelFolderRename.current = false; setRenamingFolderId(folder.id); setFolderNameDraft(folder.name); }}
                    onHover={(open) => setHoveredFolderId((current) => open ? folder.id : current === folder.id ? null : current)}
                    labelEditor={isRenaming ? <input className="folder-title-input" value={folderNameDraft} aria-label="收藏夹名称" autoFocus onFocus={(event) => event.currentTarget.select()} onChange={(event) => setFolderNameDraft(event.target.value)} onBlur={() => { if (!cancelFolderRename.current) void handleRenameFolder(folder); }} onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                      if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
                      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelFolderRename.current = true; setRenamingFolderId(null); setFolderNameDraft(""); }
                    }} /> : undefined}
                  />
                  {!isRenaming ? <div className="collection-folder-actions"><FolderColorMenu folder={folder} /><button type="button" onClick={() => void handleDeleteFolder(folder)} title="删除" aria-label={`删除收藏夹 ${folder.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div> : null}
                </motion.article>
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
      {folderPickerDialog}
      {importModal}

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
