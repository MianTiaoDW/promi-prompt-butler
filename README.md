<p align="center">
  <img src="icons/icon128.png" width="96" alt="提示词生成管家" />
</p>

<h1 align="center">提示词生成管家</h1>

<p align="center">
  一款用于生成、管理与复用高质量 AI 绘画提示词的高级浏览器插件。
  <br/>
  A Chrome extension for generating, organizing, and reusing high-quality AI art prompts.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white&style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?logo=googlechrome&logoColor=white&style=flat-square" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-0055FF?logo=framer&logoColor=white&style=flat-square" alt="Framer Motion" />
  <img src="https://img.shields.io/badge/IconSax-Bold-0467FB?style=flat-square" alt="IconSax Bold" />
  <img src="https://img.shields.io/badge/CRXJS-latest-FF6B35?logo=vite&logoColor=white&style=flat-square" alt="CRXJS" />
</p>

---

> **当前开发基准（2026-10-13）**：最新完整插件“Promi 提示词管家”位于 `main`。跨电脑接续先阅读 [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)，拉取最新 `main` 后执行 `npm ci`、`npm run build`，在 Chrome／Edge 加载或重新加载本机生成的 `dist/`。API 设置和浏览器内收藏数据不随 Git 同步。

---

## 📖 简介 | Introduction

**提示词生成管家** 是一个 Chrome 浏览器插件，能够将一句简单的需求自动扩写为专业级 AI 绘画提示词，输出中文段落、英文 Prompt 和结构化 JSON 三种格式。支持收藏夹管理、AI 一键优化、图像生成等功能。

**Prompt Butler** is a Chrome extension that transforms simple ideas into professional AI art prompts, outputting Chinese descriptions, English prompts, and structured JSON. It also features favorites management, AI optimization, and image generation.

---

## ✨ 功能 | Features

- **角色设定扩写** — 输入角色预设 + 用户需求，调用大模型生成三种格式的专业提示词
- **收藏夹管理** — 文件夹分类、搜索、导入/导出备份、AI 一键优化已有提示词
- **图像生成** — 提示词直出图片，支持单张/批量下载
- **收藏夹整理与排序** — 卡片可加入已有或新建收藏夹；拖动时半透明让位预览，松手保存顺序，重启后保留
- **一键置顶** — 将任意提示词移到列表最前面并保存顺序；返回顶部按钮为圆形箭头，不遮住末尾操作
- **配置中心** — 支持 Claude / Gemini / ChatGPT / Deepseek 等十余种服务商
- **日间／夜间主题** — 蓝色操作、IconSax Bold 圆润图标，图片操作使用磨砂半透明底；紧凑描述输入框带内置清空按钮

---

- **Prompt Expansion** — Input role preset + brief requirement, get 3 formatted professional prompts
- **Favorites System** — Folders, full-text search, import/export backups, AI one-click optimization
- **Image Generation** — Generate images directly from prompts, single/batch download
- **Persistent Ordering** — Drag cards or move a prompt to the top; retain ordering after restart
- **Provider Hub** — 10+ AI providers supported (Claude, Gemini, ChatGPT, Deepseek, etc.)
- **Light / Dark Themes** — Blue actions, rounded IconSax Bold icons, frosted image controls and compact input

---

## 🛠️ 技术栈 | Tech Stack

| 类别 | 技术 |
|---|---|
| 框架 | React 18, TypeScript 5 |
| 构建 | Vite 5, @crxjs/vite-plugin |
| 样式 | Tailwind CSS 3, Framer Motion 11 |
| 图标 | 本地 IconSax Bold SVG 与圆润语义补充（[来源与许可](docs/ICONSAX_NOTICE.md)） |
| 拖拽 | react-rnd |
| 存储 | chrome.storage.local |
| 架构 | Chrome Extension Manifest V3（Service Worker + Content Script + Options Page） |

---

## 🚀 安装 | Installation

### 开发者模式加载

1. 克隆仓库：
   ```bash
   git clone https://github.com/MianTiaoDW/prompt-butler.git
   cd prompt-butler
   git switch main
   ```

2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```

3. 打开 Chrome，进入 `chrome://extensions/`
4. 开启右上角 **开发者模式**
5. 点击 **加载已解压的扩展程序**，选择项目的 `dist` 目录

### 从 ZIP 安装

1. 下载并解压项目 ZIP 包
2. 在项目目录运行 `npm install && npm run build`
3. 按上述步骤 3-5 加载 `dist` 目录

---

## 📋 使用步骤 | Quick Start

### 1. 配置 API

打开插件 → 点击齿轮图标进入配置中心 → 选择服务商 → 填写 API Key → 测试连接 → 保存。

### 2. 生成提示词

切换到「角色设定」标签 → 输入角色预设 → 输入需求 → 点击生成。

### 3. 管理收藏

生成的提示词一键保存到收藏夹 → 在「收藏」标签中按文件夹整理、搜索、编辑或 AI 优化。

### 4. 导入/导出

在提示词库使用上传／下载按钮导入或导出备份。选择 ZIP 或 JSON 后，先选择导入方式：追加保留现有提示词并跳过重复；覆盖再次确认后替换当前提示词和收藏夹。导入结果会显示新增及跳过数量。

### 新手教程

首次打开工作台会显示教程，可随时跳过。顶部书本图标可再次打开，选择认识插件、提示词库、收藏夹、创作、图像工坊章节，或从头开始。另有独立“设置与模型接入”章节，会打开真实设置页，逐项高亮介绍配置功能；设置页顶部书本按钮可再次查看。教程不会自动填写密钥、保存配置或调用模型；支持日间、夜间主题。

服务商列表右侧的“API 平台”打开对应官方接入网页，方便注册、选择模型和创建密钥。点击官网按钮不会切换服务商；点击名称或行内其他位置才切换。OpenAI 兼容中转站没有固定官网，请使用你自己的服务商网站。

### Windows 窗口置顶

窗口置顶是可选功能，不安装辅助程序不影响其他功能。Windows 上需要先在扩展管理页复制当前扩展 ID，再在项目目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-native-host.ps1 -ExtensionId <你的扩展ID>
```

安装使用 Windows 自带的 .NET Framework，无需 .NET SDK。默认安装到公共目录下按用户 SID 分隔的英文路径；也可传 `-InstallDirectory` 指定可写的纯英文目录。重新加载扩展后点击顶部图钉。macOS 暂不支持窗口置顶。

更多细节见 [`docs/使用指南.md`](docs/使用指南.md)

---

## 📁 项目结构 | Project Structure

```
├── src/
│   ├── background/       # Service Worker（API 请求代理）
│   ├── content/          # Content Script（悬浮窗 UI）
│   ├── options/          # 配置中心页面
│   ├── popup/            # 弹窗页面
│   ├── hooks/            # 自定义 React Hooks
│   ├── lib/              # 工具函数（存储、提示词库、备份等）
│   └── types/            # TypeScript 类型定义
├── native/               # Windows 可选置顶辅助程序
├── icons/                # 扩展图标
├── docs/                 # 使用说明与跨设备交接
├── manifest.config.ts    # Manifest V3 配置
├── tailwind.config.ts    # Tailwind 配置
└── vite.config.ts        # Vite / CRXJS 构建配置
```

完整职责说明见 [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)。

---

## 🔧 开发 | Development

```bash
# 开发模式（热更新）
npm run dev

# 类型检查
npm run typecheck

# 生产构建
npm run build
```

构建后在 `chrome://extensions/` 中点击扩展的刷新按钮即可更新。

---

## 📄 License

MIT
