import { saveCreationHistory, readCreationHistory, clearCreationHistory } from "./creation-history";
import { cancelImageGeneration, downloadImages, generateImagesWithProvider } from "./image-generator";
import { detectProviderModels } from "./model-discovery";
import { generatePromptFromProvider } from "./prompt-generator";
import { optimizePromptWithProvider } from "./prompt-generator";
import { testProviderConnection } from "./provider-health";
import { toUserFacingError } from "../lib/error-messages";
import {
  finishImageTask,
  finishPromptTask,
  markImageTaskGenerating,
  markPromptTaskGenerating,
  recoverInterruptedTasks
} from "../lib/task-broker";
import { ensureDefaultPrompts, removeRetiredSeedPrompts } from "../lib/prompt-library";
import { mergeStoredCollection } from "../lib/collection-storage";
import type { RuntimeRequestMessage } from "../types/runtime";
import {
  sessionStorageGet,
  sessionStorageSet,
  storageGet,
  storageSet,
  STORAGE_KEYS
} from "../lib/storage";
import { defaultExtensionSettings } from "../lib/provider-presets";
import type { ConnectionStatus } from "../types/settings";
import {
  cleanupOrphanExampleImages,
  deleteExampleImage,
  deletePromptExampleImages,
  fetchImageAsDataUrl,
  getExampleImage,
  getExampleImageUsage,
  putExampleImage
} from "./example-image-store";

console.log("[Prompt Butler] Service Worker 启动中...");

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "long-task") return;
  port.onMessage.addListener(() => {
    // 接收生成任务的心跳，让等待中的 Worker 保持活跃。
    // 生成请求仍由下方 onMessage 的受控消息入口处理。
  });
  port.onDisconnect.addListener(() => {
    // 工作台关闭或重新加载时，读取断开错误，避免 Chrome 记录 unchecked 错误。
    void chrome.runtime.lastError;
  });
});

// Content Script 只读取当前会话任务状态；持久示例图仍只经后台受控消息访问。
void chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

const WORKER_SESSION_ID = crypto.randomUUID();
void recoverInterruptedTasks(WORKER_SESSION_ID);

async function updateConnectionStatus(connectionStatus: ConnectionStatus) {
  const current = await storageGet(STORAGE_KEYS.extensionSettings, defaultExtensionSettings);
  await storageSet(STORAGE_KEYS.extensionSettings, {
    ...current,
    connectionStatus,
    lastValidatedAt: connectionStatus === "success" ? new Date().toISOString() : current.lastValidatedAt
  });
}

void removeRetiredSeedPrompts()
  .then(() => ensureDefaultPrompts())
  .catch((error) => console.warn("[Prompt Butler] 默认提示词初始化失败：", error));

const APP_WINDOW_PATH = "options.html?view=app";
const APP_WINDOW_SESSION_KEY = "prompt-butler-app-window-id";
const APP_WINDOW_BOUNDS_KEY = "prompt-butler-app-window-bounds";
const DEFAULT_APP_WINDOW_BOUNDS = { width: 500, height: 820 };

interface AppWindowBounds {
  left?: number;
  top?: number;
  width: number;
  height: number;
}

let appWindowId: number | null = null;

async function clearAppWindowId() {
  appWindowId = null;
  await sessionStorageSet<number | null>(APP_WINDOW_SESSION_KEY, null);
}

async function getExistingAppWindow() {
  const storedWindowId = appWindowId ?? await sessionStorageGet<number | null>(APP_WINDOW_SESSION_KEY, null);
  if (storedWindowId === null) return null;

  try {
    const appWindow = await chrome.windows.get(storedWindowId);
    appWindowId = storedWindowId;
    return appWindow;
  } catch {
    await clearAppWindowId();
    return null;
  }
}

