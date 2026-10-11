import { sendRuntimeMessage } from "./runtime";
import { PROMPT_STORAGE_KEYS, updateFavoritePrompt } from "./prompt-library";
import { storageGet, storageSet } from "./storage";
import type { ExampleImagePayload, ExampleImageRecord, ExampleImageSource, ExampleImageUsage } from "../types/image";
import type { PromptLinkedImage, SavedPromptRecord } from "../types/prompt";

export const MAX_EXAMPLE_IMAGES = 3;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const TARGET_BYTES = 600 * 1024;
const MAX_EDGE = 1280;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface RuntimeOk { ok: true }
interface RuntimeFailure { ok: false; message: string }

function ensureOk<T extends RuntimeOk>(response: T | RuntimeFailure): T {
  if (!response.ok) throw new Error(response.message);
  return response;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取图片文件。"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法解码，请重新选择有效文件。"));
    image.src = dataUrl;
  });
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("浏览器无法压缩此图片。")), "image/webp", quality);
  });
}

export async function optimizeExampleImage(input: File | string) {
  let dataUrl: string;
  if (input instanceof File) {
    if (!SUPPORTED_TYPES.has(input.type)) throw new Error("仅支持 JPG、JPEG、PNG 和 WebP 图片，不支持 GIF。 ");
    if (input.size > MAX_INPUT_BYTES) throw new Error("图片超过 20MB，请先缩小后再上传。");
    dataUrl = await readBlobAsDataUrl(input);
  } else if (input.startsWith("data:image/")) {
    dataUrl = input;
  } else if (/^https?:\/\//i.test(input)) {
    const response = ensureOk(await sendRuntimeMessage<{ ok: true; dataUrl: string } | RuntimeFailure>({
      type: "example-image:prepare", payload: { url: input }
    }));
    dataUrl = response.dataUrl;
  } else {
    throw new Error("临时图片地址已经失效，无法保存为示例图。");
  }

  const image = await loadImage(dataUrl);
  let scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  let blob: Blob | null = null;

  for (let pass = 0; pass < 6; pass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前页面无法处理图片画布。");
    context.drawImage(image, 0, 0, width, height);
    blob = await canvasToWebp(canvas, Math.max(0.55, 0.8 - pass * 0.05));
    if (blob.size <= TARGET_BYTES) break;
    width = Math.max(1, Math.round(width * 0.86));
    height = Math.max(1, Math.round(height * 0.86));
  }
  if (!blob || blob.size > TARGET_BYTES) throw new Error("图片压缩后仍超过 600KB，请选择更小的图片。");
  return { dataUrl: await readBlobAsDataUrl(blob), width, height, byteSize: blob.size };
}

export async function saveExampleImage(input: {
  promptId: string; source: ExampleImageSource; image: File | string; sortOrder: number; replaceImageId?: string;
}) {
  const optimized = await optimizeExampleImage(input.image);
  return ensureOk(await sendRuntimeMessage<{ ok: true; image: ExampleImageRecord; duplicate: boolean } | RuntimeFailure>({
    type: "example-image:put",
    payload: { promptId: input.promptId, source: input.source, sortOrder: input.sortOrder, replaceImageId: input.replaceImageId, ...optimized }
  }));
}

export async function getExampleImagePayload(imageId: string) {
  return ensureOk(await sendRuntimeMessage<{ ok: true; image: ExampleImagePayload | null } | RuntimeFailure>({
    type: "example-image:get", payload: { imageId }
  })).image;
}

export async function deleteExampleImageAsset(imageId: string) {
  return ensureOk(await sendRuntimeMessage<RuntimeOk | RuntimeFailure>({ type: "example-image:delete", payload: { imageId } }));
}

export async function deletePromptExampleImages(promptId: string) {
  return ensureOk(await sendRuntimeMessage<{ ok: true; deleted: number } | RuntimeFailure>({ type: "example-image:delete-prompt", payload: { promptId } }));
}

export async function getExampleImageUsage() {
  return ensureOk(await sendRuntimeMessage<{ ok: true; usage: ExampleImageUsage } | RuntimeFailure>({ type: "example-image:usage" })).usage;
}

export async function cleanupExampleImages(validPromptIds: string[]) {
  return ensureOk(await sendRuntimeMessage<{ ok: true; deleted: number } | RuntimeFailure>({ type: "example-image:cleanup", payload: { validPromptIds } }));
}

export function dataUrlToObjectUrl(dataUrl: string) {
  const [header, base64] = dataUrl.split(",", 2);
  const mimeType = /^data:([^;]+);base64$/i.exec(header)?.[1] ?? "image/webp";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function isLinkedImage(value: PromptLinkedImage | string): value is PromptLinkedImage {
  return typeof value !== "string";
}

let migrationPromise: Promise<boolean> | null = null;

export function migrateLegacyPromptImages() {
  migrationPromise ??= runLegacyPromptImageMigration();
  return migrationPromise;
}

async function runLegacyPromptImageMigration() {
  await Promise.all([
    storageSet("prompt-butler-image-history", []),
    storageSet("prompt-butler-image-task", null)
  ]);
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  let changed = false;
  const migrated: SavedPromptRecord[] = [];
  for (const record of records) {
    if (record.imageStorageVersion === 2 && !record.linkedImages?.length) { migrated.push(record); continue; }
    const ids = [...(record.exampleImageIds ?? [])].slice(0, MAX_EXAMPLE_IMAGES);
    for (const legacy of (record.linkedImages ?? []).filter(isLinkedImage)) {
      if (ids.length >= MAX_EXAMPLE_IMAGES) break;
      if (!legacy.imageUrl.startsWith("data:image/")) continue;
      try {
        const result = await saveExampleImage({ promptId: record.id, image: legacy.imageUrl, source: "generated", sortOrder: ids.length });
        if (!ids.includes(result.image.id)) ids.push(result.image.id);
      } catch {
        // 迁移失败不阻止 Prompt 正文加载；用户可在详情页重新上传。
      }
    }
    migrated.push({ ...record, linkedImages: [], exampleImageIds: ids, imageStorageVersion: 2 });
    changed = true;
  }
  if (changed) await storageSet(PROMPT_STORAGE_KEYS.favorites, migrated, records);
  return changed;
}

export async function bindExampleImage(promptId: string, imageId: string, replaceIndex?: number) {
  const records = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const record = records.find((item) => item.id === promptId);
  if (!record) throw new Error("请先保存 Prompt，再将图片设为示例图。");
  const ids = [...(record.exampleImageIds ?? [])];
  if (ids.includes(imageId)) return record;
  if (replaceIndex !== undefined) {
    const oldId = ids[replaceIndex];
    ids[replaceIndex] = imageId;
    if (oldId) await deleteExampleImageAsset(oldId);
  } else {
    if (ids.length >= MAX_EXAMPLE_IMAGES) throw new Error("请选择要替换的示例图。");
    ids.push(imageId);
  }
  return updateFavoritePrompt(promptId, { exampleImageIds: ids, imageStorageVersion: 2, linkedImages: [] });
}
