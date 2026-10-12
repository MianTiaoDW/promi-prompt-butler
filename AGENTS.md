# 提示词生成管家 - 项目规则

## 开始工作前

1. 先阅读 `docs/CODEX_HANDOFF.md`；它记录当前分支、已确认决策、未完成事项和跨设备接续命令。
2. 执行 `git status --short --branch` 和 `git log -5 --oneline --decorate`，以最新远程状态为准，不得用旧提交覆盖当前正式界面。
3. 最新正式插件以 `main` 为准，跨设备从最新 `main` 接续。

## 产品与技术

- Chrome/Edge Manifest V3 扩展；正式名称为“提示词生成管家”。
- React 18、TypeScript、Vite、Tailwind CSS、Framer Motion、react-rnd、CRXJS。
- `src/background/` 处理 LLM、生图、示例图 IndexedDB 和窗口消息。
- `src/content/` 是注入网页的工作台；`src/options/` 是配置中心；`src/popup/` 是工具栏入口。
- 结构化设置和提示词数据使用 `chrome.storage.local`；会话状态使用 `chrome.storage.session`；持久示例图 Blob 使用扩展 Origin 的 IndexedDB。
- 所有 AI 请求必须经 Background Service Worker，不在 Content Script 直连外部 API。

## 修改边界

- 组件使用函数式组件和 hooks；不引入新的状态库。
- 正式插件功能图标使用用户选定的 IconSax Bold 实心圆润系列，统一入口为 `src/components/PromiIcons.tsx`；收藏状态沿用颜色反馈，缺失语义使用同风格补充图标。来源与许可见 `docs/ICONSAX_NOTICE.md`，避免混入其他风格。
- 只修改任务要求涉及的文件，不顺手重构相邻代码。
- 不新增未经确认的账号、云同步、容量或在线状态等产品能力。
- 生成图片自动保存到本地创作历史，插件内保留最新 50 条；下载图片另存到下载目录。
- 不提交 `.env*`、API Key、`.claude/`、`.firecrawl/`、`node_modules/`、`dist/` 或临时日志。

## 视觉规则

- 正式插件当前本地视觉是功能基准，不能依据旧 README 或旧截图回退。
- 普通正文优先可读性；光学材质只用于明确的高层控制和视觉实验，不全局玻璃化。

## 验证

```powershell
npm install
npm run typecheck
npm run build
```

- 静态检查和构建通过不等于浏览器验收通过。
- 修改正式插件交互后，仍需在 Chrome/Edge 加载 `dist`，实际走完受影响流程。
