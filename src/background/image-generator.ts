import { fetchImageAsDataUrl } from "./example-image-store";
import type { GeneratedImageAsset, ImageGenerationInput, ImageGenerationResult } from "../types/image";
import type { ExtensionSettings } from "../types/settings";
import { getImageConnectionSettings } from "../lib/provider-presets";

let currentGenerationAbort: AbortController | null = null;

export function cancelImageGeneration() {
  if (currentGenerationAbort) {
    currentGenerationAbort.abort();
    currentGenerationAbort = null;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function usesXingheGptImage2Payload(endpoint: string, model: string) {
  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    const isXinghe = hostname === "xinghe.xin" || hostname.endsWith(".xinghe.xin");
    return isXinghe && /^gpt-image-2(?:-all)?$/i.test(model.trim());
  } catch {
    return false;
  }
}

// 智创聚合API（GPT-Image）仅支持以下尺寸
// gpt-image-2: 1024x1024, 1536x1024, 1024x1536
// gpt-image-2-pro: 额外支持 2048x2048, 2048x1152, 3840x2160, 2160x3840
const SIZE_LOOKUP: Record<string, { "2K": string; "4K": string }> = {
  "1:1":  { "2K": "1024x1024",  "4K": "2048x2048" },
  "4:3":  { "2K": "1536x1024",  "4K": "3840x2160" },
  "3:4":  { "2K": "1024x1536",  "4K": "2160x3840" },
  "16:9": { "2K": "1536x1024",  "4K": "3840x2160" },
  "9:16": { "2K": "1024x1536",  "4K": "2160x3840" },
  "3:1":  { "2K": "1536x1024",  "4K": "3840x2160" },
  "1:3":  { "2K": "1024x1536",  "4K": "2160x3840" },
  "8:1":  { "2K": "1536x1024",  "4K": "3840x2160" },
  "1:8":  { "2K": "1024x1536",  "4K": "2160x3840" },
  "21:1": { "2K": "1536x1024",  "4K": "3840x2160" },
  "1:21": { "2K": "1024x1536",  "4K": "2160x3840" },
};

function mapSize(aspectRatio: string, resolution: "2K" | "4K"): string {
  return SIZE_LOOKUP[aspectRatio]?.[resolution] ?? (resolution === "4K" ? "2048x2048" : "1024x1024");
}

function isHtmlBody(text: string) {
  const lower = text.trim().toLowerCase();
  return lower.startsWith("<!doctype") || lower.startsWith("<html") || lower.startsWith("<head") || lower.startsWith("<body");
}

async function parseErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (isHtmlBody(text)) {
      return `接口返回了网页页面（HTTP ${response.status}），请检查 Base URL 和模型配置是否正确。`;
    }
    const preview = text.slice(0, 300).trim();
    if (preview) {
      return `接口返回了非 JSON 响应（HTTP ${response.status}）：${preview}${text.length > 300 ? "..." : ""}`;
    }
    return `接口返回了非 JSON 响应（HTTP ${response.status}），可能是 Base URL 指向了非 API 地址或端点路径不正确。`;
  }

  try {
    const data = (await response.json()) as Record<string, unknown>;
    const directMessage =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : null;

    if (directMessage) {
      return directMessage;
    }

    if (data.error && typeof data.error === "object" && data.error !== null) {
      const nestedMessage = (data.error as Record<string, unknown>).message;

      if (typeof nestedMessage === "string") {
        return nestedMessage;
      }
    }
  } catch {
    return response.statusText || "生图请求失败。";
  }

  return response.statusText || "生图请求失败。";
}

function normalizeImageAssets(
  responseData: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>,
  mimeType = "image/png"
) {
  const assets: GeneratedImageAsset[] = [];

  responseData.forEach((item, index) => {
    if (item.url) {
      assets.push({
        id: `image-${Date.now()}-${index}`,
        url: item.url,
        mimeType,
        revisedPrompt: item.revised_prompt
      });
      return;
    }

    if (item.b64_json) {
      assets.push({
        id: `image-${Date.now()}-${index}`,
        url: `data:${mimeType};base64,${item.b64_json}`,
        mimeType,
        revisedPrompt: item.revised_prompt
      });
    }
  });

  return assets;
}

