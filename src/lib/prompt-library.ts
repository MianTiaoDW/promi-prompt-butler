import { storageGet, storageSet } from "./storage";
import { DEFAULT_PROMPT_SEEDS, RETIRED_SEED_IDS } from "./seed-prompts";
import { formatPromptGroup } from "./prompt-group";
import { remapMarks } from "./prompt-marks";
import { validateFolderColor } from "./folder-colors";
import type {
  PromptFolder,
  PromptOutputFormat,
  SavedPromptRecord
} from "../types/prompt";
import type { ProviderId } from "../types/settings";

export const PROMPT_STORAGE_KEYS = {
  favorites: "prompt-butler-favorites",
  workspace: "prompt-butler-workspace",
  folders: "prompt-butler-folders"
} as const;

export const DEFAULT_PROMPT_TABS = [
  "角色设定",
  "图像生成",
  "收藏",
  "Nano精修",
  "AI视频运镜",
  "3D建模",
  "电商详情页"
] as const;

export const CORE_TABS: readonly string[] = ["角色设定", "图像生成", "收藏"];

export const CUSTOM_TABS_KEY = "prompt-butler-custom-tabs";
const DELETED_TABS_KEY = "prompt-butler-deleted-tabs";
const TAB_ORDER_KEY = "prompt-butler-tab-order";
const DEFAULT_PROMPTS_VERSION_KEY = "prompt-butler-default-prompts-version";
const DEFAULT_PROMPTS_VERSION = 1;

export async function getCustomTabs(): Promise<string[]> {
  return storageGet<string[]>(CUSTOM_TABS_KEY, []);
}

export async function getVisibleTabs(): Promise<string[]> {
  const customTabs = await getCustomTabs();
  const deletedTabs = await storageGet<string[]>(DELETED_TABS_KEY, []);
  const tabOrder = await storageGet<string[]>(TAB_ORDER_KEY, []);
  const deletedSet = new Set(deletedTabs);

  const allTabs = [...DEFAULT_PROMPT_TABS, ...customTabs];
  const visible = allTabs.filter((t) => !deletedSet.has(t));

  if (tabOrder.length === 0) return visible;

  const ordered = tabOrder.filter((t) => visible.includes(t));
  const newTabs = visible.filter((t) => !ordered.includes(t));
  return [...ordered, ...newTabs];
}

export async function saveTabOrder(orderedTabs: string[]) {
  await storageSet(TAB_ORDER_KEY, orderedTabs);
}

export async function addCustomTab(name: string) {
  const tabs = await getCustomTabs();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("预设名称不能为空。");
  }

  const deletedTabs = await storageGet<string[]>(DELETED_TABS_KEY, []);
  const allExisting = [...DEFAULT_PROMPT_TABS, ...tabs].filter((t) => !deletedTabs.includes(t));
  if (allExisting.includes(trimmedName)) {
    throw new Error("同名预设已存在。");
  }

  const next = [...tabs, trimmedName];
  await storageSet(CUSTOM_TABS_KEY, next);

  // Add to tab order
  const tabOrder = await storageGet<string[]>(TAB_ORDER_KEY, []);
  await storageSet(TAB_ORDER_KEY, [...tabOrder, trimmedName]);

  return next;
}

