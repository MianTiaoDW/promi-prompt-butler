import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { OverlayApp } from "../content/OverlayApp";
import { OptionsApp } from "./OptionsApp";
import "../styles/tailwind.css";

const WINDOW_NATIVE_HOST = "com.promptbutler.window";

interface NativeWindowResponse {
  ok: boolean;
  enabled?: boolean;
  message?: string;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Options root element was not found.");
}
const appRootElement = rootElement;

const isAppWindow = new URLSearchParams(window.location.search).get("view") === "app";

function AppWindow() {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void chrome.runtime.sendNativeMessage(
      WINDOW_NATIVE_HOST,
      { type: "window:get-always-on-top" }
    ).then((response: NativeWindowResponse) => {
      if (!cancelled && response.ok) {
        setIsPinned(response.enabled === true);
      }
    }).catch(() => {
      // 安装程序不可用时保持默认状态，用户点击置顶后再给出明确反馈。
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePinnedChange = useCallback(async (nextPinned: boolean) => {
    try {
      const response = await chrome.runtime.sendNativeMessage(
        WINDOW_NATIVE_HOST,
        { type: "window:set-always-on-top", enabled: nextPinned }
      ) as NativeWindowResponse;
      if (!response.ok || response.enabled !== nextPinned) {
        console.error("[Prompt Butler] 窗口置顶操作失败：", response.message);
        return false;
      }
      setIsPinned(response.enabled);
      return true;
    } catch (error) {
      console.error("[Prompt Butler] 无法连接窗口置顶组件：", error);
      return false;
    }
  }, []);

  const closeAppWindow = useCallback(() => {
    window.close();
  }, []);

  return (
    <main className="app-window h-screen w-screen overflow-hidden text-primary">
      <OverlayApp
        embedded
        appWindow
        pinned={isPinned}
        onPinnedChange={handlePinnedChange}
        onClose={closeAppWindow}
      />
    </main>
  );
}

createRoot(appRootElement).render(
  <React.StrictMode>
    {isAppWindow ? <AppWindow /> : <OptionsApp />}
  </React.StrictMode>
);
