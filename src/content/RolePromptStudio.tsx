import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Eraser,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  X
} from "lucide-react";

import { useChromeStorage } from "../hooks/useChromeStorage";
import { saveImageWorkspace } from "../lib/image-library";
import { getPromptSkillProfile, PROMPT_SKILL_PROFILES } from "../lib/prompt-skills";
import { ensureDefaultRolePreset, PROMPT_STORAGE_KEYS, savePromptToFavorites } from "../lib/prompt-library";
import { storageGet } from "../lib/storage";
import type { SavedPromptRecord } from "../types/prompt";
import { failPromptTask, getPromptTask, startPromptTask, subscribePromptTask } from "../lib/task-broker";
import { showToast } from "../lib/toast";
import { sendRuntimeMessageLong } from "../lib/runtime";
import type {
  PromptGenerationResult,
  PromptOutputFormat,
  PromptWorkspaceState
} from "../types/prompt";
import type { ExtensionSettings } from "../types/settings";
import { PromptActionBar } from "./PromptActionBar";
import { PromptSaveModal, type PromptSaveValues } from "./PromptSaveModal";

const defaultWorkspaceState: PromptWorkspaceState = {
  rolePreset: "",
  rolePresetLocked: false,
  userRequirement: "",
  skillId: "cinematic-image"
};

function convertFileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("读取参考图失败。"));
    };
    reader.onerror = () => {
      reject(new Error("读取参考图失败。"));
    };
    reader.readAsDataURL(file);
  });
}

function structuredPromptToText(value: PromptGenerationResult & { ok: true }) {
  return JSON.stringify(value.output.structuredPrompt, null, 2);
}