export async function renameCustomTab(oldName: string, newName: string) {
  const tabs = await getCustomTabs();
  const trimmedName = newName.trim();
  const idx = tabs.indexOf(oldName);
  const visibleTabs = await getVisibleTabs();

  if (CORE_TABS.includes(oldName) || !visibleTabs.includes(oldName)) {
    throw new Error("预设不存在。");
  }

  if (!trimmedName) {
    throw new Error("预设名称不能为空。");
  }

  if (
    CORE_TABS.includes(trimmedName) ||
    (trimmedName !== oldName && DEFAULT_PROMPT_TABS.includes(trimmedName as (typeof DEFAULT_PROMPT_TABS)[number])) ||
    visibleTabs.some((tab) => tab !== oldName && tab === trimmedName)
  ) {
    throw new Error("同名预设已存在。");
  }
  if (trimmedName === oldName) return tabs;

  const next = [...tabs];
  if (idx === -1) {
    next.push(trimmedName);
    const deletedTabs = await storageGet<string[]>(DELETED_TABS_KEY, []);
    await storageSet(DELETED_TABS_KEY, [...deletedTabs, oldName]);
  } else {
    next[idx] = trimmedName;
  }
  await storageSet(CUSTOM_TABS_KEY, next);
  await saveTabOrder(visibleTabs.map((tab) => tab === oldName ? trimmedName : tab));

  // Update prompt categories referencing the old name
  const favorites = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const nextFavorites = favorites.map((r) =>
    r.category === oldName || r.category.startsWith(`${oldName}/`)
      ? { ...r, category: r.category.replace(oldName, trimmedName), updatedAt: new Date().toISOString() }
      : r
  );
  await storageSet(PROMPT_STORAGE_KEYS.favorites, nextFavorites, favorites);

  // Update folders referencing the old scope
  const folders = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const nextFolders = folders.map((f) =>
    f.scope === oldName ? { ...f, scope: trimmedName } : f
  );
  await storageSet(PROMPT_STORAGE_KEYS.folders, nextFolders, folders);

  return next;
}

export async function deleteTab(name: string): Promise<{ customTabs: string[]; visibleTabs: string[] }> {
  if (CORE_TABS.includes(name)) {
    throw new Error("核心标签不能删除。");
  }

  // Keep the contents accessible after removing their category.
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  await storageSet(PROMPT_STORAGE_KEYS.favorites, records.map((record) =>
    record.category === name || record.category.startsWith(`${name}/`)
      ? { ...record, category: `收藏${record.category.slice(name.length)}` }
      : record
  ), records);
  const folders = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  await storageSet(PROMPT_STORAGE_KEYS.folders, folders.map((folder) =>
    folder.scope === name ? { ...folder, scope: "收藏" } : folder
  ), folders);

  // Remove from custom tabs if applicable
  let customTabs = await getCustomTabs();
  if (customTabs.includes(name)) {
    customTabs = customTabs.filter((t) => t !== name);
    await storageSet(CUSTOM_TABS_KEY, customTabs);
  }

  // Add to deleted set
  const deletedTabs = await storageGet<string[]>(DELETED_TABS_KEY, []);
  if (!deletedTabs.includes(name)) {
    await storageSet(DELETED_TABS_KEY, [...deletedTabs, name]);
  }

  // Remove from tab order
  const tabOrder = await storageGet<string[]>(TAB_ORDER_KEY, []);
  await storageSet(TAB_ORDER_KEY, tabOrder.filter((t) => t !== name));

  const visibleTabs = await getVisibleTabs();
  return { customTabs, visibleTabs };
}

const tagRules = [
  { tag: "角色设定", keywords: ["角色", "设定", "人设", "character"] },
  { tag: "光影", keywords: ["光", "光影", "lighting", "rim light", "glow"] },
  { tag: "运镜", keywords: ["镜头", "camera", "dolly", "tracking", "推镜"] },
  { tag: "打斗", keywords: ["战斗", "打斗", "combat", "fight", "action"] },
  { tag: "写实", keywords: ["realistic", "photoreal", "写实", "纪实"] },
  { tag: "插画", keywords: ["illustration", "anime", "插画", "漫画"] },
  { tag: "3D建模", keywords: ["3d", "建模", "render", "octane"] },
  { tag: "电商详情页", keywords: ["电商", "产品", "商品", "详情页", "product"] }
];

