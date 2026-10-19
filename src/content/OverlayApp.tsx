import RubberSegment from "../components/RubberSegment/RubberSegment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Pin, Search, Settings, TutorialBook, X } from "../components/PromiIcons";
import { NewUserTutorial } from "./NewUserTutorial";
import { TUTORIAL_SEEN_KEY, TUTORIAL_STEPS, type TutorialWorkspace } from "../lib/tutorial";

import { confirmInputOnBlankClick, confirmInputOnEnter, startInputComposition, finishInputComposition } from "../lib/enter-confirm";
import { FavoritesStudio } from "./FavoritesStudio";
import { ImageStudio } from "./ImageStudio";
import { RolePromptStudio } from "./RolePromptStudio";
import { useTheme } from "../hooks/useTheme";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { FloatingOverlay } from "./FloatingOverlay";
import {
  PROMPT_STORAGE_KEYS
} from "../lib/prompt-library";
import { useChromeStorage } from "../hooks/useChromeStorage";
import { useExtensionSettings } from "../hooks/useExtensionSettings";
import { sessionStorageGet, sessionStorageSet, storageGet, storageSet } from "../lib/storage";
import { showToast, subscribeToast, type ToastEvent } from "../lib/toast";
import type { SavedPromptRecord } from "../types/prompt";
import { MOTION } from "../lib/motion";
import iconAssetPath from "../../icons/icon48.png";
import { migrateLegacyPromptImages } from "../lib/example-images";

interface OverlayAppProps {
  embedded?: boolean;
  appWindow?: boolean;
  onClose?: () => void;
  pinned?: boolean;
  onPinnedChange?: (isPinned: boolean) => boolean | void | Promise<boolean | void>;
}

export type PromptAssetFilter = "all" | "favorite" | "folders";

interface OverlaySessionState {
  activeTab: string;
  searchQuery: string;
  assetFilter: PromptAssetFilter;
  scrollTop: number;
  selectedPromptId: string | null;
}

const POPUP_SESSION_KEY = "prompt-butler-popup-ui-state";
const OVERLAY_UI_STATE_KEY = "prompt-butler-overlay-ui-state";
const OVERLAY_PINNED_KEY = "prompt-butler-overlay-pinned";
const defaultOverlaySessionState: OverlaySessionState = {
  activeTab: "角色设定",
  searchQuery: "",
  assetFilter: "all",
  scrollTop: 0,
  selectedPromptId: null
};

