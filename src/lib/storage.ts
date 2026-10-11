import { COLLECTION_KEYS, mergeStoredCollection, type CollectionChange } from "./collection-storage";

type StorageArea = Pick<
  chrome.storage.StorageArea,
  "get" | "set"
>;

type StorageChangeHandler<T> = (value: T) => void;

export const STORAGE_KEYS = {
  extensionSettings: "prompt-butler-extension-settings"
} as const;

function getStorageArea(): StorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null;
  }

  return chrome.storage.local;
}

function getSessionStorageArea(): StorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return null;
  }

  return chrome.storage.session;
}

export async function storageGet<T>(key: string, fallbackValue: T): Promise<T> {
  const storageArea = getStorageArea();

  if (!storageArea) {
    return fallbackValue;
  }

  const result = await storageArea.get(key);
  return (result[key] as T | undefined) ?? fallbackValue;
}

export async function storageSet<T>(key: string, value: T, previousValue?: T): Promise<T> {
  const storageArea = getStorageArea();

  if (!storageArea) {
    throw new Error("当前环境无法保存本地数据。");
  }

  if (COLLECTION_KEYS.includes(key as typeof COLLECTION_KEYS[number])) {
    if (previousValue === undefined) throw new Error("保存提示词时缺少原始记录。");
    const change = { key, before: previousValue, after: value } as unknown as CollectionChange;
    if (typeof window === "undefined") return await mergeStoredCollection(change) as unknown as T;
    const response = await new Promise<{ ok: boolean; records?: T; message?: string }>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "storage:merge-collection", payload: change }, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response);
      });
    });
    if (!response?.ok || !response.records) throw new Error(response?.message || "保存失败，请重试。");
    return response.records;
  }
  await storageArea.set({ [key]: value });
  return value;
}

export async function sessionStorageGet<T>(key: string, fallbackValue: T): Promise<T> {
  const storageArea = getSessionStorageArea();

  if (!storageArea) {
    return fallbackValue;
  }

  const result = await storageArea.get(key);
  return (result[key] as T | undefined) ?? fallbackValue;
}

export async function sessionStorageSet<T>(key: string, value: T) {
  const storageArea = getSessionStorageArea();

  if (!storageArea) {
    return;
  }

  await storageArea.set({ [key]: value });
}

export function subscribeStorage<T>(
  key: string,
  fallbackValue: T,
  handler: StorageChangeHandler<T>
) {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return () => undefined;
  }

  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "local" || !(key in changes)) {
      return;
    }

    const nextValue = (changes[key]?.newValue as T | undefined) ?? fallbackValue;
    handler(nextValue);
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export function subscribeSessionStorage<T>(
  key: string,
  fallbackValue: T,
  handler: StorageChangeHandler<T>
) {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return () => undefined;
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "session" || !(key in changes)) return;
    handler((changes[key]?.newValue as T | undefined) ?? fallbackValue);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
