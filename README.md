<p align="center"><img src="icons/icon128.png" width="88" alt="Promi 提示词管家" /></p>
<h1 align="center">Promi 提示词管家</h1>
<p align="center">把想法写成提示词，把提示词变成图片，把好用的内容留在自己的库里。</p>
<p align="center"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
<p align="center">
  <a href="https://github.com/MianTiaoDW/promi-prompt-butler/releases"><img src="https://img.shields.io/badge/version-1.5.0-0467FB" alt="v1.5.0" /></a>
  <img src="https://img.shields.io/badge/Chrome%20%2F%20Edge-MV3-0467FB" alt="Chrome / Edge MV3" />
  <img src="https://img.shields.io/badge/Windows%20%2F%20macOS-supported-0467FB" alt="Windows / macOS" />
</p>
<p align="center"><a href="https://github.com/MianTiaoDW/promi-prompt-butler/releases">下载测试版</a> · <a href="docs/使用指南.md">使用指南</a> · <a href="https://github.com/MianTiaoDW/promi-prompt-butler/issues">反馈问题</a></p>

Promi 是一个面向有提示词管理收藏需求用户的，兼备AI 绘画创作的 Chrome／Edge 浏览器扩展。它把提示词管理、AI 提示词创作和图片生成放在同一个工作台中，支持日间、夜间和跟随系统主题。

当前分享版本为 **v1.5.0**。请您使用自己的模型服务和 API Key；插件不附带模型额度，实际支持的模型及生图参数取决于服务商。

## 三个工作区

| 工作区 | 可以做什么 |
| --- | --- |
| 提示词库 | 搜索、新建多步骤提示词组、复制、编辑、点赞、排序、收藏夹整理和 ZIP 备份。 |
| 创作 | 输入想法，选择专家身份、专业工作流和模型，生成中文提示词、英文 Prompt 与结构化 JSON，再编辑、保存或发送到图像工坊。 |
| 图像工坊 | 修改图片提示词，选择比例、分辨率和张数，生成、取消任务、预览、复制、下载与查看创作历史。 |

## 主要功能

- **画重点**：选中文字后，可设置背景高亮或文字颜色。提供 10 组阅读预设和自定义 HSV／HEX 色板，背景可调不透明度，支持明暗预览、对比度提示及一键调整。标记单独保存，复制和发送给模型仍是纯文字。[使用与测量说明](docs/PROMPT_EMPHASIS.md)。v1.5.0 测试包已包含此功能。

- **参考图**：点击添加或直接拖入，最多 8 张，按传入顺序排列。
- **收藏夹**：支持十种颜色、拖动排序、双击标题原地改名。移出当前收藏夹只取消关联，提示词仍在“全部”中；删除收藏夹不会删除提示词。
- **示例图**：每条提示词最多 3 张。悬停显示眼睛，点击查看大图；右上角叉号删除图片，“设为示例图”切换卡片封面。大图支持复制和下载，JPEG／WebP 复制时转换为 PNG。
- **导入与备份**：ZIP／JSON 导入可选追加或覆盖；追加跳过重复，覆盖再次确认后替换提示词和收藏夹。导出 ZIP 保留提示词、收藏夹、排序与示例图。
- **创作历史**：插件内保留最新 50 张，最新在前，关闭重开仍保留。生成图片自动保存到浏览器下载目录的 `prompt-butler/创作历史`，手动下载保存到 `prompt-butler/下载图片`；超出 50 张的旧图从插件列表移出，本地文件保留。
- **模型配置**：可分别设置文字、视觉和生图模型，以及生图专用地址／密钥。支持 Claude、Gemini、OpenAI、火山引擎、Kimi、DeepSeek 等服务商预设与 OpenAI 兼容中转站；平台列表提供官方 API 页面入口。
- **新手教程**：首次打开可跟随或跳过，之后通过顶部书本图标按六个章节重看；主页面和设置页之间可切换对应章节。
- **视觉反馈**：蓝色操作按钮、明暗主题、玫红爱心点赞动效，以及欢迎、搜索、生成等待和失败时的果冻状态插图。

