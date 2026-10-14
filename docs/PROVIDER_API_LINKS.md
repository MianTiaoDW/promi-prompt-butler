# 官方 API 平台入口

核对日期：2026-10-14。代码位置：`src/lib/provider-api-links.ts`。只打开官方网页，不传送插件配置、密钥或提示词。官方网页可能要求登录，页面路径由平台维护。

| 平台 | 按钮入口 | 核对依据 |
| --- | --- | --- |
| Claude | https://platform.claude.com/settings/keys | https://console.anthropic.com/settings/keys 官方重定向 |
| Gemini | https://aistudio.google.com/apikey | Google AI Studio API Key 页面（未登录跳登录页） |
| ChatGPT / OpenAI | https://platform.openai.com/api-keys | OpenAI Platform API Key 页面 |
| 火山引擎 | https://console.volcengine.com/ark/region:cn-beijing/apikey | https://docs.volcengine.com/docs/ark/guide-preview?lang=zh 中的 Get API Key 链接 |
| Kimi | https://platform.kimi.com/console/api-keys | https://platform.moonshot.cn/console/api-keys 官方重定向 |
| DeepSeek | https://platform.deepseek.com/api_keys | https://www.deepseek.com/platform/、https://api-docs.deepseek.com/api/deepseek-api/ 指向开放平台；密钥页限制匿名爬取 |
| MiniMax | https://platform.minimax.cn/console/access?tab=api-keys | https://platform.minimaxi.com/user-center/basic-information/interface-key 官方重定向 |
| 阿里云百炼 | https://bailian.console.aliyun.com/ | 官方控制台提供模型广场和创建／管理 API Key |
| 小米 MiMo | https://platform.xiaomimimo.com/ | Xiaomi MiMo API Open Platform |
| 腾讯云 | https://console.cloud.tencent.com/lkeap | https://cloud.tencent.com/document/product/1772/115970 中的控制台链接，与现有 LKEAP 接入预设对应 |

OpenAI 兼容中转站不是一个具体平台，不设固定官方入口，显示“自选平台”，请到用户实际使用的服务商创建密钥。
