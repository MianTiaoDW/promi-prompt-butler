import type { ExtensionSettings, ModelCatalog, ProviderId } from "./settings";
import type {
  PromptGenerationInput,
  PromptGenerationResult,
  PromptOptimizationResult
} from "./prompt";
import type { ExampleImageSource, ImageGenerationInput, ImageGenerationResult } from "./image";

export interface ConnectionTestSuccess {
  ok: true;
  provider: ProviderId;
  checkedUrl: string;
  checkedAt: string;
  status: number;
  message: string;
}

export interface ConnectionTestFailure {
  ok: false;
  provider: ProviderId;
  checkedUrl: string;
  checkedAt: string;
  status: number;
  message: string;
}

export type ConnectionTestResult = ConnectionTestSuccess | ConnectionTestFailure;

export interface ModelDetectionSuccess {
  ok: true;
  provider: ProviderId;
  checkedAt: string;
  checkedUrl: string;
  catalog: ModelCatalog;
  message: string;
}

export interface ModelDetectionFailure {
  ok: false;
  provider: ProviderId;
  checkedAt: string;
  checkedUrl: string;
  catalog: null;
  message: string;
}

export type ModelDetectionResult = ModelDetectionSuccess | ModelDetectionFailure;

export interface TestProviderConnectionMessage {
  type: "provider:test-connection";
  payload: {
    settings: ExtensionSettings;
  };
}

export interface GeneratePromptMessage {
  type: "prompt:generate";
  payload: {
    settings: ExtensionSettings;
    input: PromptGenerationInput;
  };
}

export interface OptimizePromptMessage {
  type: "prompt:optimize";
  payload: {
    settings: ExtensionSettings;
    content: string;
    direction?: string;
  };
}

export interface GenerateImagesMessage {
  type: "image:generate";
  payload: {
    settings: ExtensionSettings;
    input: ImageGenerationInput;
    source?: import("./image").ImageWorkspaceState["source"];
  };
}

export interface DownloadImagesMessage {
  type: "image:download";
  payload: {
    urls: string[];
  };
}

export interface DetectProviderModelsMessage {
  type: "provider:detect-models";
  payload: {
    settings: ExtensionSettings;
  };
}

export interface OpenOptionsPageMessage {
  type: "open-options-page";
  tutorial?: boolean;
}

export interface CancelImageGenerationMessage {
  type: "image:cancel";
}

export interface PrepareExampleImageMessage {
  type: "example-image:prepare";
  payload: { url: string };
}

export interface PutExampleImageMessage {
  type: "example-image:put";
  payload: {
    promptId: string;
    dataUrl: string;
    width: number;
    height: number;
    source: ExampleImageSource;
    sortOrder: number;
    replaceImageId?: string;
  };
}

export interface GetExampleImageMessage {
  type: "example-image:get";
  payload: { imageId: string };
}

export interface DeleteExampleImageMessage {
  type: "example-image:delete";
  payload: { imageId: string };
}

export interface DeletePromptExampleImagesMessage {
  type: "example-image:delete-prompt";
  payload: { promptId: string };
}

export interface ExampleImageUsageMessage {
  type: "example-image:usage";
}

export interface CleanupExampleImagesMessage {
  type: "example-image:cleanup";
  payload: { validPromptIds: string[] };
}

export type RuntimeRequestMessage =
  | { type: "image-history:read" }
  | { type: "image-history:clear" }
  | { type: "storage:merge-collection"; payload: import("../lib/collection-storage").CollectionChange }
  | TestProviderConnectionMessage
  | DetectProviderModelsMessage
  | GeneratePromptMessage
  | OptimizePromptMessage
  | GenerateImagesMessage
  | DownloadImagesMessage
  | OpenOptionsPageMessage
  | CancelImageGenerationMessage
  | PrepareExampleImageMessage
  | PutExampleImageMessage
  | GetExampleImageMessage
  | DeleteExampleImageMessage
  | DeletePromptExampleImagesMessage
  | ExampleImageUsageMessage
  | CleanupExampleImagesMessage;

export type RuntimeResponseMessage =
  | ConnectionTestResult
  | ModelDetectionResult
  | PromptGenerationResult
  | PromptOptimizationResult
  | ImageGenerationResult
  | number[]
  | { ok: true };
