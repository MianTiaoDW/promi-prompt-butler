// Run with: node scripts/test-prompt-organization.cjs (after npm ci).
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

(async () => {
  const result = await esbuild.build({
    stdin: { contents: 'export * from "./src/lib/folder-colors"; export * from "./src/lib/prompt-organization"; export * from "./src/lib/prompt-library"; export { storageSet } from "./src/lib/storage"; export { importPromptsFromFile } from "./src/lib/backup";', resolveDir: path.resolve(__dirname, "..") },
    bundle: true, write: false, platform: "node", format: "cjs"
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  const api = loaded.exports;
  assert.deepEqual(api.FOLDER_COLORS.map(color => color.id), ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "black", "white", "gray"]);
  assert.equal(api.getFolderColor().id, "blue", "Old folders remain blue after adding colors before blue in the palette");
  assert.equal(api.getFolderColor("unknown").id, "blue", "Unknown imported colors use the legacy blue fallback");
  assert.notEqual(api.getFolderColor("white").ink, "#ffffff", "White folders and selection marks use dark text");
  const data = {};
  global.chrome = { storage: { local: { get: async key => ({ [key]: structuredClone(data[key]) }), set: async values => Object.assign(data, structuredClone(values)) } } };
  const key = api.PROMPT_STORAGE_KEYS.favorites;
  const folderKey = api.PROMPT_STORAGE_KEYS.folders;
  const base = { title: "test", content: "body", category: "收藏", provider: "chatgpt", model: "", format: "cnPrompt", tags: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" };
  data[key] = ["a", "b", "c", "d"].map((id, order) => ({ ...base, id, order, isFavorite: id === "a" || id === "c" }));
  const beforeTop = structuredClone(data[key]);
  await api.movePromptToTop("c");
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), ["c", "a", "b", "d"], "Move to top puts the selected prompt first globally, including from filtered views");
  assert.deepEqual(data[key].find(r => r.id === "c"), { ...beforeTop[2], order: 0 }, "Move to top preserves content, favorite status and timestamps");
  await api.movePromptToTop("c");
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), ["c", "a", "b", "d"], "Moving the first prompt is idempotent");
  await assert.rejects(api.movePromptToTop("missing"), /提示词已删除/);
  const topSnapshot = structuredClone(data[key]);
  const setBeforeTopFailure = chrome.storage.local.set;
  chrome.storage.local.set = async () => { throw new Error("Top write failure"); };
  await assert.rejects(api.movePromptToTop("d"), /Top write failure/);
  assert.deepEqual(data[key], topSnapshot, "A failed move to top preserves stored order");
  chrome.storage.local.set = setBeforeTopFailure;
  data[key] = beforeTop;
  await api.reorderPromptRecords(["d", "a", "b", "c"]);
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), ["d", "a", "b", "c"]);
  await api.updateFavoritePrompt("b", { lastUsedAt: "2026-10-10", lastUsed: "2026-10-10", usedCount: 1, usageCount: 1 });
  assert.equal(data[key].find(r => r.id === "b").updatedAt, base.updatedAt, "Opening/copying must not change the content timestamp");
  await api.updateFavoritePrompt("b", { title: "edited" });
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), ["d", "a", "b", "c"], "Editing must not reorder cards");
  await api.reorderPromptRecords(["c", "a"]);
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), ["d", "c", "b", "a"], "Favorite/search reorder preserves hidden slots");
  const saved = await api.savePromptToFavorites(base);
  assert.equal(api.sortPromptRecords(data[key]).at(-1).id, saved.id, "New prompts append after the manual sequence");
  const folder1 = await api.createPromptFolder("First", "旧分类", "red");
  const folder2 = await api.createPromptFolder("Second", "收藏");
  assert.equal(folder1.color, "red", "New folders keep the chosen color");
  assert.equal(folder2.color, "blue", "Folders default to the existing blue");
  await assert.rejects(api.updatePromptFolderColor(folder1.id, "not-a-color"), /有效的收藏夹颜色/);
  assert.equal(data[folderKey].find(f => f.id === folder1.id).color, "red", "Invalid colors do not change stored data");
  await api.updatePromptFolderColor(folder1.id, "purple");
  assert.equal(data[folderKey].find(f => f.id === folder1.id).color, "purple", "Changing folder color persists without changing membership");
  for (const color of ["cyan", "black", "white"]) {
    await api.updatePromptFolderColor(folder1.id, color);
    assert.equal(data[folderKey].find(f => f.id === folder1.id).color, color);
  }
  await api.updatePromptFolderColor(folder1.id, "purple");
  await api.reorderPromptFolders(null, [folder2.id, folder1.id]);
  assert.deepEqual([...data[folderKey]].sort((a, b) => a.order - b.order).map(f => f.id), [folder2.id, folder1.id], "Folder ordering crosses old category scopes");
  const original = data[key].find(r => r.id === "a");
  const collected = await api.collectPromptToFolder("a", folder2.id);
  assert.equal(collected.isFavorite, original.isFavorite);
  assert.equal(collected.order, original.order);
  await api.collectPromptToFolder("a", folder2.id);
  assert.deepEqual(data[key].find(r => r.id === "a").folderIds, [folder2.id], "Collecting twice does not duplicate membership");
  data[key].push({ ...base, id: "legacy", category: "旧分类/First" });
  await api.collectPromptToFolder("legacy", folder2.id);
  assert.deepEqual(data[key].find(r => r.id === "legacy").folderIds, [folder1.id, folder2.id], "Legacy folder contents survive collection to another folder");
  await api.renamePromptFolder(folder1.id, "Renamed");
  assert.equal(api.belongsToFolder(data[key].find(r => r.id === "legacy"), data[folderKey].find(f => f.id === folder1.id)), true);
  await api.deletePromptFolder(folder2.id);
  assert.equal(data[key].some(r => r.id === "a"), true, "Deleting a folder preserves prompts");
  assert.equal(data[key].find(r => r.id === "a").folderIds.includes(folder2.id), false);
  assert.equal(data[folderKey].find(f => f.id === folder1.id).order, 1, "Deleting a folder must not change remaining ranks");
  const backup = { version: 2, favorites: structuredClone(data[key]), folders: structuredClone(data[folderKey]), customTabs: [] };
  data[key] = []; data[folderKey] = [];
  await api.importPromptsFromFile(new File([JSON.stringify(backup)], "backup.json"), "replace");
  assert.deepEqual(api.sortPromptRecords(data[key]).map(r => r.id), api.sortPromptRecords(backup.favorites).map(r => r.id), "Backup restores manual ordering");
  assert.deepEqual(data[key].find(r => r.id === "legacy").folderIds, [folder1.id], "Backup restores folder membership");
  assert.equal(data[folderKey].find(f => f.id === folder1.id).color, "purple", "Backup restores folder colors");
  const group = { notes: "", steps: [{ name: "去掉重复序号", content: "修改后的正文" }] };
  await Promise.all([
    api.updateFavoritePrompt("a", { group, content: "修改后的正文" }),
    api.updateFavoritePrompt("a", { lastUsedAt: "2026-10-11", usedCount: 2 }),
    api.reorderPromptRecords(["a", "b", "c", "d"])
  ]);
  assert.deepEqual(data[key].find(r => r.id === "a").group, group, "Usage and sorting must not overwrite a concurrent step edit");
  assert.equal(data[key].find(r => r.id === "a").usedCount, 2);
  const beforeMigration = structuredClone(data[key]);
  await api.updateFavoritePrompt("a", { title: "最新标题" });
  await api.storageSet(key, beforeMigration.map(r => ({ ...r, imageStorageVersion: 2, linkedImages: [] })), beforeMigration);
  assert.equal(data[key].find(r => r.id === "a").title, "最新标题", "A delayed startup migration preserves new user edits");
  const beforeDelete = structuredClone(data[key]);
  await api.storageSet(key, beforeDelete.filter(r => r.id !== "a"), beforeDelete);
  await api.storageSet(key, beforeDelete.map(r => r.id === "a" ? { ...r, usedCount: 3 } : r), beforeDelete);
  assert.equal(data[key].some(r => r.id === "a"), false, "A late usage update does not resurrect a deleted prompt");
  const originalSet = chrome.storage.local.set;
  chrome.storage.local.set = async () => { throw new Error("Write failure fixture"); };
  await assert.rejects(api.updateFavoritePrompt("b", { title: "失败修改" }), /Write failure fixture/);
  chrome.storage.local.set = originalSet;
  await api.updateFavoritePrompt("b", { title: "恢复成功" });
  assert.equal(data[key].find(r => r.id === "b").title, "恢复成功", "A failed write must not block future saves");
  data[folderKey] = [{ id: "keep", name: "保留夹", scope: "收藏", order: 0 }, { id: "remove", name: "移出夹", scope: "收藏", order: 1 }];
  const removalRecord = { ...base, id: "removal", folderIds: ["keep", "remove"], category: "收藏/移出夹", isFavorite: true, exampleImageIds: ["image"], order: 8 };
  data[key] = [removalRecord];
  await api.removePromptFromFolder("removal", "remove");
  assert.equal(data[key].length, 1, "Removing a folder membership must keep the prompt in all prompts");
  assert.deepEqual(data[key][0], { ...removalRecord, folderIds: ["keep"], category: "收藏" }, "Remove only current folder, including legacy category, and preserve favorite, images and content");
  assert.equal(api.belongsToFolder(data[key][0], data[folderKey][1]), false);
  assert.equal(api.belongsToFolder(data[key][0], data[folderKey][0]), true);
  data[key] = [{ ...removalRecord, folderIds: undefined }];
  await api.removePromptFromFolder("removal", "remove");
  assert.equal(api.belongsToFolder(data[key][0], data[folderKey][1]), false, "Legacy category-only membership must also be removed");
  console.log("PASS: persistent sorting, collection, non-destructive folder removal with legacy compatibility, rename/delete and backup restore");
})().catch(error => { console.error(error); process.exitCode = 1; });
