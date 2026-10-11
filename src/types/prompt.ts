import type { ProviderId } from "./settings";

export interface ReferenceImage {
  dataUrl: string;
  name: string;
}

export type PromptSkillId = "standard" | "cinematic-image";

export interface PromptGenerationInput {
  rolePreset: string;
  userRequirement: string;
  skillId?: PromptSkillId;
  referenceImages?: ReferenceImage[];
}

export interface StructuredPromptPayload {
  characterCore: {
    identity: string;
    appearance: string;
    personality: string;
  };
  sceneDesign: {
    environment: string;
    lighting: string;
    camera: string;
    action: string;
  };
  styleDirectives: string[];
  negativePrompt: string[];
  usageNotes: string[];
}

export interface PromptGenerationOutput {
  cnPrompt: string;
  enPrompt: string;
  structuredPrompt: StructuredPromptPayload;
}

export interface PromptGenerationSuccess {
  ok: true;
  provider: ProviderId;
  model: string;
  generatedAt: string;
  output: PromptGenerationOutput;
}

export interface PromptGenerationFailure {
  ok: false;
  provider: ProviderId;
  model: string;
  generatedAt: string;
  message: string;
}

export type PromptGenerationResult = PromptGenerationSuccess | PromptGenerationFailure;

export interface PromptOptimizationSuccess {
  ok: true;
  provider: ProviderId;
  model: string;
  optimizedAt: string;
  output: string;
}

export interface PromptOptimizationFailure {
  ok: false;
  provider: ProviderId;
  model: string;
  optimizedAt: string;
  message: string;
}

export type PromptOptimizationResult =
  | PromptOptimizationSuccess
  | PromptOptimizationFailure;

export type PromptOutputFormat = "cnPrompt" | "enPrompt" | "structuredPrompt";

export type PromptSource = "creator" | "ai-generated" | "user-created" | "system-template";

export interface PromptVersion {
  id: string;
  version?: string;
  content: string;
  createdAt: string;
  note?: string;
}

export interface PromptLinkedImage {
  imageId?: string;
  imageUrl: string;
  model: string;
  ratio: string;
  resolution: string;
  createdAt: string;
}

export interface PromptGroup {
  notes: string;
  steps: Array<{ name: string; content: string }>;
}

export interface SavedPromptRecord {
  folderIds?: string[];
  group?: PromptGroup;
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  provider: ProviderId;
  model: string;
  format: PromptOutputFormat;
  content: string;
  category: string;
  tags: string[];
  order?: number;
  isFavorite?: boolean;
  isFrequent?: boolean;
  lastUsedAt?: string;
  source?: PromptSource;
  versions?: PromptVersion[];
  usedCount?: number;
  linkedImages?: Array<PromptLinkedImage | string>;
  exampleImageIds?: string[];
  imageStorageVersion?: 2;
  version?: string;
  usageCount?: number;
  lastUsed?: string;
  contentVariants?: Partial<Record<PromptOutputFormat, string>>;
}

export interface PromptWorkspaceState {
  rolePreset: string;
  rolePresetLocked: boolean;
  userRequirement: string;
  skillId?: PromptSkillId;
}

export interface PromptFolder {
  id: string;
  name: string;
  scope: string;
  createdAt: string;
  order: number;
}
