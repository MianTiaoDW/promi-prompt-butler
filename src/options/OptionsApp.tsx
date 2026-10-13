import { useTheme } from "../hooks/useTheme";
import { ImageParameterSelect } from "../content/ImageParameterSelect";
import { confirmInputOnBlankClick, confirmInputOnEnter, startInputComposition, finishInputComposition } from "../lib/enter-confirm";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowLeft, BrainCircuit, Check, ChevronDown, DatabaseZap, Eye, EyeOff, X } from "../components/PromiIcons";

import {
  applyDetectedModelCatalog,
  buildSettingsFromProvider,
  getEffectiveModelCatalog,
  getImageConnectionSettings,
  getProviderPreset,
  hasConnectionCredentials,
  isSettingsConfigured,
  providerOptions
} from "../lib/provider-presets";
import { sendRuntimeMessage } from "../lib/runtime";
import { MOTION } from "../lib/motion";
import { useExtensionSettings } from "../hooks/useExtensionSettings";
import { IMAGE_ASPECT_RATIOS, IMAGE_COUNTS, IMAGE_RESOLUTIONS } from "../types/settings";
import type { ExtensionSettings } from "../types/settings";
import type { ConnectionTestResult, ModelDetectionResult } from "../types/runtime";
import { cleanupExampleImages, getExampleImageUsage } from "../lib/example-images";
import { storageGet } from "../lib/storage";
import { PROMPT_STORAGE_KEYS } from "../lib/prompt-library";
import type { SavedPromptRecord } from "../types/prompt";

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function ExampleImageStorageSettings() {
  const [usage, setUsage] = useState({ usedBytes: 0, limitBytes: 30 * 1024 * 1024, imageCount: 0 });
  const [message, setMessage] = useState("");
  const refresh = () => void getExampleImageUsage().then(setUsage).catch(() => setMessage("无法读取示例图存储状态。"));
  useEffect(refresh, []);
  const cleanup = async () => {
    try {
      const prompts = await storageGet<SavedPromptRecord[]>(PROMPT_STORAGE_KEYS.favorites, []);
      const result = await cleanupExampleImages(prompts.map((prompt) => prompt.id));
      setMessage(result.deleted ? `已清理 ${result.deleted} 条无效图片数据。` : "没有发现无效图片数据。");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清理失败，请重试。");
    }
  };
  return (
    <div className="settings-form-section">
      <div className="settings-section-heading"><h3>示例图存储</h3><p>只保存用户主动添加的压缩预览图，软上限为 30MB。</p></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div><strong className="text-sm text-primary">已使用 {formatMegabytes(usage.usedBytes)} / {formatMegabytes(usage.limitBytes)}</strong><p className="mt-1 text-xs text-tertiary">共 {usage.imageCount} 张示例图</p></div>
        <div className="flex gap-2"><button type="button" className="ghost-button px-3 py-2 text-xs" onClick={() => window.open(chrome.runtime.getURL("options.html?view=app"), "_blank")}>管理</button><button type="button" className="ghost-button px-3 py-2 text-xs" onClick={() => void cleanup()}>清理无效数据</button></div>
      </div>
      {message ? <p className="mt-2 text-xs text-secondary">{message}</p> : null}
    </div>
  );
}

