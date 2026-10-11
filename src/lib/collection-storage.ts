export const COLLECTION_KEYS = ["prompt-butler-favorites", "prompt-butler-folders"] as const;
type RecordValue = { id: string; [key: string]: unknown };
export interface CollectionChange {
  key: string;
  before: RecordValue[];
  after: RecordValue[];
}
let writes: Promise<unknown> = Promise.resolve();

// Runs in the background worker: merge only changed fields against the latest data.
export function mergeStoredCollection(change: CollectionChange): Promise<RecordValue[]> {
  const write = writes.catch(() => undefined).then(async () => {
    if (!COLLECTION_KEYS.includes(change.key as typeof COLLECTION_KEYS[number])) throw new Error("不支持的存储集合。");
    for (const records of [change.before, change.after]) {
      if (!Array.isArray(records) || records.some((record) => !record || typeof record.id !== "string") || new Set(records.map((record) => record.id)).size !== records.length) throw new Error("存储记录格式不正确。");
    }
    const stored = await chrome.storage.local.get(change.key);
    const current = (stored[change.key] ?? []) as RecordValue[];
    const before = new Map(change.before.map((record) => [record.id, record]));
    const after = new Map(change.after.map((record) => [record.id, record]));
    const next = current.filter((record) => !before.has(record.id) || after.has(record.id)).map((record) => {
      const previous = before.get(record.id);
      const desired = after.get(record.id);
      if (!previous || !desired) return record;
      const merged = { ...record };
      for (const field of new Set([...Object.keys(previous), ...Object.keys(desired)])) {
        if (field === "id" || JSON.stringify(previous[field]) === JSON.stringify(desired[field])) continue;
        if (desired[field] === undefined) delete merged[field];
        else merged[field] = desired[field];
      }
      return merged;
    });
    const currentIds = new Set(current.map((record) => record.id));
    for (const record of change.after) if (!before.has(record.id) && !currentIds.has(record.id)) next.push(record);
    await chrome.storage.local.set({ [change.key]: next });
    return next;
  });
  writes = write;
  return write;
}
