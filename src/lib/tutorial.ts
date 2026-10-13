export type TutorialWorkspace = "library" | "identity" | "image" | "folders";
export const TUTORIAL_SEEN_KEY = "prompt-butler-tutorial-seen-v1";
export const TUTORIAL_CHAPTERS = ["认识插件与配置", "提示词库", "收藏夹", "创作提示词", "图像工坊"];
export interface TutorialStep { chapter: number; title: string; text: string; target: string; workspace?: TutorialWorkspace; fallback?: string; }
export const TUTORIAL_STEPS: TutorialStep[] = [
  { chapter: 0, title: "三个工作区", text: "提示词库用来存和找提示词；创作用来把想法写成提示词；图像工坊用来生成图片。点击下一步认识各项功能。", target: ".workspace-navigation" },
  { chapter: 0, title: "先连接模型服务", text: "点击设置进入配置中心，填写服务地址和 API Key，选择文字、视觉和生图模型。保存配置并测试连接成功后，就可以生成。教程不会替你调用模型或产生费用。", target: "[aria-label='打开配置中心']" },
  { chapter: 0, title: "查看连接状态", text: "绿色在线表示连接测试成功；未配置或连接失败时，请回设置检查地址、密钥和模型。服务和密钥需要你自己准备。", target: ".workspace-status-pill" },
  { chapter: 0, title: "置顶和外观", text: "图钉让插件窗口保持在其他窗口上方。Windows 需要安装置顶辅助程序，macOS 暂不支持。太阳或月亮按钮可选日间、夜间或跟随系统。", target: ".workspace-system-controls" },
  { chapter: 1, title: "快速找到提示词", text: "输入标题、正文或标签关键词搜索。最近使用可以快速打开刚用过的提示词；全部、收藏和我的收藏夹分别查看不同内容。", target: ".library-search-wrap", workspace: "library", fallback: ".workspace-navigation" },
  { chapter: 1, title: "新建提示词组", text: "点击添加提示词，填写名称、备注和步骤。一个步骤放一段提示词，复杂流程可以添加多个步骤，再保存提示词组。", target: "[aria-label='添加提示词'], .prompt-add-button", workspace: "library", fallback: ".prompt-asset-section-heading" },
  { chapter: 1, title: "打开、复制与编辑", text: "点击卡片打开详情，查看和复制每一步；编辑可修改标题、备注和正文。图片上悬停出现眼睛，点击查看大图。没有卡片时，可先添加或导入提示词。", target: ".prompt-asset-card", workspace: "library", fallback: ".prompt-asset-section" },
  { chapter: 1, title: "点赞、排序和收藏", text: "爱心把提示词加入收藏。拖动手柄可排序，向上箭头可把提示词移到最前面。文件夹按钮可放入一个或多个收藏夹，垃圾桶删除提示词。", target: ".prompt-card-actions", workspace: "library", fallback: ".prompt-asset-section-heading" },
  { chapter: 1, title: "导入和导出", text: "导入支持 ZIP 和 JSON：追加保留已有内容并跳过重复，覆盖替换当前提示词和收藏夹。导出 ZIP 可以备份提示词、排序、文件夹和示例图，也能分享给朋友。", target: "[aria-label='导入提示词']", workspace: "library" },
  { chapter: 2, title: "建立收藏夹", text: "点击加号，直接在白色条内输入名称，再点击对勾确认。收藏夹可以按用途命名，例如角色、海报或修图。", target: ".prompt-folder-browser header", workspace: "folders" },
  { chapter: 2, title: "管理收藏夹", text: "点击文件夹查看里面的提示词；直接拖动文件夹调整顺序；双击标题原地改名。悬停显示右下角删除按钮，删除文件夹不会删除里面的提示词。", target: ".folder-float-grid", workspace: "folders", fallback: ".prompt-folder-browser header" },
  { chapter: 3, title: "描述你的想法", text: "用简单的话写主体、场景、风格和氛围。例如：一只小熊站在星空下，3D 卡通风格。写得越明确，生成越贴合你的想法。", target: "[aria-label='创意描述']", workspace: "identity" },
  { chapter: 3, title: "添加参考图", text: "点击添加参考图，或把图片拖进创意描述区域。最多 8 张，按传入顺序排列；缩略图上的叉号移除参考图。", target: ".creator-reference-button", workspace: "identity", fallback: ".creator-reference-toolbar" },
  { chapter: 3, title: "选择专业方向", text: "专家身份决定从什么角度帮你写；专业工作流决定处理方式；模型决定使用哪个服务模型。可以先用默认选择，熟悉后再调整。", target: ".creator-settings-panel", workspace: "identity" },
  { chapter: 3, title: "生成提示词", text: "点击生成后，AI 会把描述整理成提示词。真实生成会使用你配置的 API；按 Enter 只结束输入，不会自动发起生成。", target: ".creator-generate-button", workspace: "identity" },
  { chapter: 3, title: "修改和保存结果", text: "结果区可查看中文、英文和结构化内容。点击正文编辑，确认后保存修改；复制按钮复制内容，带加号的书签把提示词保存到提示词库。开始创作可把结果送到图像工坊。", target: ".creator-results-heading", workspace: "identity" },
  { chapter: 4, title: "设置生图参数", text: "图像比例决定画面形状，分辨率决定输出尺寸，生成数量决定一次出几张。按你的用途选择，具体支持范围以模型服务为准。", target: ".image-parameter-bar", workspace: "image" },
  { chapter: 4, title: "检查图片提示词", text: "这里可以修改用于生图的提示词。开始生成前检查内容；点击生图图片后等待完成，生成中可以用红色取消按钮停止任务。", target: ".image-prompt-input", workspace: "image" },
  { chapter: 4, title: "查看和保存图片", text: "生成结果显示在这里。点击图片看大图，大图中可复制或下载；也可以保存作品、保存 Prompt，或把图片设为提示词的示例图。", target: ".image-results-heading", workspace: "image", fallback: ".image-results-panel" },
  { chapter: 4, title: "创作历史与本地保存", text: "生成的图片自动保存到浏览器下载目录的 prompt-butler／创作历史，手动下载保存到下载图片文件夹。插件显示最新 50 张，最新在前；关闭重开仍保留。超出 50 张的旧图只从列表移出。", target: ".image-history-panel", workspace: "image", fallback: ".image-results-panel" },
  { chapter: 4, title: "随时回来查看教程", text: "你已经认识主要功能了！以后点击顶部圆形教程按钮，按章节查看不熟悉的部分，或从头开始。教程不会修改你的提示词，也不会自动生成图片。", target: "[data-tutorial-launcher]" }
];