## 下载与安装

普通用户无需安装 Node.js，也无需编译源码。

1. 打开 [Releases](https://github.com/MianTiaoDW/promi-prompt-butler/releases)，选择带插件安装 ZIP 附件的版本。
2. 下载 **Promi 测试包 ZIP** 并解压到固定位置。GitHub 自动附带的 `Source code` 是源码包，不是可直接加载的插件包。
3. Chrome 打开 `chrome://extensions/`；Edge 打开 `edge://extensions/`。
4. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择包内的 **`extension` 文件夹**。
5. 点击浏览器工具栏中的 Promi 图标，按新手教程开始。

保留解压目录，使用期间不要移动或删除。更新前可先导出提示词备份，再将新版 `extension` 的内容更新到原加载目录，点击“重新加载”；保持原目录和扩展 ID，继续使用原有本地数据。

## 第一次使用

1. 点击顶部齿轮打开设置，选择服务商；右侧“API 平台”可前往官网注册、选择模型并创建密钥。
2. 填写 API Key、接口地址和模型 ID，保存配置并测试连接。API 平台网页地址与 Base URL 不是同一个地址。
3. 在“创作”描述想法、添加参考图，选择专家身份与工作流后生成提示词。
4. 编辑、复制或保存结果，点击“开始创作”进入图像工坊生成图片。

只整理自己的提示词不需要发起 AI 请求；生成和 AI 优化会使用你配置的模型服务。测试包不包含作者的密钥或个人数据。

## 窗口置顶

| 系统 | 使用方式 |
| --- | --- |
| Windows | 可选安装包内 `windows-pin/install.cmd`，按提示输入自己电脑上的扩展 ID，安装后重新加载扩展，再点击图钉。不需要 Node.js 或 .NET SDK。 |
| macOS | 新版 Chrome／Edge 点击图钉打开 Document Picture-in-Picture 置顶工作台，无需 Windows 辅助程序；浏览器需支持该 API。 |

macOS 使用时需保留原插件窗口；关闭或刷新原窗口会关闭小窗。各窗口未保存的输入独立，已保存数据共用扩展存储。置顶不可用不影响其他主要功能。

## 数据保存在什么地方

提示词、收藏夹和设置保存在当前浏览器扩展的本地存储，示例图保存在扩展的 IndexedDB。生成图片同时按上述目录保存到本地。

GitHub 同步的是项目代码，不会同步浏览器中的 API Key、个人提示词或历史。需要迁移提示词时使用 ZIP 导出／导入；不要把密钥或包含密钥的截图发到 Issues。

## 从源码构建

需要 Node.js 和 npm。

```bash
git clone https://github.com/MianTiaoDW/promi-prompt-butler.git
cd promi-prompt-butler
npm ci
npm run build
```

在扩展管理页加载生成的 **`dist` 文件夹**。开发时使用 `npm run dev`，类型检查使用 `npm run typecheck`。制作朋友测试包可在 PowerShell 中运行 `./scripts/package-test.ps1`，输出到本地 `exports/`。

技术栈：React 18、TypeScript 5、Vite 5、Tailwind CSS 3、Framer Motion 12、CRXJS／Manifest V3。AI 请求经后台 Service Worker 处理。

## 文档与反馈

- [使用指南](docs/使用指南.md)：按界面介绍日常操作。
- [版本说明](docs/RELEASE_v1.5.0.md)：本版变化与安装方式。
- [文档导航](docs/README.md)、[项目结构](docs/PROJECT_STRUCTURE.md)、[开发交接](docs/CODEX_HANDOFF.md)。
- [提交问题](https://github.com/MianTiaoDW/promi-prompt-butler/issues)：请说明系统、浏览器、版本、操作步骤和实际结果，附上隐藏密钥后的截图。
- [图标来源与许可](docs/ICONSAX_NOTICE.md)。
