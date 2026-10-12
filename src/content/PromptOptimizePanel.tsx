import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle, Sparkles, X } from "../components/PromiIcons";
import type { SavedPromptRecord } from "../types/prompt";
import { useModalFocus } from "../hooks/useModalFocus";
import { MOTION } from "../lib/motion";

export const PROMPT_OPTIMIZATION_DIRECTIONS = [
  "提升商业质感",
  "提升真实摄影感",
  "适配 Midjourney",
  "适配 Nano Banana",
  "转换视频生成 Prompt",
  "增强角色一致性"
] as const;

export function PromptOptimizePanel(props: {
  record: SavedPromptRecord | null;
  busy: boolean;
  onClose: () => void;
  onOptimize: (direction: string) => void;
}) {
  const [direction, setDirection] = useState<string>(PROMPT_OPTIMIZATION_DIRECTIONS[0]);
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useModalFocus<HTMLElement>(Boolean(props.record), props.onClose);

  useEffect(() => {
    if (props.record) setDirection(PROMPT_OPTIMIZATION_DIRECTIONS[0]);
  }, [props.record]);

  return (
    <AnimatePresence>
      {props.record ? (
    <motion.div className="prompt-optimize-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: shouldReduceMotion ? 0.12 : MOTION.modalMs / 1000 }} onMouseDown={props.onClose}>
      <motion.section ref={dialogRef} tabIndex={-1} className="prompt-optimize-panel" initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }} transition={{ duration: shouldReduceMotion ? 0.12 : MOTION.modalMs / 1000, ease: MOTION.easeOut }} role="dialog" aria-modal="true" aria-labelledby="prompt-optimize-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><h2 id="prompt-optimize-title">AI 优化 Prompt</h2><p>{props.record.title || props.record.content.slice(0, 28)}</p></div>
          <button type="button" onClick={props.onClose} aria-label="关闭"><X className="h-4 w-4" /></button>
        </header>
        <div className="prompt-optimize-directions">
          {PROMPT_OPTIMIZATION_DIRECTIONS.map((item) => (
            <button key={item} type="button" className={direction === item ? "is-selected" : ""} onClick={() => setDirection(item)}>{item}</button>
          ))}
        </div>
        <footer>
          <button type="button" className="ghost-button" onClick={props.onClose}>取消</button>
          <button type="button" className="gradient-button" disabled={props.busy} onClick={() => props.onOptimize(direction)}>
            {props.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {props.busy ? "正在优化" : "生成新版 Prompt"}
          </button>
        </footer>
      </motion.section>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
