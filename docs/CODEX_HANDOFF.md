# Codex 跨设备交接（唯一入口）

更新日期：2026-10-10

最新开发分支：`codex/optical-fidelity-lab`

仓库：`https://github.com/MianTiaoDW/prompt-butler`

## 先说结论

- GitHub 的 `origin/main` 目前仍是旧版；不要在公司电脑直接从 `main` 继续。
- 在当前分支合并前，`origin/codex/optical-fidelity-lab` 是正式插件最新功能、四套隔离 Design Lab、测试截图和交接文档的共同基准。
- Codex 聊天记录和本机安装的 Skill 不由 Git 同步。本文件把继续工作所需的决策和边界写入仓库，公司 Codex 不应依赖旧聊天猜测。

## 2026-10-10 最新正式插件

以本分支当前 `src/` 为准：黑色背景、灰色层级、绿色操作，导航为提示词库／创作／图像工坊。

- 移除旧的 186 条内置提示词及自动导入入口；用户收集的内容保留。
- 分类支持新增、重命名、删除；删除分类时内容移回收藏。
- 手动提示词组支持标题、备注、多步骤，步骤卡片可复制、编辑、删除；整组可再次编辑。
- 手动组不显示创作专用英文／JSON／状态／AI 操作，示例图显示在外层卡片右侧。
- 编辑弹窗定位到插件窗口内，避开顶部栏，内容内部滚动。
- 全部页支持 ZIP 导入导出：`prompts.json` 与 `images/`，兼容旧 JSON 及 chaoyouqu ZIP。

验证：生产构建通过；隔离浏览器验证组编辑和导入界面；用户提供的 ZIP 通过 12 组／1 图导入、去重、导出再导入测试。真实 API 和原生置顶未在本轮重新验收。

另一台电脑必须执行 `npm ci` 和 `npm run build`，再在 Chrome 加载该电脑项目的 `dist/`。源码拉取不会自动重建插件。浏览器里的 API 设置和提示词数据不随 Git 同步，提示词与示例图使用 ZIP 导出／导入迁移。

## 另一台电脑首次接续

```powershell
git clone https://github.com/MianTiaoDW/prompt-butler.git
cd prompt-butler
git fetch origin
git switch --track origin/codex/optical-fidelity-lab
npm install
npm run typecheck
npm run build
```

若公司电脑已经克隆过旧仓库：

```powershell
git status --short --branch
git fetch origin
git switch codex/optical-fidelity-lab
git pull --ff-only
npm install
npm run build
```

切分支前若 `git status` 有公司电脑自己的修改，不要覆盖；先提交到独立分支或暂存并说明来源。

给另一台电脑 Codex 的第一条指令：

> 完整阅读 `AGENTS.md`、`docs/CODEX_HANDOFF.md`、`README.md`，检查当前分支、Git 状态和最近提交。以 `codex/optical-fidelity-lab` 为最新基准，不要用旧版 main 回退。当前正式插件采用黑绿配色，以 src/ 下最新代码为准；设计实验和旧截图不应覆盖正式界面。

## 仓库中已经保留的内容

### 正式插件

- 提示词生成、中文/英文/结构化结果、Prompt 预览与保存。
- 提示词库、收藏夹、搜索、导入/导出、编辑、复制和 AI 优化。
- 图像工坊、生成历史、下载、Prompt 保存和示例图显式保存。
- 配置中心、服务商健康检查、模型发现以及 Background 请求编排。
- Windows 可选原生置顶辅助程序及安装/卸载脚本。
- `ui-pattern-atlas/` 站内 UI 知识图谱。

数据事实：设置和 Prompt 使用 `chrome.storage.local`；会话状态使用 `chrome.storage.session`；明确保存的示例图 Blob 使用扩展 Origin IndexedDB。不存在账号、云同步、云容量或跨电脑自动数据同步。

### 隔离视觉实验

1. `design-lab/apple-optical-library/`
   - 420 单列、680 双栏、980 三栏。
   - Hover、Selected、Pressed、Loading、AI Inspector、Modal、reduced-motion、reduced-transparency。
   - 截图与 `IMPLEMENTATION_SPEC.md` 已保留。
2. `design-lab/optical-fidelity-lab/`
   - 光学上传、命令栏、Prompt 卡片、AI Processing 与图标系统。
   - 多轮 Hero Icon 候选、可编辑 SVG、100%/小尺寸检查图、原始生产素材和来源审计。
   - 根目录旧命名截图已归档为 `artifacts/optical-fidelity-lab-overview-legacy.png`。
3. `design-lab/visual-integration-lab-v1/`
   - 保留 420 / 680 / 980 创作与提示词库母版、Gradient Ribbon Glyph 历史实验和功能动态图标研究。
   - 新增搜索、设置、复制、收藏、删除、展开、显隐、下载的语义动效页与 Reduced Motion 版本。
   - `output/playwright/46`–`48` 是该功能图标实验的 Chromium 验收截图。
