import type { TutorialStep } from "./tutorial";

export const SETTINGS_TUTORIAL_STEPS: TutorialStep[] = [
  { chapter: 5, title: "先选你要用的平台", text: "点开服务商列表，左边是平台名称，右边的“API 平台”打开官方接入网页。到官网注册或登录，选择你需要的模型，再创建 API 密钥。点击平台名称才会切换服务商，点击官网按钮不会切换。中转站需要去你自己选择的网站。", target: "[data-settings-guide='provider']", interactive: true },
  { chapter: 5, title: "API Key 就是通行证", text: "把官方平台生成的 API Key 完整复制到这里。它让插件使用你账号下的模型，不是登录密码。小眼睛可以查看，叉号可以清空；不要把密钥发给别人。", target: "[data-settings-guide='api-key']" },
  { chapter: 5, title: "Base URL 是接入地址", text: "选择官方平台后通常会自动填写地址。只有官方文档或你使用的中转站给了不同地址，才需要修改。这里填的是接口地址，不是刚才打开的 API 平台网页地址。", target: "[data-settings-guide='base-url']" },
  { chapter: 5, title: "生图可以单独配置", text: "如果写提示词和生成图片用不同平台，在这里填写生图专用密钥和地址。留空就使用上面的通用配置。生图密钥、地址和生图模型必须来自同一个服务。", target: "[data-settings-guide='image-api-key']", fallback: "[data-settings-guide='image-base-url']" },
  { chapter: 5, title: "三个模型分别干什么", text: "文字模型帮你写提示词，视觉模型理解参考图，图像模型负责生成图片。可以从列表选，也可以粘贴官网提供的模型 ID；模型名称不是随便写的，也不是每个平台都支持生图。", target: "[data-settings-guide='models']" },
  { chapter: 5, title: "默认图片参数", text: "比例决定横图、竖图还是方图；分辨率决定图片大小；张数决定一次生成几张。这里设的是默认值，之后在图像工坊还能调整。", target: "[data-settings-guide='image-output']" },
  { chapter: 5, title: "保存、测试和识别模型", text: "填好后点击保存配置。测试连接检查地址和密钥是否可用，自动识别模型读取平台提供的模型列表；这些操作需要你主动点击，教程不会替你执行。恢复上次保存会撤销尚未保存的修改。", target: ".settings-actions" },
  { chapter: 5, title: "检查连接状态", text: "这里汇总已保存的配置。绿色“连接成功”说明最近测试通过；失败时先检查地址、密钥和账号余额。生图专用配置、识别出的模型和测试时间也能在这里查看。", target: "[data-settings-guide='status']" },
  { chapter: 5, title: "管理示例图占用", text: "这里显示你主动给提示词添加的示例图占用了多少空间。管理可以回到提示词库，清理无效数据清除不再关联提示词的示例图；它不是生图创作历史。", target: "[data-settings-guide='image-storage']" },
  { chapter: 5, title: "模型能力与最近活动", text: "模型能力说明当前服务是否适合文字、视觉或生图。最近活动记录保存、测试和模型识别的时间，连接出问题时可据此排查。看完可以点击顶部“返回主界面”继续使用插件。", target: "[data-settings-guide='capabilities']", fallback: "[data-settings-guide='status']" }
];
