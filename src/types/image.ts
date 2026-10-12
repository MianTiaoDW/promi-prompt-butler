import type { PromptOutputFormat, PromptSource } from "./prompt";
import type { ImageAspectRatio, ProviderId } from "./settings";

export interface ImageGenerationInput {
  prompt: string;
  count: number;
  resolution: "2K" | "4K";
  aspectRatio: ImageAspectRatio;
}

export interface GeneratedImageAsset {
  id: string;
  url: string;
  mimeType: string;
  revisedPrompt?: string;
}

export type ExampleImageSource = "upload" | "generated";

export interface ExampleImageRecord {
  id: string;
  promptId: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  source: ExampleImageSource;
  createdAt: number;
  sortOrder: number;
  contentHash: string;
}

export interface ExampleImagePayload extends ExampleImageRecord {
  dataUrl: string;
}

export interface ExampleImageUsage {
  usedBytes: number;
  limitBytes: number;
  imageCount: number;
}

export interface ImageGenerationSuccess {
  historySaveError?: string;
  ok: true;
  provider: ProviderId;
  model: string;
  generatedAt: string;
  images: GeneratedImageAsset[];
}

export interface ImageGenerationFailure {
  ok: false;
  provider: ProviderId;
  model: string;
  generatedAt: string;
  message: string;
  technicalDetails?: string;
}

export type ImageGenerationResult =
  | ImageGenerationSuccess
  | ImageGenerationFailure;

export interface ImageWorkspaceState {
  prompt: string;
  lastUpdatedAt: string | null;
  source?: {
    promptId?: string;
    title: string;
    type: PromptSource | "temporary";
    format: PromptOutputFormat;
    provider?: ProviderId;
    model?: string;
  };
}

export interface ImageHistoryEntry {
  id: string;
  url: string;
  prompt: string;
  model: string;
  provider: string;
  resolution: string;
  aspectRatio: string;
  count: number;
  generatedAt: string;
  revisedPrompt?: string;
  promptId?: string;
  promptTitle?: string;
  promptSource?: ImageWorkspaceState["source"];
}