async function openOrFocusAppWindow(tutorialChapter?: number) {
  const url = tutorialChapter === undefined ? APP_WINDOW_PATH : `${APP_WINDOW_PATH}&tutorialChapter=${tutorialChapter}`;
  const existingWindow = await getExistingAppWindow();
  if (existingWindow?.id !== undefined) {
    if (tutorialChapter !== undefined) {
      const tabs = await chrome.tabs.query({ windowId: existingWindow.id });
      if (tabs[0]?.id !== undefined) await chrome.tabs.update(tabs[0].id, { url: chrome.runtime.getURL(url) });
    }
    if (existingWindow.state === "minimized") {
      await chrome.windows.update(existingWindow.id, { state: "normal" });
    }
    await chrome.windows.update(existingWindow.id, { focused: true });
    return;
  }

  const storedBounds = await storageGet<AppWindowBounds>(
    APP_WINDOW_BOUNDS_KEY,
    DEFAULT_APP_WINDOW_BOUNDS
  );
  const createdWindow = await chrome.windows.create({
    url,
    type: "popup",
    focused: true,
    width: storedBounds.width,
    height: storedBounds.height,
    ...(Number.isFinite(storedBounds.left) ? { left: storedBounds.left } : {}),
    ...(Number.isFinite(storedBounds.top) ? { top: storedBounds.top } : {})
  });

  if (createdWindow?.id !== undefined) {
    appWindowId = createdWindow.id;
    await sessionStorageSet(APP_WINDOW_SESSION_KEY, createdWindow.id);
  }
}

let pendingAppWindowBounds: AppWindowBounds | null = null;
let appWindowBoundsTimer: ReturnType<typeof setTimeout> | undefined;

function flushAppWindowBounds() {
  if (appWindowBoundsTimer !== undefined) clearTimeout(appWindowBoundsTimer);
  appWindowBoundsTimer = undefined;
  const bounds = pendingAppWindowBounds;
  pendingAppWindowBounds = null;
  if (bounds) void storageSet<AppWindowBounds>(APP_WINDOW_BOUNDS_KEY, bounds)
    .catch((error) => console.warn("[Prompt Butler] 窗口位置保存失败：", error));
}

chrome.windows.onBoundsChanged.addListener((window) => {
  void (async () => {
    const knownWindowId = appWindowId ?? await sessionStorageGet<number | null>(APP_WINDOW_SESSION_KEY, null);
    if (window.id !== knownWindowId || window.state !== "normal") return;
    if (
      window.width === undefined ||
      window.height === undefined ||
      window.left === undefined ||
      window.top === undefined
    ) {
      return;
    }
    pendingAppWindowBounds = {
      left: window.left,
      top: window.top,
      width: window.width,
      height: window.height
    };
    if (appWindowBoundsTimer !== undefined) clearTimeout(appWindowBoundsTimer);
    appWindowBoundsTimer = setTimeout(flushAppWindowBounds, 300);
  })();
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === appWindowId) {
    flushAppWindowBounds();
    void clearAppWindowId();
  }
});

