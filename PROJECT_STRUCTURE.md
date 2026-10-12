# 项目目录结构说明

更新日期：2026-10-12。当前跨设备接续状态见 [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)。

```text
.
├─ manifest.config.ts                 # Manifest V3 配置
├─ vite.config.ts                     # Vite + CRXJS 构建
├─ package.json                       # 正式插件依赖与命令
├─ src/
│  ├─ background/                     # Service Worker、LLM/生图代理、示例图 IndexedDB
│  ├─ content/                        # 网页内工作台、提示词库、图像工坊与 Modal
│  ├─ options/                        # 模型配置中心
│  ├─ popup/                          # 工具栏入口
│  ├─ hooks/                          # Chrome storage 与界面 hooks
│  ├─ lib/                            # 存储、备份、Prompt、图片和消息工具
│  ├─ styles/                         # 正式插件全局样式
│  └─ types/                          # 共享 TypeScript 类型
├─ native/PromptButler.TopMostHost/   # Windows 可选原生置顶辅助程序
├─ scripts/                           # 安装、卸载与数据回归测试脚本
├─ docs/
│  ├─ CODEX_HANDOFF.md                # 跨设备唯一交接入口
│  └─ 使用指南.md
└─ icons/                             # 正式扩展图标
```

## 数据边界

- 设置、Prompt、收藏夹：`chrome.storage.local`。
- 工作台/窗口会话：`chrome.storage.session` 或当前 React 状态。
- 用户明确保存的示例图片：Background 管理的扩展 Origin IndexedDB Blob；Prompt 记录只保存图片 ID。
- 生图结果自动写入本地创作历史，插件内按最新优先保留 50 条。

## 构建边界

- 根目录 `npm run build` 构建正式扩展。
- `dist/`、`node_modules/`、本机设置和临时日志均为可再生或私有内容，不进入 Git。

## 当前完成状态

- 正式插件已包含提示词生成、提示词库/收藏管理、AI 优化、图像工坊、持久创作历史、配置中心、示例图保存，以及 Windows 可选置顶支持。
- 新安装会写入 6 条未点赞、未归入文件夹的预设提示词。
- 当前浏览器真实验收仍应在目标电脑加载最新 `dist` 后执行；构建通过不能替代该步骤。