4. `design-lab/apple-prompt-studio/`
   - 当前用户认可的 Apple 竖屏视觉方向；独立运行于 `http://127.0.0.1:4180/`。
   - 保持创作、提示词库、图像工坊三条主路径，并恢复正式插件的主要功能入口、状态与操作层级。
   - 提示词详情右上角只保留关闭；收藏、编辑、删除位于正文下方同级操作栏，不再提供多余的显隐和结构展开按钮。
   - 浅色使用克制的 Frost 表面；暗色使用深黑半透明光学材质、受控红绿环境色和弱内高光。竖屏关闭整窗高成本模糊，只在关键表面保留模糊。
   - 六枚冻结 Ribbon Glyph 不进入本原型；只使用 IconSax 线性功能图标。
   - Prompt、图库和生成结果仍为 Mock；只有原型设置写入自己的 `localStorage`，不接 Chrome Storage、Background 或真实 AI API。

四套 Lab 都不进入正式插件构建，不得未经用户明确批准自动迁移到 Manifest、Content Script、Background、Chrome Storage 或 API。

## 当前视觉优先级

1. `apple-prompt-studio` 是当前继续迭代的首选视觉原型。
2. 正式插件 `src/` 是功能、数据流和真实 API 行为基准；不要用原型 Mock 取代它。
3. `visual-integration-lab-v1` 只作为历史布局、功能图标和冻结 Ribbon Glyph 的研究来源，不再主导当前页面风格。
4. `apple-optical-library` 与 `optical-fidelity-lab` 作为可追溯研究保留，不自动合并到当前 Apple 竖屏方向。

## 当前 Hero Icon 决策

- 系列使用深黑/深蓝黑大圆角光学底板；内部符号冷蓝为主、少量紫色，冰白只做高光核心。
- 禁止整块偏紫、平均紫色外圈、绿色幕布成品、廉价通用线性图标造型和过度发光。
- 内部符号先保证可理解，再增加克制的树脂、折射、遮挡和纹理。
- AI Spark：两枚相扣弧形主体与右上圆点。
- Upload：文件穿过水平轨道/门环并带底部圆点。
- Processing：三个旋转弧段，中心必须干净，不得出现小箭头。
- Warning、Success、Command Entry 仍需继续做小尺寸语义验收。

候选顺序：

1. `artifacts/hero-icon-shape-study-v8.svg/.png`：手工 SVG 结构草案，检查语义、比例和 64/48px 可读性；不是最终材质。
2. `artifacts/hero-icon-material-bright-v7.png`：当前高亮材质候选；尚未最终确认。
3. `artifacts/hero-icon-full-redesign-v6.png`：上一版回退稿。

用户明确说“OK”前，不拆分为正式插件资产，不迁移代码。

## 继续图标工作时所需 Skill

- 必须优先使用：`apple-design`、`emil-design-eng`。
- 适合审查/设计指导：`ai-design-director`、`design-audit`、`ui-pattern-atlas`。
- 需要生成或编辑位图时：`imagegen`。

这些 Skill 是 Codex 本机安装项，不在 Git 仓库内。公司电脑缺失时需另行安装；缺失并不影响拉取、构建和阅读已有资产。

## 验证命令

正式插件：

```powershell
npm run typecheck
npm run build
```

Apple Optical Library：

```powershell
npx vite design-lab/apple-optical-library --host 127.0.0.1 --port 4178
```

Optical Fidelity Lab：

```powershell
npm --prefix design-lab/optical-fidelity-lab install
node node_modules/vite/bin/vite.js design-lab/optical-fidelity-lab --host 127.0.0.1 --port 4179
```

Apple Prompt Studio：

```powershell
npm --prefix design-lab/apple-prompt-studio install
npm --prefix design-lab/apple-prompt-studio run build
npm --prefix design-lab/apple-prompt-studio run dev
```

Visual Integration Lab：

```powershell
npm --prefix design-lab/visual-integration-lab-v1 install
npm --prefix design-lab/visual-integration-lab-v1 run assets
npm --prefix design-lab/visual-integration-lab-v1 run build
```

2026-07-24 本地验证：正式插件 `npm run typecheck` 与 `npm run build` 通过；Apple Prompt Studio 生产构建通过；Visual Integration Lab 的 `npm run assets` 与 `npm run build` 通过。在 535 × 698 竖屏视口实操检查 Apple Prompt Studio 的创作、提示词库、收藏夹、图像工坊、模型设置、提示词详情和明暗切换，浏览器无 error / warning；暗色创作页与详情弹层已完成视觉检查。实验页 Tailwind 空 `content` 提示和 Framer Motion 的 `use client` 被 Vite 忽略均为既有非阻塞构建警告。

静态构建不能替代 Chrome/Edge 实际验收；另一台电脑首次接续后若修改正式插件，应加载最新 `dist`，至少检查打开工作台、配置状态、提示词生成、收藏、图像工坊、显式保存示例图和可选置顶流程。

已知但本轮不擅自修改的问题：根 `package.json` 版本为 `1.2.0`，`manifest.config.ts` 仍为 `1.0.3`。这是当前代码中的元数据不一致，不影响本地构建，但下次正式发布前必须统一版本号并明确发布策略。

## 不进入 GitHub 的内容

- `node_modules/`、所有 `dist/`、本机 `.claude/`、`.firecrawl/`、临时日志、`.env*`、ZIP 与 DOCX。
- `.playwright-cli/` 和各 Lab 的 `output/build/` 属于本机构建缓存；只有明确作为视觉验收证据的 `output/playwright/*.png` 进入 Git。
- 这些内容是可再生构建产物、本机私有配置或非源码附件；缺少它们不影响公司电脑从仓库恢复项目。