chrome.action.onClicked.addListener(() => {
  void openOrFocusAppWindow().catch((error) => {
    console.error("[Prompt Butler] 无法打开独立工作台窗口：", error);
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeRequestMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === "tutorial:open-main") {
        if (!Number.isInteger(message.chapter) || message.chapter < 0 || message.chapter > 4) throw new Error("无效的教程章节");
        await openOrFocusAppWindow(message.chapter);
        sendResponse({ ok: true });
        return;
      }
      if (message.type === "storage:merge-collection") {
        sendResponse({ ok: true, records: await mergeStoredCollection(message.payload) });
        return;
      }
      if (message.type === "provider:test-connection") {
        const result = await testProviderConnection(message.payload.settings);
        sendResponse(result);
        return;
      }

      if (message.type === "provider:detect-models") {
        const result = await detectProviderModels(message.payload.settings);
        sendResponse(result);
        return;
      }

      if (message.type === "prompt:generate") {
        await updateConnectionStatus("testing");
        await markPromptTaskGenerating(WORKER_SESSION_ID);
        const result = await generatePromptFromProvider(
          message.payload.settings,
          message.payload.input
        );
        await finishPromptTask(result);
        await updateConnectionStatus(result.ok ? "success" : "error");
        sendResponse(result);
        return;
      }

      if (message.type === "prompt:optimize") {
        const result = await optimizePromptWithProvider(
          message.payload.settings,
          message.payload.content,
          message.payload.direction
        );
        sendResponse(result);
        return;
      }

      if (message.type === "image-history:read") {
        sendResponse({ ok: true, entries: await readCreationHistory() });
        return;
      }
      if (message.type === "image-history:clear") {
        await clearCreationHistory();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "image:generate") {
        await updateConnectionStatus("testing");
        await markImageTaskGenerating(WORKER_SESSION_ID);
        const rawResult = await generateImagesWithProvider(
          message.payload.settings,
          message.payload.input
        );
        const result = rawResult.ok
          ? rawResult
          : {
              ...rawResult,
              message: toUserFacingError(rawResult.message).message,
              technicalDetails: rawResult.message
            };
        let historySaveError: string | undefined;
        if (result.ok) {
          try {
            const snapshots = await saveCreationHistory(result.images.map(image => ({
              id: image.id, url: image.url, prompt: message.payload.input.prompt,
              model: result.model, provider: result.provider,
              resolution: message.payload.input.resolution, aspectRatio: message.payload.input.aspectRatio,
              count: message.payload.input.count, generatedAt: result.generatedAt,
              revisedPrompt: image.revisedPrompt, promptId: message.payload.source?.promptId,
              promptTitle: message.payload.source?.title, promptSource: message.payload.source
            })));
            await downloadImages(snapshots.map(entry => entry.url), "创作历史");
          } catch { historySaveError = "图片已生成，但自动保存未完成，请先下载保存作品。"; }
        }
        await finishImageTask(result);
        await updateConnectionStatus(result.ok ? "success" : "error");
        sendResponse({ ...result, historySaveError });
        return;
      }

      if (message.type === "image:cancel") {
        cancelImageGeneration();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "image:download") {
        const result = await downloadImages(message.payload.urls);
        sendResponse(result);
        return;
      }

      if (message.type === "open-options-page") {
        await chrome.tabs.create({ url: chrome.runtime.getURL(message.tutorial ? "options.html?tutorial=settings" : "options.html") });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "example-image:prepare") {
        sendResponse({ ok: true, dataUrl: await fetchImageAsDataUrl(message.payload.url) });
        return;
      }

      if (message.type === "example-image:put") {
        sendResponse({ ok: true, ...(await putExampleImage(message.payload)) });
        return;
      }

      if (message.type === "example-image:get") {
        sendResponse({ ok: true, image: await getExampleImage(message.payload.imageId) });
        return;
      }

      if (message.type === "example-image:delete") {
        await deleteExampleImage(message.payload.imageId);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "example-image:delete-prompt") {
        sendResponse({ ok: true, deleted: await deletePromptExampleImages(message.payload.promptId) });
        return;
      }

      if (message.type === "example-image:usage") {
        sendResponse({ ok: true, usage: await getExampleImageUsage() });
        return;
      }

      if (message.type === "example-image:cleanup") {
        sendResponse({ ok: true, deleted: await cleanupOrphanExampleImages(message.payload.validPromptIds) });
        return;
      }

      sendResponse(null);
    } catch (error) {
      console.error("[Prompt Butler] 消息处理异常：", error);
      const errorMessage = error instanceof Error ? error.message : "后台处理异常。";
      if (message.type === "prompt:generate") {
        const result = {
          ok: false as const,
          provider: message.payload.settings.provider,
          model: message.payload.settings.reasoningModel,
          generatedAt: new Date().toISOString(),
          message: toUserFacingError(errorMessage).message
        };
        await finishPromptTask(result);
        await updateConnectionStatus(result.ok ? "success" : "error");
        sendResponse(result);
        return;
      }
      if (message.type === "image:generate") {
        const friendlyError = toUserFacingError(errorMessage);
        const result = {
          ok: false as const,
          provider: message.payload.settings.provider,
          model: message.payload.settings.imageModel,
          generatedAt: new Date().toISOString(),
          message: friendlyError.message,
          technicalDetails: errorMessage
        };
        await finishImageTask(result);
        await updateConnectionStatus(result.ok ? "success" : "error");
        sendResponse(result);
        return;
      }
      sendResponse({
        ok: false,
        message: errorMessage
      });
    }
  })();

  return true;
});
