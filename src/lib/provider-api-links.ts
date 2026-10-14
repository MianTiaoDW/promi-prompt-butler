import type { ProviderId } from "../types/settings";

// Official API consoles, checked 2026-10-14. No fixed official console for a relay.
export const PROVIDER_API_LINKS: Record<ProviderId, string | null> = {
  claude: "https://platform.claude.com/settings/keys",
  gemini: "https://aistudio.google.com/apikey",
  chatgpt: "https://platform.openai.com/api-keys",
  openaiRelay: null,
  volcengine: "https://console.volcengine.com/ark/region:cn-beijing/apikey",
  kimi: "https://platform.kimi.com/console/api-keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  minimax: "https://platform.minimax.cn/console/access?tab=api-keys",
  dashscope: "https://bailian.console.aliyun.com/",
  xiaomi: "https://platform.xiaomimimo.com/",
  tencent: "https://console.cloud.tencent.com/lkeap"
};
