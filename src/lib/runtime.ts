import type { RuntimeRequestMessage } from "../types/runtime";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function sendRuntimeMessage<TResponse>(message: RuntimeRequestMessage) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("当前环境不支持 chrome.runtime.sendMessage。");
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await new Promise<TResponse>((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response: TResponse) => {
          const runtimeError = chrome.runtime.lastError;

          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          resolve(response);
        });
      });

      return result;
    } catch (error) {
      const isConnectionError =
        error instanceof Error && error.message.includes("Receiving end does not exist");

      if (isConnectionError && attempt < maxAttempts) {
        await delay(1000 * attempt);
        continue;
      }

      throw error;
    }
  }

  throw new Error("连接后台服务失败，请刷新页面后重试。");
}

export function sendRuntimeMessageLong<TResponse>(
  message: RuntimeRequestMessage,
  pollFn: () => Promise<TResponse | null>
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    // 长连接需要实际发送消息，才能重置 Service Worker 的闲置计时。
    const keepAlivePort = chrome.runtime.connect({ name: "long-task" });
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    const stopKeepAlive = () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    };
    keepAlivePort.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      stopKeepAlive();
      // Worker 断开时依赖任务轮询恢复，不重复发送收费生成请求。
    });
    keepAliveTimer = setInterval(() => {
      try { keepAlivePort.postMessage({ type: "task:keep-alive" }); }
      catch { stopKeepAlive(); }
    }, 20000);

    const cleanup = () => {
      stopKeepAlive();
      if (poll) clearInterval(poll);
      poll = null;
      try {
        keepAlivePort.disconnect();
      } catch {
        // Port 已随 Popup 关闭或 Worker 重启断开。
      }
    };

    // 先尝试 sendMessage（Worker 活跃时最快）
    chrome.runtime.sendMessage(message, (response: TResponse) => {
      const runtimeError = chrome.runtime.lastError;
      if (!settled && !runtimeError && response) {
        settled = true;
        cleanup();
        resolve(response);
      }
    });

    // 同时启动轮询（Worker 被杀后靠这个拿到结果）
    let attempts = 0;
    const maxAttempts = 150; // 最多轮询 150 次（300 秒）
    poll = setInterval(async () => {
      if (settled) {
        cleanup();
        return;
      }
      attempts++;
      try {
        const result = await pollFn();
        if (result && !settled) {
          settled = true;
          cleanup();
          resolve(result);
        }
      } catch {
        // 轮询失败继续重试
      }
      if (attempts >= maxAttempts) {
        cleanup();
        if (!settled) {
          settled = true;
          reject(new Error("请求超时，请重试。"));
        }
      }
    }, 2000);
  });
}
