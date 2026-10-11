import { storageGet, storageSet } from "./storage";
import { PROMPT_STORAGE_KEYS } from "./prompt-library";
import type { PromptFolder, SavedPromptRecord } from "../types/prompt";

export function sortPromptRecords(records: SavedPromptRecord[]) {
  // Stable ties preserve the stored sequence, including records from older backups.
  return [...records].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER));
}

export function belongsToFolder(record: SavedPromptRecord, folder: PromptFolder) {
  return record.folderIds?.includes(folder.id) || record.category === `${folder.scope || "收藏"}/${folder.name}`;
}

export function getRecordFolderIds(record: SavedPromptRecord, folders: PromptFolder[]) {
  return folders.filter((folder) => belongsToFolder(record, folder)).map((folder) => folder.id);
}

export function moveOrderedId(ids: string[], sourceId: string, targetId: string) {
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids;
  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export async function reorderPromptRecords(orderedVisibleIds: string[]) {
  const existing = sortPromptRecords(await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []));
  const validIds = new Set(existing.map((record) => record.id));
  const orderedIds = [...new Set(orderedVisibleIds)].filter((id) => validIds.has(id));
  const visibleIds = new Set(orderedIds);
  let visibleIndex = 0;
  // A filtered view only replaces its own slots; hidden records keep their positions.
  const nextIds = existing.map((record) => visibleIds.has(record.id) ? orderedIds[visibleIndex++] : record.id);
  const byId = new Map(existing.map((record) => [record.id, record]));
  const next = nextIds.map((id, order) => ({ ...byId.get(id)!, order }));
  return storageSet(PROMPT_STORAGE_KEYS.favorites, next, existing);
}

export async function collectPromptToFolder(promptId: string, folderId: string) {
  const folders = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  if (!folders.some((folder) => folder.id === folderId)) throw new Error("收藏夹已删除，请重新选择。");
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const record = records.find((item) => item.id === promptId);
  if (!record) throw new Error("提示词已删除。");
  const updated = { ...record, folderIds: [...new Set([...getRecordFolderIds(record, folders), folderId])] };
  const saved = await storageSet(PROMPT_STORAGE_KEYS.favorites, records.map((item) => item.id === promptId ? updated : item), records);
  return saved.find((item) => item.id === promptId)!;
}