function resolveImageEndpoints(baseUrl: string): string[] {
  const trimmed = trimTrailingSlash(baseUrl.trim());
  const paths: string[] = [];

  if (/\/v\d+(beta)?$/.test(trimmed)) {
    paths.push(`${trimmed}/images/generations`);
  } else if (/\/v\d+$/.test(trimmed)) {
    paths.push(`${trimmed}/images/generations`);
    paths.push(`${trimmed.replace(/\/v\d+$/, "")}/v1/images/generations`);
  } else {
    paths.push(`${trimmed}/v1/images/generations`);
    paths.push(`${trimmed}/images/generations`);
  }

  return [...new Set(paths)];
}

async function fetchImageOnce(
  url: string,
  options: RequestInit & { cancelSignal?: AbortSignal }
): Promise<Response> {
  if (options.cancelSignal?.aborted) {
    throw new DOMException("已取消生图请求。", "AbortError");
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 300000);
  const onExternalAbort = () => timeoutController.abort();
  const { cancelSignal, ...requestOptions } = options;
  cancelSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    return await fetch(url, {
      ...requestOptions,
      signal: timeoutController.signal
    });
  } finally {
    clearTimeout(timeoutId);
    cancelSignal?.removeEventListener("abort", onExternalAbort);
  }
}

class ImageEndpointError extends Error {
  constructor(message: string, readonly canTryAlternateEndpoint: boolean) {
    super(message);
    this.name = "ImageEndpointError";
  }
}

async function requestSingleImage(
  settings: ExtensionSettings,
  input: ImageGenerationInput,
  endpoint: string
): Promise<GeneratedImageAsset[]> {
  const imageConnection = getImageConnectionSettings(settings);
  const useXinghePayload = usesXingheGptImage2Payload(endpoint, settings.imageModel);
  // 每次请求创建新的 AbortController（如果还没有外部取消的）
  if (!currentGenerationAbort || currentGenerationAbort.signal.aborted) {
    currentGenerationAbort = new AbortController();
  }

  try {
    const response = await fetchImageOnce(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${imageConnection.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.imageModel,
        prompt: input.prompt,
        n: 1,
        size: mapSize(input.aspectRatio, input.resolution),
        ...(useXinghePayload
          ? { quality: "low", format: "jpeg" }
          : { response_format: "url" })
      }),
      cancelSignal: currentGenerationAbort.signal
    });

    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response);
      throw new ImageEndpointError(
        `HTTP ${response.status}：${errorMessage}`,
        response.status === 404 || response.status === 405
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(await parseErrorMessage(response));
    }

    const data = (await response.json()) as {
      data?: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    };

    const images = normalizeImageAssets(data.data ?? [], useXinghePayload ? "image/jpeg" : "image/png");
    if (images.length === 0) {
      throw new Error("接口返回成功但未包含图片数据。");
    }

    return images;
  } catch (error) {
    const message = error instanceof Error ? error.message : "生图失败。";
    const isAbort =
      message.includes("abort") ||
      message.includes("AbortError") ||
      (error instanceof DOMException && error.name === "AbortError");
    if (isAbort) {
      throw new Error("生图请求超时（300 秒），请检查网络或换一个更轻量的模型重试。");
    }
    throw error;
  }
}

async function generateWithOpenAiCompatible(
  settings: ExtensionSettings,
  input: ImageGenerationInput
) {
  const imageConnection = getImageConnectionSettings(settings);
  const endpoints = resolveImageEndpoints(imageConnection.baseUrl);

  let workingEndpoint = "";
  let probeImages: GeneratedImageAsset[] = [];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const images = await requestSingleImage(settings, input, endpoint);
      workingEndpoint = endpoint;
      probeImages = images;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("生图请求失败。");
      if (!(error instanceof ImageEndpointError && error.canTryAlternateEndpoint)) {
        break;
      }
    }
  }

  if (!workingEndpoint) {
    throw lastError ?? new Error("无法连接到生图接口，请检查 Base URL 和模型配置。");
  }

  if (input.count <= 1) {
    return { model: settings.imageModel, images: probeImages };
  }

  const remaining = input.count - 1;
  const results = await Promise.allSettled(
    Array.from({ length: remaining }, () =>
      requestSingleImage(settings, input, workingEndpoint)
    )
  );

  const allImages = [...probeImages];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allImages.push(...result.value);
    }
  }

  if (allImages.length === 0) {
    throw new Error("所有并行生图请求均失败。");
  }

  return { model: settings.imageModel, images: allImages };
}

