import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { storageGet, storageSet } from "./storage";
import { getCustomTabs, CUSTOM_TABS_KEY, PROMPT_STORAGE_KEYS, CORE_TABS, DEFAULT_PROMPT_TABS } from "./prompt-library";
import { getExampleImagePayload, saveExampleImage, deleteExampleImageAsset, MAX_EXAMPLE_IMAGES } from "./example-images";
import { formatPromptGroup } from "./prompt-group";
import type { PromptFolder, SavedPromptRecord } from "../types/prompt";

interface PromptBackup {
  version: number;
  exportedAt: string;
  favorites: SavedPromptRecord[];
  folders: PromptFolder[];
  customTabs: string[];
  imageFiles?: Record<string, string[]>;
}

function bytesFromDataUrl(dataUrl: string) {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function exportPromptsAsZip() {
  const [favorites, folders, customTabs] = await Promise.all([
    storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []),
    storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []), getCustomTabs()
  ]);
  const entries: Record<string, Uint8Array> = { "images/": new Uint8Array() };
  const imageFiles: Record<string, string[]> = {};
  for (const record of favorites) {
    imageFiles[record.id] = [];
    for (const imageId of record.exampleImageIds ?? []) {
      const image = await getExampleImagePayload(imageId);
      if (!image) throw new Error(`“${record.title}”的示例图无法读取，请先重新上传或删除该示例图。`);
      const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/jpeg" ? "jpg" : "webp";
      const path = `images/${image.id}.${extension}`;
      entries[path] = bytesFromDataUrl(image.dataUrl);
      imageFiles[record.id].push(path);
    }
  }
  const backup: PromptBackup = {
    version: 2, exportedAt: new Date().toISOString(),
    favorites: favorites.map((record) => ({ ...record, exampleImageIds: [], linkedImages: [] })),
    folders, customTabs, imageFiles
  };
  entries["prompts.json"] = strToU8(JSON.stringify(backup, null, 2));
  const zipped = zipSync(entries);
  const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename: `prompt-butler-backup-${new Date().toISOString().slice(0, 10)}.zip`, saveAs: true });
  } finally { URL.revokeObjectURL(url); }
}