export function recommendPromptTags(content: string) {
  const normalized = content.toLowerCase();
  const matches = tagRules
    .filter((rule) => rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
    .map((rule) => rule.tag);

  return matches.length > 0 ? matches.slice(0, 4) : ["收藏", "待整理"];
}

export async function savePromptToFavorites(input: {
  provider: ProviderId;
  model: string;
  format: PromptOutputFormat;
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
  source?: SavedPromptRecord["source"];
  isFavorite?: boolean;
  isFrequent?: boolean;
  contentVariants?: SavedPromptRecord["contentVariants"];
  marks?: SavedPromptRecord["marks"];
  variantMarks?: SavedPromptRecord["variantMarks"];
}) {
  const existing = await storageGet<SavedPromptRecord[]>(
    PROMPT_STORAGE_KEYS.favorites,
    []
  );
  const record: SavedPromptRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title?.trim() || "",
    createdAt: new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    format: input.format,
    content: input.content,
    category: input.category?.trim() || "收藏",
    tags: input.tags?.length ? input.tags : recommendPromptTags(input.content),
    order: existing.reduce((max, item) => Math.max(max, item.order ?? -1), -1) + 1,
    source: input.source ?? "creator",
    isFavorite: input.isFavorite ?? false,
    isFrequent: input.isFrequent,
    versions: [],
    usedCount: 0,
    linkedImages: [],
    exampleImageIds: [],
    imageStorageVersion: 2,
    version: "1.0",
    usageCount: 0,
    lastUsed: "",
    contentVariants: input.contentVariants,
    marks: input.marks,
    variantMarks: input.variantMarks
  };

  await storageSet(PROMPT_STORAGE_KEYS.favorites, [record, ...existing], existing);

  return record;
}

export async function updateFavoritePrompt(
  promptId: string,
  patch: Partial<Pick<SavedPromptRecord, "group" | "title" | "content" | "category" | "tags" | "isFavorite" | "isFrequent" | "lastUsedAt" | "versions" | "usedCount" | "linkedImages" | "exampleImageIds" | "imageStorageVersion" | "version" | "usageCount" | "lastUsed" | "source" | "contentVariants" | "marks" | "variantMarks">>
) {
  const existing = await storageGet<SavedPromptRecord[]>(
    PROMPT_STORAGE_KEYS.favorites,
    []
  );
  const usageKeys = new Set(["lastUsedAt", "lastUsed", "usedCount", "usageCount"]);
  const changesAssetContent = Object.keys(patch).some((key) => !usageKeys.has(key));
  const nextRecords = existing.map(record => {
    if (record.id !== promptId) return record;
    const annotations: Partial<SavedPromptRecord> = {};
    if (patch.content !== undefined && patch.content !== record.content && patch.marks === undefined) annotations.marks = remapMarks(record.content, patch.content, record.marks ?? []);
    if (patch.contentVariants && !patch.variantMarks) {
      annotations.variantMarks = { ...record.variantMarks };
      for (const format of Object.keys(patch.contentVariants) as PromptOutputFormat[]) {
        const before = record.contentVariants?.[format] ?? (format === record.format ? record.content : "");
        annotations.variantMarks[format] = remapMarks(before, patch.contentVariants[format] ?? "", record.variantMarks?.[format] ?? (format === record.format ? record.marks ?? [] : []));
      }
    }
    return { ...record, ...patch, ...annotations, ...(changesAssetContent ? { updatedAt: new Date().toISOString() } : {}) };
  });

  const savedRecords = await storageSet(PROMPT_STORAGE_KEYS.favorites, nextRecords, existing);

  return savedRecords.find((record) => record.id === promptId) ?? null;
}

export async function createPromptFolder(name: string, scope: string, color = "blue") {
  const validatedColor = validateFolderColor(color);
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("文件夹名称不能为空。");
  }

  const existing = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);

  if (existing.some((folder) => folder.scope === scope && folder.name === trimmedName)) {
    throw new Error("同名文件夹已存在。");
  }

  const scopeFolders = existing;
  const nextOrder = scopeFolders.length === 0 ? 0 : Math.max(...scopeFolders.map((folder) => folder.order ?? 0)) + 1;
  const folder: PromptFolder = {
    color: validatedColor,
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    scope,
    createdAt: new Date().toISOString(),
    order: nextOrder
  };

  await storageSet(PROMPT_STORAGE_KEYS.folders, [...existing, folder], existing);
  return folder;
}

