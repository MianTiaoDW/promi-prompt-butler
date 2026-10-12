import { IMAGE_STORAGE_KEYS } from "../lib/image-library";
import { storageGet, storageSet } from "../lib/storage";
import type { ImageHistoryEntry } from "../types/image";
import { fetchImageAsDataUrl } from "./example-image-store";

export function latestCreationHistory(entries: ImageHistoryEntry[]) {
  return [...entries].sort((left, right) =>
    new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime()
  ).slice(0, 50);
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("promi-creation-history", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCreationHistory(entries: ImageHistoryEntry[]) {
  const snapshots = await Promise.all(entries.map(async entry => ({
    ...entry, url: entry.url.startsWith("data:") ? entry.url : await fetchImageAsDataUrl(entry.url)
  })));
  const existing = await storageGet<ImageHistoryEntry[]>(IMAGE_STORAGE_KEYS.history, []);
  const ids = new Set(entries.map(entry => entry.id));
  const next = latestCreationHistory([...entries, ...existing.filter(entry => !ids.has(entry.id))]);
  const retained = new Set(next.map(entry => entry.id));
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      snapshots.filter(entry => retained.has(entry.id)).forEach(entry => store.put(entry));
      existing.filter(entry => !retained.has(entry.id)).forEach(entry => store.delete(entry.id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    // Keep image bytes in IndexedDB, avoiding chrome.storage's small quota.
    await storageSet(IMAGE_STORAGE_KEYS.history, next.map(entry => ({ ...entry, url: "" })));
    return snapshots;
  } finally { db.close(); }
}

export async function readCreationHistory() {
  const entries = await storageGet<ImageHistoryEntry[]>(IMAGE_STORAGE_KEYS.history, []);
  const db = await database();
  try {
    const snapshots = await new Promise<ImageHistoryEntry[]>((resolve, reject) => {
      const request = db.transaction("images").objectStore("images").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const ids = new Set(snapshots.map(entry => entry.id));
    const restored = latestCreationHistory([...snapshots, ...entries.filter(entry => !ids.has(entry.id))]);
    if (restored.map(entry => entry.id).join("|") !== entries.map(entry => entry.id).join("|")) {
      await storageSet(IMAGE_STORAGE_KEYS.history, restored.map(entry => ({ ...entry, url: "" })));
    }
    return restored;
  } finally { db.close(); }
}

export async function clearCreationHistory() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      transaction.objectStore("images").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    await storageSet(IMAGE_STORAGE_KEYS.history, []);
  } finally { db.close(); }
}