interface CollectedExport {
  title: string;
  content: string;
  note?: string;
  steps?: Array<{ title?: string; content: string }>;
  images?: Array<{ id?: string; fileName: string }>;
  coverImageId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function readPromptBackup(file: File): Promise<{ backup: PromptBackup; entries: Record<string, Uint8Array> }> {
  let data: unknown;
  let entries: Record<string, Uint8Array> = {};
  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      if (!entries["prompts.json"]) throw new Error("压缩包中缺少 prompts.json。");
      data = JSON.parse(strFromU8(entries["prompts.json"]).replace(/^\uFEFF/, ""));
    } else {
      data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    }
  } catch (error) {
    throw new Error(error instanceof Error ? `无法读取备份：${error.message}` : "无法读取备份。");
  }
  const raw = data as Partial<PromptBackup> & { prompts?: CollectedExport[] };
  if (!raw || typeof raw !== "object") throw new Error("备份格式不正确。");
  let backup: PromptBackup;
  if (Array.isArray(raw.favorites)) {
    backup = { version: raw.version ?? 1, exportedAt: raw.exportedAt ?? "", favorites: raw.favorites, folders: raw.folders ?? [], customTabs: raw.customTabs ?? [], imageFiles: raw.imageFiles ?? {} };
  } else if (Array.isArray(raw.prompts)) {
    const imageFiles: Record<string, string[]> = {};
    const favorites: SavedPromptRecord[] = [];
    for (const prompt of raw.prompts) {
      if (typeof prompt.title !== "string" || typeof prompt.content !== "string") throw new Error("提示词缺少标题或正文。");
      const identity = new TextEncoder().encode(`${prompt.title}\n${prompt.createdAt ?? prompt.content}`);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", identity));
      const id = `imported-${Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const group = { notes: prompt.note ?? "", steps: prompt.steps?.length ? prompt.steps.map((step) => ({ name: step.title ?? "", content: step.content })) : [{ name: "", content: prompt.content }] };
      const images = [...(prompt.images ?? [])];
      images.sort((left, right) => Number(right.id === prompt.coverImageId) - Number(left.id === prompt.coverImageId));
      imageFiles[id] = images.map((image) => `images/${image.fileName}`);
      favorites.push({ id, title: prompt.title, content: formatPromptGroup(group), group, category: "收藏", tags: [], source: "user-created", provider: "chatgpt", model: "", format: "cnPrompt", createdAt: prompt.createdAt ?? new Date().toISOString(), updatedAt: prompt.updatedAt });
    }
    backup = { version: 2, exportedAt: raw.exportedAt ?? "", favorites, folders: [], customTabs: [], imageFiles };
  } else { throw new Error("备份缺少提示词数据。"); }
  if (!Array.isArray(backup.folders) || !Array.isArray(backup.customTabs)) throw new Error("分类或收藏夹格式不正确。");
  const ids = new Set<string>();
  for (const record of backup.favorites) {
    if (!record || typeof record.id !== "string" || typeof record.title !== "string" || typeof record.content !== "string" || typeof record.category !== "string" || ids.has(record.id)) throw new Error("提示词记录格式不正确或 ID 重复。");
    ids.add(record.id);
    if (record.folderIds !== undefined && (!Array.isArray(record.folderIds) || record.folderIds.some((id) => typeof id !== "string"))) throw new Error("提示词的收藏夹记录格式不正确。");
    if (record.group && (!Array.isArray(record.group.steps) || !record.group.steps.length || record.group.steps.some((step) => typeof step.content !== "string" || typeof step.name !== "string") || typeof record.group.notes !== "string")) throw new Error("提示词组格式不正确。");
    const paths = backup.imageFiles?.[record.id] ?? [];
    if (!Array.isArray(paths) || paths.length > MAX_EXAMPLE_IMAGES) throw new Error("每个提示词最多支持 3 张示例图。");
    for (const path of paths) {
      if (typeof path !== "string" || !/^images\/[^/\\]+\.(webp|png|jpe?g)$/i.test(path) || !entries[path]) throw new Error(`示例图缺失或格式不正确：${path}`);
    }
  }
  return { backup, entries };
}

export async function importPromptsFromFile(file: File, mode: "append" | "replace" = "append") {
  const { backup, entries } = await readPromptBackup(file);
  const [existing, existingFolders, existingTabs] = await Promise.all([
    storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []),
    storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []), getCustomTabs()
  ]);
  const existingIds = new Set(existing.map((record) => record.id));
  const identity = (record: SavedPromptRecord) => JSON.stringify([
    record.title.trim(),
    (record.group ? formatPromptGroup(record.group) : record.content).replace(/\r\n/g, "\n").trim()
  ]);
  const identities = new Set(existing.map(identity));
  const newRecords = backup.favorites.filter((record) => {
    if (mode === "replace") return true;
    const key = identity(record);
    if (existingIds.has(record.id) || identities.has(key)) return false;
    existingIds.add(record.id);
    identities.add(key);
    return true;
  }).map((record) => ({ ...record, isFavorite: record.isFavorite ?? false, tags: record.tags ?? [], linkedImages: [], exampleImageIds: [] as string[], imageStorageVersion: 2 as const }));
  const savedImages: string[] = [];
  try {
    for (const record of newRecords) {
      for (const path of backup.imageFiles?.[record.id] ?? []) {
        const mime = /\.png$/i.test(path) ? "image/png" : /\.jpe?g$/i.test(path) ? "image/jpeg" : "image/webp";
        const image = await saveExampleImage({ promptId: record.id, image: new File([new Uint8Array(entries[path])], path.split("/").pop()!, { type: mime }), source: "upload", sortOrder: record.exampleImageIds.length });
        record.exampleImageIds.push(image.image.id);
        if (!image.duplicate) savedImages.push(image.image.id);
      }
    }
  } catch (error) {
    await Promise.allSettled(savedImages.map(deleteExampleImageAsset));
    throw error;
  }
  const folderIds = new Set(existingFolders.map((folder) => folder.id));
  const newFolders = backup.folders.filter((folder) => mode === "replace" || !folderIds.has(folder.id));
  const categories = newRecords.map((record) => record.category.split("/")[0]);
  const importedTabs = [...backup.customTabs, ...categories].filter((tab) => !CORE_TABS.includes(tab) && !DEFAULT_PROMPT_TABS.includes(tab as typeof DEFAULT_PROMPT_TABS[number]));
  const tabs = [...new Set([...(mode === "replace" ? [] : existingTabs), ...importedTabs])];
  await storageSet(PROMPT_STORAGE_KEYS.favorites, [...newRecords, ...(mode === "replace" ? [] : existing)], existing);
  await storageSet(PROMPT_STORAGE_KEYS.folders, [...newFolders, ...(mode === "replace" ? [] : existingFolders)], existingFolders);
  await storageSet(CUSTOM_TABS_KEY, tabs);
  return { favorites: newRecords.length, skipped: backup.favorites.length - newRecords.length, folders: newFolders.length, images: newRecords.reduce((count, record) => count + record.exampleImageIds.length, 0) };
}