export async function updatePromptFolderColor(folderId: string, color: string) {
  const validatedColor = validateFolderColor(color);
  const existing = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  if (!existing.some((folder) => folder.id === folderId)) throw new Error("收藏夹已删除。");
  return storageSet(PROMPT_STORAGE_KEYS.folders, existing.map((folder) =>
    folder.id === folderId ? { ...folder, color: validatedColor } : folder
  ), existing);
}

export async function renamePromptFolder(folderId: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("文件夹名称不能为空。");
  }

  const existing = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);

  const currentFolder = existing.find((folder) => folder.id === folderId);
  const scope = currentFolder?.scope;

  if (!scope) {
    throw new Error("未找到要修改的文件夹。");
  }

  if (
    existing.some(
      (folder) => folder.id !== folderId && folder.scope === scope && folder.name === trimmedName
    )
  ) {
    throw new Error("同名文件夹已存在。");
  }

  const nextFolders = existing.map((folder) =>
    folder.id === folderId
      ? {
          ...folder,
          name: trimmedName
        }
      : folder
  );

  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const oldCategory = `${scope}/${currentFolder.name}`;
  await storageSet(PROMPT_STORAGE_KEYS.favorites, records.map((record) =>
    record.category === oldCategory ? { ...record, category: `${scope}/${trimmedName}` } : record
  ), records);
  const savedFolders = await storageSet(PROMPT_STORAGE_KEYS.folders, nextFolders, existing);
  return savedFolders.find((folder) => folder.id === folderId) ?? null;
}

export async function deletePromptFolder(folderId: string) {
  const existing = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const targetFolder = existing.find((folder) => folder.id === folderId);

  if (!targetFolder) {
    return false;
  }

  const nextFolders = existing.filter((folder) => folder.id !== folderId);

  const favorites = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const folderCategory = `${targetFolder.scope}/${targetFolder.name}`;
  const nextFavorites = favorites.map((record) =>
    ({ ...record,
      category: record.category === folderCategory ? targetFolder.scope : record.category,
      folderIds: record.folderIds?.filter((id) => id !== folderId)
    })
  );

  await storageSet(PROMPT_STORAGE_KEYS.folders, nextFolders, existing);
  await storageSet(PROMPT_STORAGE_KEYS.favorites, nextFavorites, favorites);
  return true;
}

export async function reorderPromptFolders(scope: string | null, orderedIds: string[]) {
  const existing = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  const nextFolders = existing.map((folder) => {
    if ((scope !== null && folder.scope !== scope) || !orderMap.has(folder.id)) {
      return folder;
    }

    return {
      ...folder,
      order: orderMap.get(folder.id) ?? folder.order
    };
  });

  const savedFolders = await storageSet(PROMPT_STORAGE_KEYS.folders, nextFolders, existing);
  return scope === null ? savedFolders : savedFolders.filter((folder) => folder.scope === scope);
}