interface ModelComboboxProps {
  id: string;
  label: string;
  options: string[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

function ModelCombobox({
  id,
  label,
  options,
  placeholder,
  value,
  onChange
}: ModelComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const filteredOptions = query.trim()
    ? options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectModel = (model: string) => {
    onChange(model);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="block" ref={rootRef}>
      <label htmlFor={id} className="settings-field-label">{label}</label>
      <div className="model-combobox">
        <input
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.repeat) return;
            if (event.key === "Escape") setIsOpen(false);
            if (event.key === "ArrowDown") setIsOpen(true);
            if (event.key === "Enter" && isOpen && filteredOptions.length === 1) {
              selectModel(filteredOptions[0]);
            }
            if (event.key === "Enter" && !event.shiftKey) setIsOpen(false);
          }}
          placeholder={placeholder}
          className="form-field settings-control model-combobox-input"
        />
        <button
          type="button"
          className="model-combobox-trigger"
          aria-label={`展开${label}列表`}
          aria-expanded={isOpen}
          onClick={() => {
            setQuery("");
            setIsOpen((current) => !current);
          }}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen ? (
          <div id={`${id}-listbox`} role="listbox" className="model-combobox-menu image-parameter-menu">
            {filteredOptions.length > 0 ? filteredOptions.map((model) => (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={model === value}
                className="model-combobox-option"
                onClick={() => selectModel(model)}
              >
                <span>{model}</span>
                {model === value ? <Check className="h-4 w-4" /> : null}
              </button>
            )) : (
              <div className="model-combobox-empty">没有匹配项，可直接输入模型 ID</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTestTime(timestamp: string | null) {
  if (!timestamp) return "尚未测试";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "尚未测试";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function OptionsApp() {
  useTheme();
  const shouldReduceMotion = useReducedMotion();
  const showUnsupportedNotice = new URLSearchParams(window.location.search).get("notice") === "unsupported";
  const { settings, isLoading, error, updateSettings } = useExtensionSettings();
  const [draftSettings, setDraftSettings] = useState<ExtensionSettings>(settings);
  const [panelMessage, setPanelMessage] = useState("完成服务连接与模型配置后，可以保存并测试连接。");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isImageApiKeyVisible, setIsImageApiKeyVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftProviderPreset = getProviderPreset(draftSettings.provider);
  const effectiveDraftCatalog = getEffectiveModelCatalog(draftSettings);
  const iconUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("icons/icon48.png")
    : "/icons/icon48.png";

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  };

  const isDraftConfigured = isSettingsConfigured(draftSettings);
  const hasDraftConnectionCredentials = hasConnectionCredentials(draftSettings);
  const imageConnection = getImageConnectionSettings(draftSettings);
  const isDirty = JSON.stringify(draftSettings) !== JSON.stringify(settings);
  const connectionFieldsChanged =
    draftSettings.provider !== settings.provider ||
    draftSettings.apiKey !== settings.apiKey ||
    draftSettings.baseUrl !== settings.baseUrl;
  const displayedLastTestAt = connectionFieldsChanged ? null : settings.lastValidatedAt;
  const connectionStatus = isTestingConnection
    ? "testing"
    : connectionFieldsChanged
      ? "idle"
      : settings.connectionStatus;

  const connectionStatusLabel = isLoading
    ? "正在同步"
    : connectionStatus === "testing"
      ? "测试中"
      : connectionStatus === "success"
        ? "连接成功"
        : connectionStatus === "error"
          ? "连接失败"
          : "尚未测试";

  const modelRecognitionLabel = isDetectingModels
    ? "识别中"
    : draftSettings.lastModelDetectionAt
      ? `推理 ${effectiveDraftCatalog.reasoning.length} / 视觉 ${effectiveDraftCatalog.vision.length} / 生图 ${effectiveDraftCatalog.image.length}`
      : "未识别";

  const modelFields = useMemo(() => [
    {
      field: "reasoningModel" as const,
      label: "推理模型",
      placeholder: "选择或输入推理模型 ID",
      options: effectiveDraftCatalog.reasoning
    },
    {
      field: "visionModel" as const,
      label: "视觉模型",
      placeholder: "选择或输入视觉模型 ID",
      options: effectiveDraftCatalog.vision
    },
    {
      field: "imageModel" as const,
      label: "生图模型",
      placeholder: "选择或输入生图模型 ID",
      options: effectiveDraftCatalog.image
    }
  ], [effectiveDraftCatalog]);

  const updateConnectionDraft = (patch: Partial<ExtensionSettings>) => {
    setDraftSettings((current) => ({
      ...current,
      ...patch,
      connectionStatus: "idle",
      lastValidatedAt: null
    }));
  };

  const updateImageConnectionDraft = (patch: Pick<Partial<ExtensionSettings>, "imageApiKey" | "imageBaseUrl">) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    const nextSettings: ExtensionSettings = {
      ...draftSettings,
      connectionStatus: connectionFieldsChanged ? "idle" : settings.connectionStatus,
      lastValidatedAt: connectionFieldsChanged ? null : settings.lastValidatedAt
    };
    await updateSettings(nextSettings);
    setPanelMessage("");
    showToast("配置已保存，并已同步到插件主界面");
  };

  const handleReset = () => {
    setDraftSettings(settings);
    setPanelMessage("已恢复上次保存的配置。");
  };

  const handleProviderChange = (provider: ExtensionSettings["provider"]) => {
    const nextDraftSettings = {
      ...buildSettingsFromProvider(provider, draftSettings),
      connectionStatus: "idle" as const,
      lastValidatedAt: null
    };
    setDraftSettings(nextDraftSettings);
    setPanelMessage("已切换服务商预设，请确认连接信息和模型。");

    if (hasConnectionCredentials(nextDraftSettings)) {
      void handleDetectModels(nextDraftSettings);
    }
  };

  const handleDetectModels = async (settingsToDetect: ExtensionSettings = draftSettings) => {
    setIsDetectingModels(true);
    setPanelMessage("正在识别当前服务可用的模型列表…");

    try {
      const result = await sendRuntimeMessage<ModelDetectionResult>({
        type: "provider:detect-models",
        payload: { settings: settingsToDetect }
      });

      if (!result.ok || !result.catalog) {
        setPanelMessage(`模型识别失败：${result.message}`);
        return;
      }

      setDraftSettings(applyDetectedModelCatalog(settingsToDetect, result.catalog));
      setPanelMessage(`${result.message} 已更新到当前表单。`);
    } catch (requestError) {
      setPanelMessage(
        requestError instanceof Error ? `模型识别失败：${requestError.message}` : "模型识别失败。"
      );
    } finally {
      setIsDetectingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setPanelMessage("正在测试模型服务连接…");

    const testingSettings: ExtensionSettings = {
      ...draftSettings,
      connectionStatus: "testing",
      lastValidatedAt: settings.lastValidatedAt
    };
    await updateSettings(testingSettings);

    try {
      const result = await sendRuntimeMessage<ConnectionTestResult>({
        type: "provider:test-connection",
        payload: { settings: testingSettings }
      });
      const nextSettings: ExtensionSettings = {
        ...testingSettings,
        connectionStatus: result.ok ? "success" : "error",
        lastValidatedAt: result.checkedAt
      };

      await updateSettings(nextSettings);
      setDraftSettings(nextSettings);
      setPanelMessage(
        result.ok
          ? `连接成功，已访问：${result.checkedUrl}`
          : `连接失败（${result.status || "网络错误"}）：${result.message}`
      );
    } catch (requestError) {
      const failedSettings: ExtensionSettings = {
        ...testingSettings,
        connectionStatus: "error",
        lastValidatedAt: new Date().toISOString()
      };
      await updateSettings(failedSettings);
      setDraftSettings(failedSettings);
      setPanelMessage(
        requestError instanceof Error ? `连接失败：${requestError.message}` : "连接失败。"
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  const returnToBrowser = () => {
    window.close();
    window.setTimeout(() => showToast("请切换到普通网页，再点击浏览器工具栏中的扩展图标"), 80);
  };

  const apiKeyIsSaved = Boolean(settings.apiKey) && draftSettings.apiKey === settings.apiKey;
  const imageApiKeyIsSaved = Boolean(settings.imageApiKey) && draftSettings.imageApiKey === settings.imageApiKey;
  const connectionToneClass = connectionStatus === "success"
    ? "connection-success-text"
    : connectionStatus === "error"
      ? "text-rose-300"
      : connectionStatus === "testing"
        ? "text-amber-300"
        : "text-secondary";

  return (
    <main data-enter-confirm onKeyDown={confirmInputOnEnter} onPointerDownCapture={confirmInputOnBlankClick} onCompositionStartCapture={startInputComposition} onCompositionEndCapture={finishInputComposition} className="settings-page min-h-screen bg-canvas text-primary">
      <header className="settings-app-bar">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={iconUrl} alt="" className="h-9 w-9 rounded-[var(--radius-small)]" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-[-0.02em]">提示词生成管家</div>
              <div className="text-xs text-tertiary">设置 / 模型连接</div>
            </div>
          </div>
          <button type="button" onClick={returnToBrowser} className="ghost-button h-10 shrink-0 px-3">
            <ArrowLeft className="h-4 w-4" />
            返回主界面
          </button>
        </div>
      </header>

      {showUnsupportedNotice ? (
        <div className="settings-restricted-notice" role="status">
          <strong>当前页面不支持打开悬浮工作台</strong>
          <span>请切换到普通网页后再次点击扩展图标。你仍可在此页面完成模型与 API Key 设置。</span>
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8 md:py-10"
      >
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-tertiary">设置</p>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-primary">模型连接</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                配置模型服务，并为提示词、视觉理解和图像生成指定模型。
              </p>
            </div>
            <div className="settings-status-pill">
              <span className={`connection-status-dot ${
                connectionStatus === "success"
                  ? "connection-status-dot-online"
                  : connectionStatus === "testing"
                    ? "connection-status-dot-testing"
                    : connectionStatus === "error"
                      ? "connection-status-dot-error"
                      : "connection-status-dot-idle"
              }`} />
              {connectionStatusLabel}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <article className="glass-card min-w-0 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-tertiary">连接配置</p>
                <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.025em]">服务连接与模型</h2>
              </div>
              <div className="settings-provider-chip">
                <span>当前服务商</span>
                <strong>{draftProviderPreset.label}</strong>
              </div>
            </div>

            <div className="settings-form-section mt-6">
              <div className="settings-section-heading">
                <h3>服务连接</h3>
                <p>用于连接模型服务的服务商、凭证与地址。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ImageParameterSelect className="settings-parameter-select" label="服务商" value={draftSettings.provider}
                  options={providerOptions.map(option => ({ value: option.id, label: option.label }))}
                  onChange={value => handleProviderChange(value as ExtensionSettings["provider"])} />

                <label className="block">
                  <span className="settings-field-label">
                    API Key
                    <span className={apiKeyIsSaved ? "text-accent" : "text-tertiary"}>
                      {apiKeyIsSaved ? "已保存" : "未保存"}
                    </span>
                  </span>
                  <div className="relative">
                    <input
                      type={isApiKeyVisible ? "text" : "password"}
                      value={draftSettings.apiKey}
                      onChange={(event) => updateConnectionDraft({ apiKey: event.target.value })}
                      placeholder="输入 API Key"
                      className="form-field settings-control pr-[76px]"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
                      <button
                        type="button"
                        className="settings-field-action"
                        onClick={() => setIsApiKeyVisible((current) => !current)}
                        aria-label={isApiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                      >
                        {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="settings-field-action"
                        onClick={() => updateConnectionDraft({ apiKey: "" })}
                        aria-label="清空 API Key"
                        disabled={!draftSettings.apiKey}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </label>

                <label className="block md:col-span-2">
                  <span className="settings-field-label">Base URL</span>
                  <input
                    type="url"
                    value={draftSettings.baseUrl}
                    onChange={(event) => updateConnectionDraft({
                      baseUrl: event.target.value,
                      detectedModelCatalog: null,
                      lastModelDetectionAt: null
                    })}
                    placeholder="输入或覆盖默认 Base URL"
                    className="form-field settings-control"
                  />
                </label>

                <div className="md:col-span-2 border-t border-[var(--border-subtle)] pt-4">
                  <h4 className="text-sm font-semibold text-primary">生图专用配置</h4>
                  <p className="mt-1 text-xs leading-5 text-tertiary">
                    填写后仅用于图片生成；留空时自动回退使用上方通用配置。
                  </p>
                </div>

                <label className="block">
                  <span className="settings-field-label">
                    生图 API Key
                    <span className={imageApiKeyIsSaved ? "text-accent" : "text-tertiary"}>
                      {imageApiKeyIsSaved ? "已保存" : "未配置"}
                    </span>
                  </span>
                  <div className="relative">
                    <input
                      type={isImageApiKeyVisible ? "text" : "password"}
                      value={draftSettings.imageApiKey}
                      onChange={(event) => updateImageConnectionDraft({ imageApiKey: event.target.value })}
                      placeholder="输入生图专用 API Key"
                      className="form-field settings-control pr-[76px]"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
                      <button
                        type="button"
                        className="settings-field-action"
                        onClick={() => setIsImageApiKeyVisible((current) => !current)}
                        aria-label={isImageApiKeyVisible ? "隐藏生图 API Key" : "显示生图 API Key"}
                      >
                        {isImageApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        className="settings-field-action"
                        onClick={() => updateImageConnectionDraft({ imageApiKey: "" })}
                        aria-label="清空生图 API Key"
                        disabled={!draftSettings.imageApiKey}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </label>

                <label className="block">
                  <span className="settings-field-label">生图 Base URL</span>
                  <input
                    type="url"
                    value={draftSettings.imageBaseUrl}
                    onChange={(event) => updateImageConnectionDraft({ imageBaseUrl: event.target.value })}
                    placeholder="留空则使用通用 Base URL"
                    className="form-field settings-control"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-tertiary">
                两类 API Key 均保存在当前浏览器扩展的本地存储中，并由扩展后台在对应请求中使用。
              </p>
            </div>

            <div className="settings-form-section">
              <div className="settings-section-heading">
                <h3>模型用途</h3>
                <p>输入框支持从识别结果中搜索选择，也可以直接填写模型 ID。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {modelFields.map(({ field, label, placeholder, options }) => (
                  <ModelCombobox
                    key={field}
                    id={field}
                    label={label}
                    value={draftSettings[field]}
                    options={options}
                    placeholder={placeholder}
                    onChange={(value) => {
                      setDraftSettings((current) => ({ ...current, [field]: value }));
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="settings-form-section">
              <div className="settings-section-heading">
                <h3>图像输出</h3>
                <p>作为图像工坊的默认生成参数。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ImageParameterSelect className="settings-parameter-select" label="图像比例" value={draftSettings.imageAspectRatio}
                  options={IMAGE_ASPECT_RATIOS.map(value => ({ value, label: value }))}
                  onChange={value => setDraftSettings(current => ({ ...current, imageAspectRatio: value as ExtensionSettings["imageAspectRatio"] }))} />
                <ImageParameterSelect className="settings-parameter-select" label="分辨率" value={draftSettings.imageResolution}
                  options={IMAGE_RESOLUTIONS.map(value => ({ value, label: value }))}
                  onChange={value => setDraftSettings(current => ({ ...current, imageResolution: value as ExtensionSettings["imageResolution"] }))} />
                <ImageParameterSelect className="settings-parameter-select" label="生成数量" value={String(draftSettings.imageCount)}
                  options={IMAGE_COUNTS.map(value => ({ value: String(value), label: `${value} 张` }))}
                  onChange={value => setDraftSettings(current => ({ ...current, imageCount: Number(value) as ExtensionSettings["imageCount"] }))} />
              </div>
            </div>

            <ExampleImageStorageSettings />

            <div className="settings-actions">
              <button
                type="button"
                data-enter-submit onClick={() => void handleSave()}
                className="gradient-button min-w-[112px]"
                disabled={!isDirty}
              >
                保存配置
              </button>
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                className="ghost-button min-w-[112px]"
                disabled={isTestingConnection || !hasDraftConnectionCredentials}
              >
                {isTestingConnection ? "测试中…" : "测试连接"}
              </button>
              <button
                type="button"
                onClick={() => void handleDetectModels()}
                className="settings-text-button min-w-[112px]"
                disabled={isDetectingModels || !hasDraftConnectionCredentials}
              >
                {isDetectingModels ? "识别中…" : "自动识别模型"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="settings-text-button min-w-[112px]"
                disabled={!isDirty}
              >
                恢复上次保存
              </button>
            </div>

            {panelMessage ? <p className="settings-inline-message">{panelMessage}</p> : null}
            {draftProviderPreset.notes ? <p className="mt-3 text-xs leading-5 text-tertiary">{draftProviderPreset.notes}</p> : null}
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </article>

          <aside className="min-w-0 self-start space-y-4 lg:sticky lg:top-24">
            <article className="glass-card p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="settings-status-icon"><DatabaseZap className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-[18px] font-semibold">状态快照</h2>
                  <p className="mt-1 text-xs text-tertiary">当前设备中的实时配置状态</p>
                </div>
              </div>

              <dl className="settings-status-list mt-5">
                <div>
                  <dt>当前服务商</dt>
                  <dd>{draftProviderPreset.label}</dd>
                </div>
                <div>
                  <dt>配置状态</dt>
                  <dd className={isDraftConfigured ? "text-accent" : "text-primary"}>
                    {isDraftConfigured ? "已填写完整" : "未填写完整"}
                  </dd>
                </div>
                <div>
                  <dt>连接状态</dt>
                  <dd className={connectionToneClass}>{connectionStatusLabel}</dd>
                </div>
                <div>
                  <dt>最近测试</dt>
                  <dd>{formatTestTime(displayedLastTestAt)}</dd>
                </div>
                <div>
                  <dt>已识别模型</dt>
                  <dd>{modelRecognitionLabel}</dd>
                </div>
                <div>
                  <dt>生图 Key</dt>
                  <dd className={draftSettings.imageApiKey.trim() ? "text-accent" : "text-secondary"}>
                    {draftSettings.imageApiKey.trim() ? "已配置" : "未配置"}
                  </dd>
                </div>
                <div>
                  <dt>生图通道</dt>
                  <dd>{imageConnection.channel === "dedicated" ? "专用" : "回退通用"}</dd>
                </div>
              </dl>
            </article>

            <article className="glass-card settings-side-card">
              <div className="settings-side-card-heading">
                <BrainCircuit className="h-4 w-4" />
                <h2>模型能力</h2>
              </div>
              <dl className="settings-capability-list">
                <div><dt>文本模型</dt><dd>{draftSettings.reasoningModel || "未设置"}</dd></div>
                <div><dt>视觉模型</dt><dd>{draftSettings.visionModel || "未设置"}</dd></div>
                <div><dt>图像模型</dt><dd>{draftSettings.imageModel || "未设置"}</dd></div>
                <div><dt>生图地址</dt><dd>{draftSettings.imageBaseUrl.trim() ? "专用地址" : "通用地址"}</dd></div>
              </dl>
            </article>

            <article className="glass-card settings-side-card">
              <div className="settings-side-card-heading">
                <Activity className="h-4 w-4" />
                <h2>最近活动</h2>
              </div>
              {displayedLastTestAt ? (
                <div className="settings-activity-item">
                  <time>{formatTestTime(displayedLastTestAt)}</time>
                  <span className={connectionToneClass}>{connectionStatusLabel}</span>
                </div>
              ) : (
                <p className="settings-side-empty">完成连接测试后，这里会显示最近结果。</p>
              )}
            </article>
          </aside>
        </section>
      </motion.div>

      <div className="settings-toast-position">
      <AnimatePresence>
        {toastMessage ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: { duration: shouldReduceMotion ? 0.06 : 0.45 } }}
            transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.toastEnterMs / 1000, ease: MOTION.easeOut }}
            className="settings-toast"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {toastMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>
    </main>
  );
}
