import { useEffect, useRef, useState } from "react";
import { useChromeStorage } from "./useChromeStorage";

export type ThemeMode = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "prompt-butler-theme";

export function useTheme() {
  const rootRef = useRef<HTMLElement | null>(null);
  const { value, setValue } = useChromeStorage<ThemeMode>(THEME_STORAGE_KEY, "dark");
  const mode: ThemeMode = value === "light" || value === "system" ? value : "dark";
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const resolved = mode === "system" ? systemDark ? "dark" : "light" : mode;
  useEffect(() => {
    const root = rootRef.current?.getRootNode();
    const target = root instanceof ShadowRoot ? root.host : document.documentElement;
    target.setAttribute("data-theme", resolved);
  }, [resolved]);
  return { rootRef, mode, setMode: setValue, resolved };
}