export function searchPromptRecords(records: SavedPromptRecord[], searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return records;
  }

  return records.filter((record) => {
    const haystacks = [
      record.title,
      record.content,
      record.category,
      record.provider,
      record.model,
      ...record.tags
    ];

    return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

// Remove only the retired built-in records; user-owned records and occupied folders stay intact.
export async function removeRetiredSeedPrompts() {
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const remaining = records.filter((record) => !RETIRED_SEED_IDS.has(record.id));
  const folders = await storageGet<PromptFolder[]>(PROMPT_STORAGE_KEYS.folders, []);
  const remainingFolders = folders.filter((folder) =>
    !folder.id.startsWith("seed-default-") || remaining.some((record) =>
      record.category === `${folder.scope || "收藏"}/${folder.name}`
    )
  );
  if (remaining.length !== records.length) await storageSet(PROMPT_STORAGE_KEYS.favorites, remaining, records);
  if (remainingFolders.length !== folders.length) await storageSet(PROMPT_STORAGE_KEYS.folders, remainingFolders, folders);
}

export async function ensureDefaultPrompts() {
  const seededVersion = await storageGet(DEFAULT_PROMPTS_VERSION_KEY, 0);
  if (seededVersion >= DEFAULT_PROMPTS_VERSION) return [];

  const existing = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const existingIds = new Set(existing.map((record) => record.id));
  const existingTitles = new Set(existing.map((record) => record.title));
  const firstOrder = existing.reduce((max, record) => Math.max(max, record.order ?? -1), -1) + 1;
  const createdAt = "2026-10-12T00:00:00.000Z";
  const additions = DEFAULT_PROMPT_SEEDS
    .filter((seed) => !existingIds.has(seed.id) && !existingTitles.has(seed.title))
    .map<SavedPromptRecord>((seed, index) => ({
      id: seed.id,
      title: seed.title,
      createdAt,
      provider: "chatgpt",
      model: "",
      format: "cnPrompt",
      content: formatPromptGroup(seed.group),
      group: seed.group,
      category: "收藏",
      tags: [],
      order: firstOrder + index,
      isFavorite: false,
      source: "system-template",
      versions: [],
      usedCount: 0,
      linkedImages: [],
      exampleImageIds: [],
      imageStorageVersion: 2,
      version: "1.0",
      usageCount: 0,
      lastUsed: ""
    }));

  if (additions.length > 0) {
    await storageSet(PROMPT_STORAGE_KEYS.favorites, [...existing, ...additions], existing);
  }
  await storageSet(DEFAULT_PROMPTS_VERSION_KEY, DEFAULT_PROMPTS_VERSION);
  return additions;
}

/** 清理之前版本误创建的错误标签 */
const INVALID_LEGACY_TABS = ["收藏/产品精修", "收藏/品牌设计", "收藏/视频生成"];

export async function cleanupInvalidTabs() {
  const tabs = await getCustomTabs();
  const cleaned = tabs.filter((t) => !INVALID_LEGACY_TABS.includes(t));
  if (cleaned.length === tabs.length) return;

  await storageSet(CUSTOM_TABS_KEY, cleaned);

  const tabOrder = await storageGet<string[]>(TAB_ORDER_KEY, []);
  await storageSet(TAB_ORDER_KEY, tabOrder.filter((t) => !INVALID_LEGACY_TABS.includes(t)));

  const deletedTabs = await storageGet<string[]>(DELETED_TABS_KEY, []);
  await storageSet(DELETED_TABS_KEY, deletedTabs.filter((t) => !INVALID_LEGACY_TABS.includes(t)));
}

// --- 提示词排序 ---

async function reorderFavorites(scope: string, orderedIds: string[]) {
  const existing = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  const nextRecords = existing.map((record) => {
    if (record.category !== scope || !orderMap.has(record.id)) return record;
    return { ...record, order: orderMap.get(record.id) ?? record.order };
  });
  await storageSet(PROMPT_STORAGE_KEYS.favorites, nextRecords, existing);
  return nextRecords;
}

export async function moveFavoriteUp(recordId: string, scope: string) {
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const scopeRecords = records
    .filter((r) => r.category === scope)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = scopeRecords.findIndex((r) => r.id === recordId);
  if (idx <= 0) return records;
  const orderedIds = scopeRecords.map((r) => r.id);
  [orderedIds[idx - 1], orderedIds[idx]] = [orderedIds[idx], orderedIds[idx - 1]];
  return reorderFavorites(scope, orderedIds);
}

export async function moveFavoriteDown(recordId: string, scope: string) {
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const scopeRecords = records
    .filter((r) => r.category === scope)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = scopeRecords.findIndex((r) => r.id === recordId);
  if (idx < 0 || idx >= scopeRecords.length - 1) return records;
  const orderedIds = scopeRecords.map((r) => r.id);
  [orderedIds[idx], orderedIds[idx + 1]] = [orderedIds[idx + 1], orderedIds[idx]];
  return reorderFavorites(scope, orderedIds);
}

// --- 默认角色预设 ---

export const SEED_ROLE_PRESET = `{
  "# 角色": "全能AI绘画提示词创意专家",
  "## 简介": "你是一个专业的AI图像生成提示词（Prompt）大师。你擅长精准捕捉用户的简单需求，将其迅速转化为结构严谨、细节丰富、高质量的专业画面描述。无论是人物、风景、建筑、二次元、产品摄影还是抽象艺术，你都能游刃有余。",
  "## 工作流": [
    "1. 意图分析：理解用户输入的简单描述，提取核心关键词（主体、风格、情绪等）。",
    "2. 细节扩写：使用专业视觉语言，自动补充缺失的画面细节。",
    "3. 结构化组装：严格按照【提示词公式】将细节组装成流畅的描述。",
    "4. 多样输出：基于用户需求，提供2-3个不同视角或微调风格的提示词选项。"
  ],
  "## 提示词公式": "主体描述（外貌/动作/服饰） + 环境背景 + 光影氛围（如：丁达尔光/赛博朋克光/自然光） + 摄影/镜头语言（如：特写/广角/微距/电影质感） + 艺术风格（如：写实/插画/3D/水彩） + 画质与渲染参数（如：8k, masterpiece, best quality, unreal engine 5, highly detailed）",
  "## 限制条件": [
    "不要解释过程，拒绝回答与AI图像生成无关的内容",
    "直接输出最终的提示词结果，方便用户复制",
    "必须包含【中文画面解析】和【纯英文提示词】（因为主流AI绘画工具对英文识别更好）",
    "英文提示词之间统一用英文半角逗号 ',' 分隔",
    "避免在提示词中使用否定词（如不要xx、没有xx），只描述画面中应该存在的事物"
  ],
  "## 示例格式": {
    "说明": "当用户输入简单需求（如：帮我画一个赛博朋克风格的女孩），严格按照以下格式直接输出：",
    "输出模板": {
      "选项1：【侧重人物特写】": {
        "中文画面": "赛博朋克风格，特写镜头。一个年轻女孩的精致面部特写，霓虹灯光映照在她的脸上，眼睛里有机械发光的瞳孔，背景是模糊的未来城市夜景。电影级光影，极高画质。",
        "英文Prompt": "Cyberpunk style, close-up shot, delicate facial portrait of a young girl, glowing mechanical pupils, neon lights reflecting on her face, blurred futuristic city night background, cinematic lighting, masterpiece, 8k resolution, highly detailed, photorealistic."
      },
      "选项2：【侧重全身与环境】": {
        "中文画面": "赛博朋克风格，全身广角镜头。一个酷炫的女孩站在下雨的未来城市街道上，穿着高科技发光夹克，手中拿着一把发光的透明伞。地面积水反射着绚丽的霓虹灯，赛博朋克氛围，超高分辨率。",
        "英文Prompt": "Cyberpunk style, full body shot, wide angle, a cool girl standing on a rainy futuristic city street, wearing a high-tech glowing jacket, holding a glowing transparent umbrella, ground puddles reflecting brilliant neon lights, cyberpunk atmosphere, unreal engine 5 render, ray tracing, masterpiece, best quality."
      }
    }
  }
}`;

export async function ensureDefaultRolePreset() {
  const workspace = await storageGet<{ rolePreset: string; rolePresetLocked: boolean; userRequirement: string }>(
    PROMPT_STORAGE_KEYS.workspace,
    { rolePreset: "", rolePresetLocked: false, userRequirement: "" }
  );
  if (!workspace.rolePreset.trim()) {
    await storageSet(PROMPT_STORAGE_KEYS.workspace, {
      ...workspace,
      rolePreset: SEED_ROLE_PRESET
    });
  }
}

export async function pinFavoriteToTop(recordId: string, scope: string) {
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const scopeRecords = records
    .filter((r) => r.category === scope)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = scopeRecords.findIndex((r) => r.id === recordId);
  if (idx <= 0) return records;
  const orderedIds = scopeRecords.map((r) => r.id);
  const [moved] = orderedIds.splice(idx, 1);
  orderedIds.unshift(moved);
  return reorderFavorites(scope, orderedIds);
}