export function OverlayApp({
  embedded = false,
  appWindow = false,
  onClose,
  pinned,
  onPinnedChange
}: OverlayAppProps) {
  const shouldReduceMotion = useReducedMotion();
  const { isConfigured, isLoading, isServiceReady, settings } = useExtensionSettings();
  const iconUrl =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(iconAssetPath.replace(/^\//, ""))
      : iconAssetPath;
  const { rootRef: themeRootRef, mode: themeMode, setMode: setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string>("角色设定");
  const [tutorialInitialIndex, setTutorialInitialIndex] = useState(() => {
    if (!appWindow) return null;
    const chapter = new URLSearchParams(window.location.search).get("tutorialChapter");
    const index = chapter === null ? -1 : TUTORIAL_STEPS.findIndex(step => String(step.chapter) === chapter);
    return index < 0 ? null : index;
  });
  const [tutorialOpen, setTutorialOpen] = useState(tutorialInitialIndex !== null);
  useEffect(() => {
    if (tutorialInitialIndex === null) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("tutorialChapter");
    window.history.replaceState(null, "", url);
  }, [tutorialInitialIndex]);
  useEffect(() => {
    let cancelled = false;
    void storageGet(TUTORIAL_SEEN_KEY, false).then(seen => {
      if (!cancelled && !seen) setTutorialOpen(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<PromptAssetFilter>("all");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isLibraryStickyElevated, setIsLibraryStickyElevated] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(document.visibilityState === "visible");
  const [internalPinned, setInternalPinned] = useState(false);
  const isPinned = pinned ?? internalPinned;
  const [quickPromptRequest, setQuickPromptRequest] = useState<{ id: string; token: number } | null>(null);
  const favoritesStorage = useChromeStorage<SavedPromptRecord[]>(
    PROMPT_STORAGE_KEYS.favorites,
    []
  );
  const { value: favorites } = favoritesStorage;
  const [toast, setToast] = useState<ToastEvent | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRestoredRef = useRef(false);
  const popupSessionRef = useRef<OverlaySessionState>(defaultOverlaySessionState);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const persistUiState = useCallback((state: OverlaySessionState) => {
    return embedded && !appWindow
      ? sessionStorageSet(POPUP_SESSION_KEY, state)
      : storageSet(OVERLAY_UI_STATE_KEY, state);
  }, [appWindow, embedded]);

  useEffect(() => {
    void migrateLegacyPromptImages().catch((error) => {
      console.warn("[Prompt Butler] 旧图片数据迁移未完成：", error);
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (embedded || pinned !== undefined) return;
    let cancelled = false;
    void storageGet(OVERLAY_PINNED_KEY, false).then((storedIsPinned) => {
      if (cancelled) return;
      setInternalPinned(storedIsPinned);
    });
    return () => {
      cancelled = true;
    };
  }, [embedded, pinned]);

  useEffect(() => {
    let cancelled = false;
    const storedState = embedded && !appWindow
      ? sessionStorageGet(POPUP_SESSION_KEY, defaultOverlaySessionState)
      : storageGet(OVERLAY_UI_STATE_KEY, defaultOverlaySessionState);
    void storedState.then((stored) => {
      if (cancelled) return;
      popupSessionRef.current = stored;
      setActiveTab(stored.activeTab === "角色设定" || stored.activeTab === "图像生成" ? stored.activeTab : "收藏");
      setSearchQuery(stored.searchQuery);
      setAssetFilter(stored.assetFilter);
      if (stored.selectedPromptId) {
        setQuickPromptRequest({ id: stored.selectedPromptId, token: Date.now() });
      }
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (contentScrollRef.current) {
          contentScrollRef.current.scrollTop = stored.scrollTop;
          setShowBackToTop(stored.scrollTop > 300);
          setIsLibraryStickyElevated(stored.scrollTop > 8);
        }
        sessionRestoredRef.current = true;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appWindow, embedded]);

  useEffect(() => {
    if (!sessionRestoredRef.current) return;
    popupSessionRef.current = {
      ...popupSessionRef.current,
      activeTab,
      searchQuery,
      assetFilter
    };
    void persistUiState(popupSessionRef.current);
  }, [activeTab, assetFilter, persistUiState, searchQuery]);

  useEffect(() => {
    return subscribeToast((event) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast(event);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 2000);
    });
  }, []);

  useEffect(() => () => {
    if (sessionWriteTimerRef.current) clearTimeout(sessionWriteTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const activeWorkspace = activeTab === "角色设定"
    ? "identity"
    : activeTab === "图像生成"
      ? "image"
      : "library";
  const isConnectionOnline = isConfigured && settings.connectionStatus === "success";
  const recentQuickPrompts = useMemo(
    () => favorites
      .filter((record) => record.lastUsed ?? record.lastUsedAt)
      .sort((left, right) => new Date(right.lastUsed ?? right.lastUsedAt ?? 0).getTime() - new Date(left.lastUsed ?? left.lastUsedAt ?? 0).getTime())
      .slice(0, 5),
    [favorites]
  );

  const openWorkspace = (workspace: "identity" | "library" | "image") => {
    setSearchQuery("");
    setQuickPromptRequest(null);
    if (workspace === "identity") {
      setActiveTab("角色设定");
      return;
    }

    if (workspace === "image") {
      setActiveTab("图像生成");
      return;
    }

    setActiveTab("收藏");
  };

  const openOptions = () => {
    chrome.runtime.sendMessage({ type: "open-options-page" }, () => {
      if (chrome.runtime.lastError) {
        window.open(chrome.runtime.getURL("options.html"));
      }
    });
  };

  const navigateTutorial = (workspace: TutorialWorkspace) => {
    setQuickPromptRequest(null);
    setSearchQuery("");
    setAssetFilter(workspace === "folders" ? "folders" : "all");
    setActiveTab(workspace === "identity" ? "角色设定" : workspace === "image" ? "图像生成" : "收藏");
  };

  const togglePinned = async () => {
    const nextIsPinned = !isPinned;
    let result;
    try {
      result = await onPinnedChange?.(nextIsPinned);
    } catch (error) {
      showToast(`置顶失败：${error instanceof Error ? error.message : String(error)}`, "error");
      return;
    }
    if (result === false) {
      showToast(navigator.platform.toLowerCase().includes("mac")
        ? "macOS 暂不支持系统窗口置顶"
        : "置顶失败，请安装或重新安装 Windows 置顶辅助程序", "error");
      return;
    }
    if (pinned === undefined) {
      setInternalPinned(nextIsPinned);
      void storageSet(OVERLAY_PINNED_KEY, nextIsPinned);
    }
    showToast(nextIsPinned ? "工作台已置顶" : "已取消置顶");
  };

  const handleContentScroll = (scrollTop: number) => {
    setShowBackToTop(scrollTop > 300);
    setIsLibraryStickyElevated(scrollTop > 8);
    if (!sessionRestoredRef.current) return;
    popupSessionRef.current = { ...popupSessionRef.current, scrollTop };
    if (sessionWriteTimerRef.current) clearTimeout(sessionWriteTimerRef.current);
    sessionWriteTimerRef.current = setTimeout(() => {
      void persistUiState(popupSessionRef.current);
    }, 120);
  };

  const handlePreviewChange = useCallback((selectedPromptId: string | null) => {
    if (!sessionRestoredRef.current) return;
    popupSessionRef.current = { ...popupSessionRef.current, selectedPromptId };
    void persistUiState(popupSessionRef.current);
  }, [persistUiState]);

  const statusDotClassName = isConnectionOnline
    ? "connection-status-dot-online"
    : settings.connectionStatus === "testing"
      ? "connection-status-dot-testing"
      : settings.connectionStatus === "error"
        ? "connection-status-dot-error"
        : "connection-status-dot-idle";

  const statusBadgeText = isLoading
    ? "同步中"
    : isConnectionOnline
      ? "在线"
      : settings.connectionStatus === "testing"
        ? "连接中"
        : settings.connectionStatus === "error"
          ? "连接失败"
          : isConfigured
            ? "尚未测试"
            : "未配置";

  const panel = (
    <motion.section
      ref={themeRootRef}
      onKeyDown={confirmInputOnEnter}
      onPointerDownCapture={confirmInputOnBlankClick}
      onCompositionStartCapture={startInputComposition}
      onCompositionEndCapture={finishInputComposition}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.08 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}
      className={`glass-panel fluxora-shell accent-ring flex h-full flex-col overflow-hidden rounded-xl text-white ${isDocumentVisible ? "" : "is-document-hidden"}`}
    >
        <div className="fluxora-background" aria-hidden="true">
        </div>
        <header className={`glass-titlebar fluxora-titlebar flex h-14 items-center justify-between px-4 ${embedded ? "" : "drag-handle cursor-move"}`}>
          <div className="workspace-brand flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center">
              <img src={iconUrl} alt="" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <div className="workspace-brand-name text-sm font-semibold tracking-[-0.02em] text-white" title="Promi 提示词管家">
                Promi 提示词管家
              </div>
            </div>
          </div>
          <div className="workspace-system-controls flex items-center gap-2">
            <div data-no-drag className="workspace-status-pill flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs text-white/70">
              <span
                className={["connection-status-dot", statusDotClassName].join(" ")}
              />
              {statusBadgeText}
            </div>
            <button type="button" data-no-drag data-tutorial-launcher className="icon-button" aria-label="打开新手教程" title="新手教程" onClick={() => setTutorialOpen(true)}>
              <TutorialBook className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openOptions}
              className="icon-button"
              aria-label="打开配置中心"
              title="配置中心"
            >
              <Settings className="h-4 w-4" />
            </button>
            {!embedded || appWindow ? (
              <button
                type="button"
                onClick={() => void togglePinned()}
                className={`icon-button ${isPinned ? "icon-button-active" : ""}`}
                aria-label={isPinned ? "取消置顶工作台" : "置顶工作台"}
                aria-pressed={isPinned}
                title={isPinned ? "取消置顶" : "置顶工作台"}
              >
                <Pin className="h-4 w-4" />
              </button>
            ) : null}
            {!embedded && !appWindow && onClose ? (
              <button type="button" onClick={onClose} className="icon-button" aria-label="关闭Promi 提示词管家" title="关闭">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <ThemeSwitcher mode={themeMode} onChange={setThemeMode} />
          </div>
        </header>

        <motion.div
          layoutScroll
          ref={contentScrollRef}
          className="aura-content fluxora-content flex-1 overflow-y-auto"
          onScroll={(event) => handleContentScroll(event.currentTarget.scrollTop)}
        >
          <nav className="workspace-navigation" aria-label="工作区">
            <RubberSegment
              items={[{ value: "library", label: "提示词库" }, { value: "identity", label: "创作" }, { value: "image", label: "图像工坊" }]}
              value={activeWorkspace}
              onChange={(value) => openWorkspace(value as "identity" | "library" | "image")}
              trackColor="var(--bg-control-glass)"
              thumbColor="#0467FB"
              textColor="var(--text-primary)"
              activeTextColor="#ffffff"
              size="lg"
              radius={16}
              inset={0}
              equalSlots
              stretch={100}
              squash={3}
              speed={1}
              glide={75}
              draggable
              className="workspace-rubber-navigation"
              aria-label="切换工作区"
            />
          </nav>

          {activeWorkspace === "library" ? (
            <div className={`library-sticky-tools ${isLibraryStickyElevated ? "is-elevated" : ""}`}>
          <label className="library-search-wrap">
            <span className="sr-only">搜索提示词库</span>
            <div className="relative">
              <Search className="library-search-icon" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder="搜索提示词、标签、关键词"
                className="form-field library-search-field"
              />
            </div>
          </label>

          {recentQuickPrompts.length > 0 ? (
            <div className="library-recent-quick">
              <span>最近使用</span>
              <div className="no-scrollbar">
                {recentQuickPrompts.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    title={record.title || record.content.slice(0, 28)}
                    onClick={() => {
                      setSearchQuery("");
                      setAssetFilter("all");
                      setActiveTab("收藏");
                      setQuickPromptRequest({ id: record.id, token: Date.now() });
                    }}
                  >
                    {record.title || record.content.slice(0, 14)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="library-filter-group">
            <span>我的资产</span>
            <div>
              {([
                ["all", "全部"],
                ["favorite", "收藏"],
                ["folders", "我的收藏夹"]
              ] as Array<[PromptAssetFilter, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={assetFilter === id ? "is-active" : ""}
                  onClick={() => {
                    setAssetFilter(id);
                    setActiveTab("收藏");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

            </div>
          ) : null}

          <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={activeWorkspace}
            className="mt-4 space-y-4"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
            transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}
          >
            {searchQuery.trim() ? (
              <FavoritesStudio
                settings={settings}
                isServiceReady={isServiceReady}
                activeCategory="收藏"
                searchQuery={searchQuery}
                assetFilter={assetFilter}
                openPromptRequest={quickPromptRequest}
                onPreviewChange={handlePreviewChange}
                onOpenImageStudio={() => openWorkspace("image")}
              />
            ) : activeTab === "角色设定" ? (
              <RolePromptStudio settings={settings} isServiceReady={isServiceReady} onOpenImageStudio={() => openWorkspace("image")} />
            ) : activeTab === "收藏" ? (
              <FavoritesStudio
                settings={settings}
                isServiceReady={isServiceReady}
                activeCategory="收藏"
                assetFilter={assetFilter}
                openPromptRequest={quickPromptRequest}
                onPreviewChange={handlePreviewChange}
                onOpenImageStudio={() => openWorkspace("image")}
              />
            ) : activeTab === "图像生成" ? (
              <ImageStudio settings={settings} isServiceReady={isServiceReady} />
            ) : (
              <FavoritesStudio
                settings={settings}
                isServiceReady={isServiceReady}
                activeCategory="收藏"
                assetFilter={assetFilter}
                openPromptRequest={quickPromptRequest}
                onPreviewChange={handlePreviewChange}
                onOpenImageStudio={() => openWorkspace("image")}
              />
            )}
          </motion.div>
          </AnimatePresence>
          {activeWorkspace === "library" && showBackToTop ? (
            <button
              type="button"
              className="library-back-to-top"
              title="返回顶部"
              aria-label="返回顶部"
              onClick={() => contentScrollRef.current?.scrollTo({ top: 0, behavior: shouldReduceMotion ? "auto" : "smooth" })}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          ) : null}
        </motion.div>

        {tutorialOpen ? <NewUserTutorial rootRef={themeRootRef} initialIndex={tutorialInitialIndex} onNavigate={navigateTutorial} onClose={() => { setTutorialOpen(false); setTutorialInitialIndex(null); }} onSettingsTutorial={() => {
          chrome.runtime.sendMessage({ type: "open-options-page", tutorial: true }, () => {
            if (chrome.runtime.lastError) window.open(chrome.runtime.getURL("options.html?tutorial=settings"), "_blank", "noopener");
          });
        }} /> : null}
        <div className="workspace-toast-position">
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6, transition: { duration: shouldReduceMotion ? 0.06 : 0.45 } }}
              transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.toastEnterMs / 1000, ease: MOTION.easeOut }}
              className={`workspace-toast ${toast.tone === "error" ? "workspace-toast-error" : ""}`}
              role={toast.tone === "error" ? "alert" : "status"}
              aria-live={toast.tone === "error" ? "assertive" : "polite"}
              aria-atomic="true"
            >
              {toast.message}
            </motion.div>
          ) : null}
        </AnimatePresence>
        </div>
    </motion.section>
  );

  if (embedded) {
    return (
      <div className="h-full w-full">
        {panel}
      </div>
    );
  }

  return (
    <FloatingOverlay>
      {panel}
    </FloatingOverlay>
  );
}
