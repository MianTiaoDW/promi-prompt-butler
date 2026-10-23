import React, { useCallback, useEffect, useRef, useState } from "react";
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
const isFloatingWindow = new URLSearchParams(window.location.search).get("floating") === "1"
  && window.parent !== window;
const isMac = navigator.platform.toLowerCase().includes("mac");

interface PictureInPictureWindow extends Window {
  documentPictureInPicture?: {
    requestWindow(options: { width: number; height: number }): Promise<Window>;
  };
}

function AppWindow() {
  const [isPinned, setIsPinned] = useState(isFloatingWindow);
  const floatingWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (isMac) return;
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
    if (isMac) {
      if (!nextPinned) {
        if (isFloatingWindow) window.top?.close();
        else floatingWindow.current?.close();
        return true;
      }
      const pictureInPicture = (window as PictureInPictureWindow).documentPictureInPicture;
      if (!pictureInPicture) throw new Error("请使用支持画中画窗口的新版 Chrome 或 Edge 浏览器");
      if (floatingWindow.current && !floatingWindow.current.closed) {
        floatingWindow.current.focus();
        return true;
      }
      const popup = await pictureInPicture.requestWindow({ width: window.innerWidth, height: window.innerHeight });
      floatingWindow.current = popup;
      popup.document.title = "Promi 提示词管家";
      popup.document.body.style.cssText = "margin:0;width:100vw;height:100vh;overflow:hidden";
      const frame = popup.document.createElement("iframe");
      frame.title = "Promi 置顶工作台";
      frame.src = chrome.runtime.getURL("options.html?view=app&floating=1");
      frame.style.cssText = "border:0;width:100%;height:100%;display:block";
      popup.document.body.append(frame);
      popup.addEventListener("pagehide", () => {
        floatingWindow.current = null;
        setIsPinned(false);
      }, { once: true });
      setIsPinned(true);
      return true;
    }
    try {
      const response = await chrome.runtime.sendNativeMessage(
        WINDOW_NATIVE_HOST,
        { type: "window:set-always-on-top", enabled: nextPinned }
      ) as NativeWindowResponse;
      if (!response.ok || response.enabled !== nextPinned) {
        console.error("[Prompt Butler] 窗口置顶操作失败：", response.message);
        throw new Error(response.message || "置顶辅助程序未返回正确的窗口状态");
      }
      setIsPinned(response.enabled);
      return true;
    } catch (error) {
      console.error("[Prompt Butler] 无法连接窗口置顶组件：", error);
      throw error;
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
