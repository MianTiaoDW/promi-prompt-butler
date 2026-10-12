import { storageGet, storageSet } from "./storage";
import type { ImageWorkspaceState } from "../types/image";

export const IMAGE_STORAGE_KEYS = {
  workspace: "prompt-butler-image-workspace",
  history: "prompt-butler-image-history"
} as const;

export const defaultImageWorkspaceState: ImageWorkspaceState = {
  prompt: "",
  lastUpdatedAt: null
};

export async function saveImageWorkspace(input: ImageWorkspaceState) {
  const nextState: ImageWorkspaceState = {
    ...input,
    lastUpdatedAt: new Date().toISOString()
  };
  await storageSet(IMAGE_STORAGE_KEYS.workspace, nextState);
  return nextState;
}

export async function getImageWorkspaceState() {
  return storageGet<ImageWorkspaceState>(
    IMAGE_STORAGE_KEYS.workspace,
    defaultImageWorkspaceState
  );
}
