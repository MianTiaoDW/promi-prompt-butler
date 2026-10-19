import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Promi 提示词管家",
  description: "用于生成、管理与复用高质量提示词的高级浏览器插件。",
  version: "1.3.1",
  permissions: ["storage", "downloads", "activeTab", "scripting", "nativeMessaging"],
  host_permissions: ["<all_urls>"],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle"
    }
  ],
  options_page: "options.html",
  action: {
    default_title: "Promi 提示词管家",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
});