export async function generateImagesWithProvider(
  settings: ExtensionSettings,
  input: ImageGenerationInput
): Promise<ImageGenerationResult> {
  const generatedAt = new Date().toISOString();
  const imageConnection = getImageConnectionSettings(settings);
  const hasDedicatedImageConnection = Boolean(
    settings.imageApiKey?.trim() || settings.imageBaseUrl?.trim()
  );

  if (!imageConnection.apiKey) {
    return {
      ok: false,
      provider: settings.provider,
      model: settings.imageModel,
      generatedAt,
      message: "未配置生图 API Key，请前往设置页补充。"
    };
  }

  if (!imageConnection.baseUrl) {
    return {
      ok: false,
      provider: settings.provider,
      model: settings.imageModel,
      generatedAt,
      message: "未配置生图 Base URL，请前往设置页补充。"
    };
  }

  if (!settings.imageModel.trim()) {
    return {
      ok: false,
      provider: settings.provider,
      model: settings.imageModel,
      generatedAt,
      message: "当前服务商还没有配置可用的生图模型。"
    };
  }

  if (!hasDedicatedImageConnection && (settings.provider === "claude" || settings.provider === "kimi" || settings.provider === "deepseek")) {
    return {
      ok: false,
      provider: settings.provider,
      model: settings.imageModel,
      generatedAt,
      message: "当前服务商在这版插件里还未接入稳定的官方生图端点。"
    };
  }

  try {
    currentGenerationAbort = new AbortController();
    const { model, images } = await generateWithOpenAiCompatible(settings, input);
    currentGenerationAbort = null;

    if (images.length === 0) {
      return {
        ok: false,
        provider: settings.provider,
        model,
        generatedAt,
        message: "接口已返回，但没有拿到可展示的图片结果。"
      };
    }

    return {
      ok: true,
      provider: settings.provider,
      model,
      generatedAt,
      images
    };
  } catch (error) {
    currentGenerationAbort = null;
    return {
      ok: false,
      provider: settings.provider,
      model: settings.imageModel,
      generatedAt,
      message: error instanceof Error ? error.message : "生图失败。"
    };
  }
}

export async function downloadImages(urls: string[], folder: "下载图片" | "创作历史" = "下载图片") {
  const downloadResults: number[] = [];

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index].startsWith("data:") ? urls[index] : await fetchImageAsDataUrl(urls[index]);
    const mime = /^data:image\/([^;,]+)/i.exec(url)?.[1];
    const extension = mime === "jpeg" ? "jpg" : mime === "webp" ? "webp" : "png";
    const downloadId = await chrome.downloads.download({
      url,
      filename: `prompt-butler/${folder}/generated-${Date.now()}-${index + 1}.${extension}`,
      conflictAction: "uniquify",
      saveAs: false
    });

    if (typeof downloadId === "number") {
      await waitForDownload(downloadId);
      downloadResults.push(downloadId);
    }
  }

  return downloadResults;
}

function waitForDownload(id: number) {
  return new Promise<void>((resolve, reject) => {
    const finish = (state?: string, error?: string) => {
      if (state !== "complete" && state !== "interrupted") return;
      chrome.downloads.onChanged.removeListener(listener);
      if (state === "complete") resolve();
      else reject(new Error(`图片保存失败：${error ?? "下载被中断"}`));
    };
    const listener = (change: chrome.downloads.DownloadDelta) => {
      if (change.id === id) finish(change.state?.current, change.error?.current);
    };
    chrome.downloads.onChanged.addListener(listener);
    void chrome.downloads.search({ id }).then(items => finish(items[0]?.state, items[0]?.error)).catch(error => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(error);
    });
  });
}