function getRoleDisplayName(rolePreset: string) {
  try {
    const parsed = JSON.parse(rolePreset) as Record<string, unknown>;
    const role = parsed["# 角色"];
    if (typeof role === "string" && role.trim()) return role.trim();
  } catch {
    const firstLine = rolePreset.split("\n").find((line) => line.trim());
    if (firstLine) return firstLine.replace(/^#+\s*/, "").slice(0, 24);
  }
  return "视觉创作专家";
}

export function RolePromptStudio(props: {
  settings: ExtensionSettings;
  isServiceReady: boolean;
  onOpenImageStudio: () => void;
}) {
  const { settings, isServiceReady, onOpenImageStudio } = props;
  const workspace = useChromeStorage<PromptWorkspaceState>(
    PROMPT_STORAGE_KEYS.workspace,
    defaultWorkspaceState
  );
  const promptAssets = useChromeStorage<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSkillPickerOpen, setIsSkillPickerOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState<Array<{ dataUrl: string; name: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<PromptGenerationResult | null>(null);
  const [panelMessage, setPanelMessage] = useState("填写角色设定和需求后点击生成");
  const [copiedFormat, setCopiedFormat] = useState<PromptOutputFormat | null>(null);
  const [pendingSave, setPendingSave] = useState<{ format: PromptOutputFormat; text: string } | null>(null);
  const [savedRecords, setSavedRecords] = useState<Partial<Record<PromptOutputFormat, SavedPromptRecord>>>({});
  const [editingFormat, setEditingFormat] = useState<PromptOutputFormat | null>(null);
  const [editingText, setEditingText] = useState("");
  const [expandedOutputs, setExpandedOutputs] = useState<PromptOutputFormat[]>(["cnPrompt"]);

  const { value: workspaceState, setValue: setWorkspaceState, isLoading } = workspace;
  const selectedSkill = getPromptSkillProfile(workspaceState.skillId);
  const quickPrompts = useMemo(
    () => [...promptAssets.value]
      .sort((left, right) => {
        const frequentDiff = Number(Boolean(right.isFrequent)) - Number(Boolean(left.isFrequent));
        if (frequentDiff !== 0) return frequentDiff;
        return new Date(right.lastUsedAt ?? right.updatedAt ?? right.createdAt).getTime() - new Date(left.lastUsedAt ?? left.updatedAt ?? left.createdAt).getTime();
      })
      .slice(0, 3),
    [promptAssets.value]
  );

  useEffect(() => {
    if (!copiedFormat) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedFormat(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copiedFormat]);


  useEffect(() => {
    void ensureDefaultRolePreset().then(() => {
      // 刷新 workspace state 以显示默认角色
      void storageGet<PromptWorkspaceState>(
        PROMPT_STORAGE_KEYS.workspace,
        defaultWorkspaceState
      ).then((ws) => {
        if (ws.rolePreset && !workspaceState.rolePreset) {
          void setWorkspaceState(() => ws);
        }
      });
    });
  }, []);

  useEffect(() => {
    const applyTaskState = (task: Awaited<ReturnType<typeof getPromptTask>>) => {
      if (task.status === "submitting" || task.status === "generating") {
        setIsGenerating(true);
        setPanelMessage("正在通过 Background 调用模型扩写角色提示词...");
        return;
      }

      if ((task.status === "success" || task.status === "error") && task.result) {
        setGenerationResult(task.result);
        setIsGenerating(false);
        if (task.result.ok) {
          setPanelMessage(
            `已完成生成，当前使用模型：${task.result.model}。`
          );
        } else {
          setPanelMessage(`生成失败：${task.result.message}`);
        }
        return;
      }

      if (task.status === "error" && task.errorMessage) {
        setGenerationResult({
          ok: false,
          provider: settings.provider,
          model: settings.reasoningModel,
          generatedAt: task.finishedAt ?? new Date().toISOString(),
          message: task.errorMessage
        });
        setPanelMessage(`生成失败：${task.errorMessage}`);
      }
      setIsGenerating(false);
    };

    void getPromptTask().then(applyTaskState);
    return subscribePromptTask(applyTaskState);
  }, [settings.provider, settings.reasoningModel]);

  const canGenerate = useMemo(() => {
    return Boolean(
      isServiceReady &&
        workspaceState.rolePreset.trim() &&
        workspaceState.userRequirement.trim()
    );
  }, [isServiceReady, workspaceState.rolePreset, workspaceState.userRequirement]);

  const updateWorkspace = async (patch: Partial<PromptWorkspaceState>) => {
    await setWorkspaceState((current) => ({
      ...current,
      ...patch
    }));
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPanelMessage("正在通过 Background 调用模型扩写角色提示词...");
    setSavedRecords({});
    setPendingSave(null);
    await startPromptTask();

    try {
      const result = await sendRuntimeMessageLong<PromptGenerationResult>(
        {
          type: "prompt:generate",
          payload: {
            settings,
            input: {
              rolePreset: workspaceState.rolePreset,
              userRequirement: workspaceState.userRequirement,
              skillId: workspaceState.skillId,
              referenceImages: referenceImages.length > 0 ? referenceImages : undefined
            }
          }
        },
        async () => {
          const task = await getPromptTask();
          if ((task.status === "success" || task.status === "error") && task.result) {
            return task.result;
          }
          return null;
        }
      );

      setGenerationResult(result);
      if (result.ok) {
        setExpandedOutputs(["cnPrompt"]);
        setPanelMessage(
          `已完成生成，当前使用模型：${result.model}。`
        );
      } else {
        setPanelMessage(`生成失败：${result.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败。";
      await failPromptTask(message);
      setGenerationResult({
        ok: false,
        provider: settings.provider,
        model: settings.reasoningModel,
        generatedAt: new Date().toISOString(),
        message
      });
      setPanelMessage(`生成失败：${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (format: PromptOutputFormat, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
    } catch {
      setPanelMessage("当前页面不允许直接写入剪贴板，请手动复制。");
    }
  };

  const startEditing = (format: PromptOutputFormat, text: string) => {
    setEditingFormat(format);
    setEditingText(text);
  };

  const saveEditing = (format: PromptOutputFormat) => {
    if (!generationResult?.ok) return;
    const updatedOutput = { ...generationResult.output };
    if (format === "cnPrompt") updatedOutput.cnPrompt = editingText;
    else if (format === "enPrompt") updatedOutput.enPrompt = editingText;
    else {
      try {
        const parsed = JSON.parse(editingText) as typeof updatedOutput.structuredPrompt;
        updatedOutput.structuredPrompt = parsed;
      } catch {
        showToast("JSON 格式不正确，请修正后保存。");
        return;
      }
    }
    setGenerationResult({ ...generationResult, output: updatedOutput });
    setEditingFormat(null);
    showToast("已确认修改");
  };

  const openSaveModal = (format: PromptOutputFormat, text: string) => {
    setPendingSave({ format, text });
  };

  const confirmSavePrompt = async (values: PromptSaveValues) => {
    if (!generationResult?.ok || !pendingSave) return;
    const record = await savePromptToFavorites({
      provider: generationResult.provider,
      model: generationResult.model,
      format: pendingSave.format,
      content: pendingSave.text,
      title: values.title,
      category: "收藏",
      tags: values.tags,
      source: "ai-generated",
      isFavorite: true,
      contentVariants: {
        cnPrompt: generationResult.output.cnPrompt,
        enPrompt: generationResult.output.enPrompt,
        structuredPrompt: structuredPromptToText(generationResult)
      }
    });
    setSavedRecords((current) => ({ ...current, [pendingSave.format]: record }));
    setPendingSave(null);
    showToast("已保存到提示词库");
  };

  const sendToImageStudio = async (format: PromptOutputFormat, text: string) => {
    if (!generationResult?.ok) return;
    const record = savedRecords[format];
    await saveImageWorkspace({
      prompt: text,
      lastUpdatedAt: null,
      source: {
        promptId: record?.id,
        title: record?.title || workspaceState.userRequirement.slice(0, 28) || "未命名创作",
        type: record?.source ?? "temporary",
        format,
        provider: generationResult.provider,
        model: generationResult.model
      }
    });
    onOpenImageStudio();
  };

  const outputs = generationResult?.ok
    ? [
        {
          title: "中文提示词",
          format: "cnPrompt" as const,
          text: generationResult.output.cnPrompt
        },
        {
          title: "English Prompt",
          format: "enPrompt" as const,
          text: generationResult.output.enPrompt
        },
        {
          title: "高级结构化数据",
          format: "structuredPrompt" as const,
          text: structuredPromptToText(generationResult)
        }
      ]
    : [];

  return (
    <div className={`creator-workbench ${outputs.length > 0 ? "has-results" : ""}`}>
      <header className="creator-workbench-hero">
        <h1>创作提示词</h1>
        <p>描述你的想法，让 AI 帮你生成专业提示词。</p>
      </header>

      <section className="creator-input-surface">
        <div className="creator-input-heading">
          <div>
            <div className="section-label">创意描述</div>
            <div className="section-hint">写下主体、场景、风格或想表达的氛围。</div>
          </div>
          <div className="creator-input-meta">
            {workspaceState.userRequirement ? (
              <button
                type="button"
                onClick={() => void updateWorkspace({ userRequirement: "" })}
                aria-label="清空创意描述"
              >
                <Eraser className="h-4 w-4" />
                清空
              </button>
            ) : null}
          </div>
        </div>

        <textarea
          value={workspaceState.userRequirement}
          onChange={(event) => void updateWorkspace({ userRequirement: event.target.value })}
          placeholder="例如：为一款东方茶饮设计商业海报，产品悬浮在晨雾山谷中，柔和逆光，留出品牌标题区域。"
          className="form-field creator-idea-input"
        />

        <div className="creator-input-footer">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {referenceImages.length < 8 ? (
              <label className="creator-reference-button">
                <ImagePlus className="h-4 w-4" />
                添加参考图
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length === 0) return;
                    const remaining = 8 - referenceImages.length;
                    void Promise.all(
                      files.slice(0, remaining).map((file) =>
                        convertFileToDataUrl(file).then((dataUrl) => ({ dataUrl, name: file.name }))
                      )
                    ).then((newImages) => {
                      setReferenceImages((previous) => [...previous, ...newImages]);
                      setPanelMessage(`已附加 ${newImages.length} 张参考图`);
                    }).catch((error: unknown) => {
                      setPanelMessage(error instanceof Error ? error.message : "读取参考图失败。");
                    });
                  }}
                />
              </label>
            ) : null}
            <span className="creator-reference-count">{referenceImages.length}/8</span>
          </div>
          {quickPrompts.length > 0 ? <div className="creator-quick-prompts"><span>最近使用</span>{quickPrompts.map((record) => <button key={record.id} type="button" title={record.title || record.content.slice(0, 28)} onClick={() => void updateWorkspace({ userRequirement: record.content })}>{record.title || record.content.slice(0, 12)}</button>)}</div> : null}
        </div>

        {referenceImages.length > 0 ? (
          <div className="creator-reference-grid">
            {referenceImages.map((image, index) => (
              <div key={`${image.name}-${index}`} className="group relative">
                <img src={image.dataUrl} alt={image.name} />
                <button
                  type="button"
                  onClick={() => setReferenceImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`移除参考图 ${image.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="creator-settings-panel" aria-label="智能配置">
        <button type="button" className="creator-setting-row" onClick={() => setIsExpanded((current) => !current)}>
          <span>
            <strong>专家身份</strong>
            <small>{getRoleDisplayName(workspaceState.rolePreset)}</small>
          </span>
          <ChevronRight className={`h-4 w-4 ${isExpanded ? "rotate-90" : ""}`} />
        </button>
        {isExpanded ? (
          <div className="creator-setting-detail">
            <textarea
              value={workspaceState.rolePreset}
              onChange={(event) => void updateWorkspace({ rolePreset: event.target.value })}
              disabled={workspaceState.rolePresetLocked || isLoading}
              className="form-field min-h-[150px]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void updateWorkspace({ rolePresetLocked: !workspaceState.rolePresetLocked })}
                className="ghost-button min-h-10 px-3 text-xs"
              >
                {workspaceState.rolePresetLocked ? "重新编辑" : "锁定身份"}
              </button>
            </div>
          </div>
        ) : null}

        <button type="button" className="creator-setting-row" onClick={() => setIsSkillPickerOpen((current) => !current)}>
          <span>
            <strong>专业工作流</strong>
            <small>{selectedSkill.name}</small>
          </span>
          <ChevronRight className={`h-4 w-4 ${isSkillPickerOpen ? "rotate-90" : ""}`} />
        </button>
        {isSkillPickerOpen ? (
          <div className="creator-setting-detail grid gap-2">
            {PROMPT_SKILL_PROFILES.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  void updateWorkspace({ skillId: skill.id });
                  setIsSkillPickerOpen(false);
                  setPanelMessage(`已选择「${skill.name}」工作流`);
                }}
                className={`skill-choice text-left ${selectedSkill.id === skill.id ? "skill-choice-active" : ""}`}
              >
                <span className="block text-sm font-semibold">{skill.name}</span>
                <span className="mt-1 block text-xs leading-5 text-secondary">{skill.summary}</span>
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="creator-setting-row"
          onClick={() => chrome.runtime.sendMessage({ type: "open-options-page" })}
        >
          <span>
            <strong>模型</strong>
            <small>{referenceImages.length > 0 ? settings.visionModel : settings.reasoningModel || "自动选择"}</small>
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="creator-generate-panel">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate || isGenerating}
          className="gradient-button creator-generate-button"
        >
          {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "正在生成提示词..." : generationResult?.ok ? "重新生成" : "开始生成"}
        </button>
        <p>{isServiceReady ? panelMessage : "请先在配置中心完成连接配置"}</p>
      </section>

      <section className="creator-results-workbench">
        <div className="creator-results-heading">
          <div>
            <div className="section-label">生成结果</div>
            <div className="section-hint">先完成中文提示词，再按需查看英文与结构化数据。</div>
          </div>
          {generationResult?.ok ? (
            <div className="creator-results-cta">
              <span className={`prompt-temporary-status ${savedRecords.cnPrompt ? "is-saved" : ""}`}>{savedRecords.cnPrompt ? "已保存" : "未保存"}</span>
              <button type="button" onClick={() => void sendToImageStudio("cnPrompt", generationResult.output.cnPrompt)}>
                开始创作<ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {generationResult && !generationResult.ok ? (
          <div className="creator-error-state">{generationResult.message}</div>
        ) : null}

        {outputs.length === 0 ? generationResult && !generationResult.ok ? null : (
          <div className="creator-result-empty">输入创意并开始生成，结果会在这里进入编辑工作流。</div>
        ) : (
          <div className="creator-output-stack">
            {outputs.map((item) => {
              const isOutputExpanded = expandedOutputs.includes(item.format);
              const isPrimaryOutput = item.format === "cnPrompt";
              return (
                <article key={item.format} className={`creator-output-card ${isPrimaryOutput ? "creator-output-card-primary" : ""}`}>
                  <div className="creator-output-header">
                    <button
                      type="button"
                      onClick={() => setExpandedOutputs((current) =>
                        current.includes(item.format)
                          ? current.filter((format) => format !== item.format)
                          : [...current, item.format]
                      )}
                      aria-expanded={isOutputExpanded}
                    >
                      <span>{item.title}</span>
                      <ChevronDown className={`h-4 w-4 ${isOutputExpanded ? "rotate-180" : ""}`} />
                    </button>

                    <div className="creator-output-actions">
                      {editingFormat !== item.format ? <PromptActionBar
                        copied={copiedFormat === item.format}
                        saved={Boolean(savedRecords[item.format])}
                        onCopy={() => void handleCopy(item.format, item.text)}
                        onSave={() => openSaveModal(item.format, item.text)}
                        onSendToImage={() => void sendToImageStudio(item.format, item.text)}
                      /> : null}
                    </div>
                  </div>

                  {isOutputExpanded ? editingFormat === item.format ? (
                    <div data-enter-confirm className="creator-inline-edit">
                    <textarea
                      autoFocus
                      aria-label={`编辑${item.title}`}
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      className={`form-field creator-output-editor ${item.format === "structuredPrompt" ? "is-structured" : ""}`}
                    />
                    <div className="creator-inline-edit-actions"><button type="button" className="ghost-button px-3 py-2 text-sm" onClick={() => setEditingFormat(null)}>取消</button><button type="button" data-enter-submit className="gradient-button px-3 py-2 text-sm" onClick={() => saveEditing(item.format)}><Check className="h-3.5 w-3.5" />确认</button></div>
                    </div>
                  ) : (
                    <pre role="button" tabIndex={0} aria-label={`编辑${item.title}`} title="点击编辑提示词" onClick={() => startEditing(item.format, item.text)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); startEditing(item.format, item.text); } }} className={`creator-output-content is-editable ${item.format === "structuredPrompt" ? "is-structured" : ""}`}>{item.text}</pre>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <PromptSaveModal
        open={Boolean(pendingSave)}
        defaultTitle={workspaceState.userRequirement.slice(0, 28) || pendingSave?.text.slice(0, 28) || "未命名提示词"}
        onClose={() => setPendingSave(null)}
        onSave={(values) => void confirmSavePrompt(values)}
      />
    </div>
  );
}
