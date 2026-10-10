import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent
} from "react";
import { AnimatePresence, motion, Reorder, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Pin, Plus, Search, Settings, Trash2, X } from "lucide-react";

import { FavoritesStudio } from "./FavoritesStudio";
import { ImageStudio } from "./ImageStudio";
import { RolePromptStudio } from "./RolePromptStudio";
import { FloatingOverlay } from "./FloatingOverlay";
import {
  addCustomTab,
  cleanupInvalidTabs,
  CORE_TABS,
  DEFAULT_PROMPT_TABS,
  deleteTab,
  getCustomTabs,
  getVisibleTabs,
  renameCustomTab,
  saveTabOrder,
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
  activeTab: DEFAULT_PROMPT_TABS[0],
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
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_PROMPT_TABS[0]);
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
  const [customTabs, setCustomTabs] = useState<string[]>([]);
  const [visibleTabs, setVisibleTabs] = useState<string[]>(DEFAULT_PROMPT_TABS.slice());
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [tabNameDraft, setTabNameDraft] = useState("");
  const [editingTabName, setEditingTabName] = useState<string | null>(null);
  const [panelErrorMessage, setPanelErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastEvent | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRestoredRef = useRef(false);
  const popupSessionRef = useRef<OverlaySessionState>(defaultOverlaySessionState);
  const navRef = useRef<HTMLElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const categoryTabRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startScrollLeft: number;
  }>({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0
  });
  const isReorderingRef = useRef(false);
  const persistUiState = useCallback((state: OverlaySessionState) => {
    return embedded && !appWindow
      ? sessionStorageSet(POPUP_SESSION_KEY, state)
      : storageSet(OVERLAY_UI_STATE_KEY, state);
  }, [appWindow, embedded]);

  useEffect(() => {
    void cleanupInvalidTabs().then(() => {
      void getCustomTabs().then(setCustomTabs);
      void getVisibleTabs().then(setVisibleTabs);
    });
  }, []);

  useEffect(() => {
    const refreshCategories = () => {
      void getCustomTabs().then(setCustomTabs);
      void getVisibleTabs().then(setVisibleTabs);
    };
    window.addEventListener("prompt-library-updated", refreshCategories);
    return () => window.removeEventListener("prompt-library-updated", refreshCategories);
  }, []);

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
      setActiveTab(stored.activeTab);
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
      }, event.tone === "error" ? 3600 : 2000);
    });
  }, []);

  useEffect(() => () => {
    if (sessionWriteTimerRef.current) clearTimeout(sessionWriteTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const libraryTabs = visibleTabs.filter((tab) => !CORE_TABS.includes(tab));
  const activeCategoryIndex = libraryTabs.indexOf(activeTab);
  const canSelectPreviousCategory = activeCategoryIndex > 0;
  const canSelectNextCategory = activeCategoryIndex < libraryTabs.length - 1;
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

  const ensureActiveCategoryVisible = useCallback((behavior: ScrollBehavior) => {
    const nav = navRef.current;
    const selectedTab = categoryTabRefs.current.get(activeTab);
    if (!nav || !selectedTab) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = selectedTab.getBoundingClientRect();
    const leftBoundary = navRect.left + (canSelectPreviousCategory ? 44 : 0);
    const rightBoundary = navRect.right - (canSelectNextCategory ? 44 : 0);

    if (tabRect.left < leftBoundary || tabRect.right > rightBoundary) {
      selectedTab.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
    }
  }, [activeTab, canSelectPreviousCategory, canSelectNextCategory]);

  useEffect(() => {
    if (activeWorkspace !== "library") return;
    const frame = window.requestAnimationFrame(() => {
      ensureActiveCategoryVisible("smooth");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeWorkspace, ensureActiveCategoryVisible]);

  useEffect(() => {
    if (activeWorkspace !== "library") return;
    const nav = navRef.current;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(() => ensureActiveCategoryVisible("auto"));
    resizeObserver.observe(nav);
    return () => resizeObserver.disconnect();
  }, [activeWorkspace, ensureActiveCategoryVisible]);

  const tabPromptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of libraryTabs) {
      counts[tab] = favorites.filter(
        (r) => r.category === tab || r.category.startsWith(`${tab}/`)
      ).length;
    }
    return counts;
  }, [favorites, libraryTabs]);

  const handleCreateTab = async () => {
    try {
      setPanelErrorMessage("");
      const next = await addCustomTab(tabNameDraft);
      setCustomTabs(next);
      setVisibleTabs(await getVisibleTabs());
      setIsCreatingTab(false);
      setTabNameDraft("");
      setActiveTab(tabNameDraft.trim());
    } catch (error) {
      setPanelErrorMessage(error instanceof Error ? error.message : "创建失败。");
    }
  };

  const handleRenameTab = async (oldName: string) => {
    try {
      setPanelErrorMessage("");
      const next = await renameCustomTab(oldName, tabNameDraft);
      setCustomTabs(next);
      setVisibleTabs(await getVisibleTabs());
      const newName = tabNameDraft.trim();
      if (activeTab === oldName) {
        setActiveTab(newName);
      }
      setEditingTabName(null);
      setTabNameDraft("");
    } catch (error) {
      setPanelErrorMessage(error instanceof Error ? error.message : "重命名失败。");
    }
  };

  const handleDeleteTab = async (name: string) => {
    const { customTabs: nextCustom, visibleTabs: nextVisible } = await deleteTab(name);
    setCustomTabs(nextCustom);
    setVisibleTabs(nextVisible);
    if (activeTab === name) {
      setActiveTab("收藏");
    }
    setEditingTabName(null);
    setTabNameDraft("");
  };

  const openWorkspace = (workspace: "identity" | "library" | "image") => {
    setSearchQuery("");
    if (workspace === "identity") {
      setActiveTab("角色设定");
      return;
    }

    if (workspace === "image") {
      setActiveTab("图像生成");
      return;
    }

    setActiveTab((current) =>
      current === "角色设定" || current === "图像生成" ? "收藏" : current
    );
  };

  const getTabLabel = (tab: string) => {
    if (tab === "角色设定") return "专家身份";
    if (tab === "收藏") return "提示词库";
    if (tab === "图像生成") return "图像工坊";
    return tab;
  };

  const openOptions = () => {
    chrome.runtime.sendMessage({ type: "open-options-page" }, () => {
      if (chrome.runtime.lastError) {
        window.open(chrome.runtime.getURL("options.html"));
      }
    });
  };

  const startHorizontalDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if (isReorderingRef.current || !navRef.current) return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: navRef.current.scrollLeft
    };
  };

  const moveHorizontalDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if (isReorderingRef.current || !navRef.current || !dragStateRef.current.isDragging) return;

    const distance = event.clientX - dragStateRef.current.startX;
    navRef.current.scrollLeft = dragStateRef.current.startScrollLeft - distance;
  };

  const endHorizontalDrag = () => {
    dragStateRef.current.isDragging = false;
  };

  const togglePinned = async () => {
    const nextIsPinned = !isPinned;
    const result = await onPinnedChange?.(nextIsPinned);
    if (result === false) {
      showToast("当前浏览器无法创建置顶窗口", "error");
      return;
    }
    if (pinned === undefined) {
      setInternalPinned(nextIsPinned);
      void storageSet(OVERLAY_PINNED_KEY, nextIsPinned);
    }
    showToast(nextIsPinned ? "工作台已置顶" : "已取消置顶");
  };

  const scrollCategories = (direction: -1 | 1) => {
    if (activeCategoryIndex < 0) return;
    const nextIndex = Math.min(
      libraryTabs.length - 1,
      Math.max(0, activeCategoryIndex + direction)
    );
    if (nextIndex !== activeCategoryIndex) setActiveTab(libraryTabs[nextIndex]);
  };

  const handleCategoryWheel = (event: ReactWheelEvent<HTMLElement>) => {
    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (horizontalDelta === 0) return;
    const nav = event.currentTarget;
    const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth);
    const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, nav.scrollLeft + horizontalDelta));
    if (Math.abs(nextScrollLeft - nav.scrollLeft) < 1) return;
    nav.scrollLeft = nextScrollLeft;
    event.preventDefault();
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
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.08 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}
      className={`glass-panel fluxora-shell accent-ring flex h-full flex-col overflow-hidden rounded-xl text-white ${isDocumentVisible ? "" : "is-document-hidden"}`}
    >
        <div className="fluxora-background" aria-hidden="true">
        </div>
        <header className={`glass-titlebar fluxora-titlebar flex h-14 items-center justify-between px-4 ${embedded ? "" : "drag-handle cursor-move"}`}>
          <div className="workspace-brand flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08]">
              <img src={iconUrl} alt="" className="h-9 w-9 rounded-xl" />
            </div>
            <div>
              <div className="workspace-brand-name text-sm font-semibold tracking-[-0.02em] text-white" title="提示词生成管家">
                提示词生成管家
              </div>
            </div>
          </div>
          <div className="workspace-system-controls flex items-center gap-2">
            <div data-no-drag className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs text-white/70">
              <span
                className={["connection-status-dot", statusDotClassName].join(" ")}
              />
              {statusBadgeText}
            </div>
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
            {(!embedded || appWindow) && onClose ? (
              <button type="button" onClick={onClose} className="icon-button" aria-label="关闭提示词生成管家" title="关闭">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        <div
          ref={contentScrollRef}
          className="aura-content fluxora-content flex-1 overflow-y-auto"
          onScroll={(event) => handleContentScroll(event.currentTarget.scrollTop)}
        >
          <nav className="workspace-switcher" aria-label="工作区">
            {[
              { id: "library", label: "提示词库" },
              { id: "identity", label: "创作" },
              { id: "image", label: "图像工坊" }
            ].map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => {
                  openWorkspace(workspace.id as "identity" | "library" | "image");
                }}
                className={[
                  "workspace-switcher-item",
                  activeWorkspace === workspace.id ? "workspace-switcher-item-active" : ""
                ].join(" ")}
              >
                {activeWorkspace === workspace.id ? (
                  <motion.span
                    layoutId="workspace-switcher-selection"
                    className="workspace-switcher-selection"
                    transition={{ duration: shouldReduceMotion ? 0 : MOTION.pageMs / 1000, ease: MOTION.easeOut }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="workspace-switcher-label">{workspace.label}</span>
              </button>
            ))}
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

          <div className="library-filter-label">分类</div>
          <div className="library-category-shell mt-4">
            <nav
              ref={navRef}
              className={[
                "library-category-bar no-scrollbar",
                canSelectPreviousCategory ? "library-category-bar-has-left" : "",
                canSelectNextCategory ? "library-category-bar-has-right" : ""
              ].join(" ")}
              style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" }}
              onWheel={handleCategoryWheel}
              onMouseDown={startHorizontalDrag}
              onMouseMove={moveHorizontalDrag}
              onMouseUp={endHorizontalDrag}
              onMouseLeave={endHorizontalDrag}
            >
          <Reorder.Group
            axis="x"
            values={libraryTabs}
            onReorder={async (newOrder: string[]) => {
              setVisibleTabs(newOrder);
              await saveTabOrder(newOrder);
            }}
            className="library-category-list flex w-max gap-2"
          >
            {libraryTabs.map((tab) => {
              const isCustom = !CORE_TABS.includes(tab);
              const isEditing = editingTabName === tab;

              if (isEditing) {
                return (
                  <Reorder.Item
                    key={tab}
                    value={tab}
                    as="span"
                    onDragStart={() => { isReorderingRef.current = true; }}
                    onDragEnd={() => { isReorderingRef.current = false; }}
                    className="library-category-item inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-accent/45 bg-black/25 px-3 py-1.5"
                  >
                    <input
                      value={tabNameDraft}
                      onChange={(event) => {
                        setTabNameDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleRenameTab(tab);
                        }
                        if (event.key === "Escape") {
                          setEditingTabName(null);
                          setTabNameDraft("");
                        }
                      }}
                      className="w-20 bg-transparent text-xs text-white outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleRenameTab(tab);
                      }}
                      className="rounded p-0.5 text-white/55 transition hover:text-accent"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteTab(tab);
                        }}
                        className="rounded p-0.5 text-white/55 transition hover:text-rose-300"
                        title="删除分类"
                        aria-label={`删除分类 ${tab}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTabName(null);
                        setTabNameDraft("");
                      }}
                      className="rounded p-0.5 text-white/55 transition hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Reorder.Item>
                );
              }

              return (
                <Reorder.Item
                  key={tab}
                  value={tab}
                  as="span"
                  className="library-category-item inline-flex items-center gap-1"
                  whileDrag={{
                    scale: 1.02,
                    zIndex: 50,
                    boxShadow: "var(--shadow-floating)"
                  }}
                  transition={{ duration: shouldReduceMotion ? 0 : MOTION.fastMs / 1000, ease: MOTION.easeOut }}
                  onDragStart={() => { isReorderingRef.current = true; }}
                  onDragEnd={() => { isReorderingRef.current = false; }}
                >
                  <button
                    ref={(node) => {
                      if (node) categoryTabRefs.current.set(tab, node);
                      else categoryTabRefs.current.delete(tab);
                    }}
                    type="button"
                    onClick={() => {
                      setAssetFilter("all");
                      setActiveTab(tab);
                    }}
                    onDoubleClick={
                      isCustom
                        ? () => {
                            setEditingTabName(tab);
                            setTabNameDraft(tab);
                          }
                        : undefined
                    }
                    title={isCustom ? "双击重命名" : undefined}
                    className={[
                      "library-category-tab inline-flex items-center gap-1.5 whitespace-nowrap",
                      activeTab === tab
                        ? "library-category-tab-active"
                        : ""
                    ].join(" ")}
                  >
                    {getTabLabel(tab)}
                    {tabPromptCounts[tab] !== undefined ? (
                      <span className={[
                        "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                        activeTab === tab
                          ? "bg-accent/25 text-accent"
                          : "bg-white/10 text-white/45"
                      ].join(" ")}>
                        {tabPromptCounts[tab]}
                      </span>
                    ) : null}
                  </button>
                </Reorder.Item>
              );
            })}

            {isCreatingTab ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-accent/45 bg-black/25 px-3 py-1.5">
                <input
                  value={tabNameDraft}
                  onChange={(event) => {
                    setTabNameDraft(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleCreateTab();
                    }
                    if (event.key === "Escape") {
                      setIsCreatingTab(false);
                      setTabNameDraft("");
                      setPanelErrorMessage("");
                    }
                  }}
                  placeholder="预设名称"
                  className="w-20 bg-transparent text-xs text-white outline-none placeholder:text-white/25"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCreateTab();
                  }}
                  className="rounded p-0.5 text-white/55 transition hover:text-accent"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingTab(false);
                    setTabNameDraft("");
                    setPanelErrorMessage("");
                  }}
                  className="rounded p-0.5 text-white/55 transition hover:text-rose-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingTab(true);
                  setTabNameDraft("");
                  setPanelErrorMessage("");
                }}
                className="whitespace-nowrap rounded-full border border-dashed border-white/15 bg-transparent px-3 py-2 text-sm text-white/45 transition hover:border-accent/40 hover:text-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            </Reorder.Group>
            </nav>
            {canSelectPreviousCategory ? (
              <div className="library-category-edge library-category-edge-left">
                <button
                  type="button"
                  aria-label="查看左侧分类"
                  onClick={() => scrollCategories(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {canSelectNextCategory ? (
              <div className="library-category-edge library-category-edge-right">
                <button
                  type="button"
                  aria-label="查看更多分类"
                  onClick={() => scrollCategories(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
            </div>
          ) : null}

          {panelErrorMessage ? (
            <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
              {panelErrorMessage}
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
                activeCategory={activeTab === "收藏" ? "收藏" : activeTab}
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
                activeCategory={activeTab}
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
              onClick={() => contentScrollRef.current?.scrollTo({ top: 0, behavior: shouldReduceMotion ? "auto" : "smooth" })}
            >
              <ArrowUp className="h-4 w-4" />返回顶部
            </button>
          ) : null}
        </div>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
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
