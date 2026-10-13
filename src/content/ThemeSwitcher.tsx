import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sun, Moon, Monitor } from "../components/PromiIcons";
import type { ThemeMode } from "../hooks/useTheme";
import { showToast } from "../lib/toast";

const choices = [{ mode: "light", label: "日间", Icon: Sun }, { mode: "dark", label: "夜间", Icon: Moon }, { mode: "system", label: "跟随系统", Icon: Monitor }] as const;

export function ThemeSwitcher({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const reduced = useReducedMotion();
  const Icon = choices.find((choice) => choice.mode === mode)!.Icon;
  useEffect(() => {
    if (!open) return;
    const root = ref.current!.getRootNode();
    const outside = (event: Event) => { if (!event.composedPath().includes(ref.current!)) setOpen(false); };
    const key = (event: Event) => { if ((event as KeyboardEvent).key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    root.addEventListener("pointerdown", outside);
    root.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => { root.removeEventListener("pointerdown", outside); root.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="theme-switcher" ref={ref} data-no-drag>
    <motion.div aria-hidden="true" className="theme-switcher-shell" initial={false} animate={{ height: open ? 138 : 34 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 27 }} />
    <motion.button ref={trigger} type="button" className="icon-button" aria-label={`外观：${choices.find((choice) => choice.mode === mode)!.label}`} title="切换日间／夜间／跟随系统" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)} whileTap={reduced ? undefined : { scale: 0.88 }}><Icon className="h-4 w-4" /></motion.button>
    <AnimatePresence>{open ? <motion.div id={menuId} role="menu" aria-label="外观模式" className="theme-mode-menu" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 470, damping: 26 }} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
      const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
      const index = buttons.indexOf(root.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowDown" ? 1 : -1) + 3) % 3;
      buttons[next]?.focus();
    }}>{choices.map(({ mode: choice, label, Icon: ChoiceIcon }) => <motion.button key={choice} type="button" role="menuitemradio" aria-checked={mode === choice} aria-label={label} title={label} disabled={busy} className={`theme-mode-choice ${choice === mode ? "is-selected" : ""}`} whileHover={reduced ? undefined : { scale: 1.1 }} whileTap={reduced ? undefined : { scale: 0.9 }} onClick={async () => {
      setBusy(true);
      try { await onChange(choice); setOpen(false); trigger.current?.focus(); } catch { showToast("外观保存失败，请重试", "error"); } finally { setBusy(false); }
    }}><ChoiceIcon className="h-4 w-4" /></motion.button>)}</motion.div> : null}</AnimatePresence>
  </div>;
}
