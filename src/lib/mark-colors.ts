const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isNaN(value) ? min : value));
const hexByte = (value: number) => Math.round(value).toString(16).padStart(2, "0");

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${[...hex].map(char => char + char).join("").toLowerCase()}`;
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

function rgb(value: string): number[] {
  const hex = normalizeHex(value) ?? "#000000";
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = Number.isFinite(h) ? ((h % 360) + 360) % 360 / 60 : 0;
  const saturation = clamp(s, 0, 100) / 100;
  const brightness = clamp(v, 0, 100) / 100;
  const chroma = brightness * saturation;
  const x = chroma * (1 - Math.abs(hue % 2 - 1));
  const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  return `#${sectors[Math.floor(hue)].map(channel => hexByte((channel + brightness - chroma) * 255)).join("")}`;
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = rgb(hex).map(channel => channel / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  const hue = delta === 0 ? 0 : max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max === 0 ? 0 : delta / max * 100, v: max * 100 };
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function compositeColor(fg: string, bg: string, opacity: number): string {
  const alpha = clamp(opacity, 0, 1);
  const foreground = rgb(fg);
  return `#${rgb(bg).map((channel, index) => hexByte(foreground[index] * alpha + channel * (1 - alpha))).join("")}`;
}

export function readableTextColor(color: string, background: string): string {
  const normalized = normalizeHex(color) ?? "#000000";
  if (contrastRatio(normalized, background) >= 4.5) return normalized;
  const { h, s, v } = hexToHsv(normalized);
  // Try the closest brightness adjustment while retaining the chosen hue.
  for (let distance = 1; distance <= 100; distance++) {
    for (const brightness of [v - distance, v + distance]) {
      if (brightness < 0 || brightness > 100) continue;
      const candidate = hsvToHex(h, s, brightness);
      if (contrastRatio(candidate, background) >= 4.5) return candidate;
    }
  }
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
}

export const MARK_THEME_BASES = {
  light: { background: "#f7f8fa", text: "#202124" },
  dark: { background: "#202124", text: "#f0f1f3" }
};

export const PRESET_MARK_COLORS = [
  { name: "红色", background: { light: "#ffd5d2", dark: "#672f32" }, text: { light: "#b3261e", dark: "#ffb4ab" } },
  { name: "橙色", background: { light: "#ffe0bd", dark: "#644221" }, text: { light: "#904b00", dark: "#ffbd79" } },
  { name: "黄色", background: { light: "#fff0a6", dark: "#584b1c" }, text: { light: "#776000", dark: "#f1d76a" } },
  { name: "绿色", background: { light: "#cfead1", dark: "#254d36" }, text: { light: "#256b38", dark: "#91d5a4" } },
  { name: "青色", background: { light: "#c4e9e9", dark: "#214c50" }, text: { light: "#006970", dark: "#82d5dc" } },
  { name: "蓝色", background: { light: "#d2e3fc", dark: "#2b4267" }, text: { light: "#2459a9", dark: "#a6c8ff" } },
  { name: "紫色", background: { light: "#e8d9f7", dark: "#4b3764" }, text: { light: "#7540a0", dark: "#d8b5fa" } },
  { name: "粉色", background: { light: "#f8d6e8", dark: "#60364e" }, text: { light: "#a13470", dark: "#f4afd5" } },
  { name: "棕色", background: { light: "#e9d8cc", dark: "#534034" }, text: { light: "#785139", dark: "#d9b69d" } },
  { name: "灰色", background: { light: "#dfe2e6", dark: "#45484e" }, text: { light: "#555b65", dark: "#c2c7d0" } }
];
