import { useEffect, useRef, useState, type RefObject } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { storageSet } from "../lib/storage";
import { TUTORIAL_CHAPTERS, TUTORIAL_SEEN_KEY, TUTORIAL_STEPS, type TutorialStep, type TutorialWorkspace } from "../lib/tutorial";
import { showToast } from "../lib/toast";

interface Layout { width: number; height: number; x: number; y: number; w: number; h: number; bubbleX: number; bubbleY: number; }

export function NewUserTutorial({ rootRef, onNavigate, onClose, onSettingsTutorial, steps = TUTORIAL_STEPS, chapters = TUTORIAL_CHAPTERS, initialIndex = null, pageGuide = false, seenKey = TUTORIAL_SEEN_KEY }: {
  rootRef: RefObject<HTMLElement>;
  onNavigate: (workspace: TutorialWorkspace) => void;
  onClose: () => void;
  onSettingsTutorial?: () => void;
  steps?: TutorialStep[];
  chapters?: string[];
  initialIndex?: number | null;
  pageGuide?: boolean;
  seenKey?: string;
}) {
  const [index, setIndex] = useState<number | null>(initialIndex);
  const [layout, setLayout] = useState<Layout | null>(null);
  const step = index === null ? null : steps[index];
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const finish = () => {
    void storageSet(seenKey, true).catch(() => showToast("教程进度未保存，下次打开可能再次提示", "error"));
    onClose();
    showToast("以后可点击顶部新手教程图标，按章节查看或从头开始");
  };
  const dialogRef = useModalFocus<HTMLDivElement>(true, finish);

  useEffect(() => {
    setLayout(null);
    if (step?.workspace) navigateRef.current(step.workspace);
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let didScroll = false;
    const measure = () => {
      const bounds = pageGuide ? { left: 0, top: 0 } : root.getBoundingClientRect();
      const width = pageGuide ? window.innerWidth : root.clientWidth;
      const height = pageGuide ? window.innerHeight : root.clientHeight;
      const target = step ? root.querySelector<HTMLElement>(step.target) ?? (step.fallback ? root.querySelector<HTMLElement>(step.fallback) : null) : null;
      if (target && !didScroll) {
        didScroll = true;
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      }
      let rect = target?.getBoundingClientRect();
      const menuRect = step?.interactive ? target?.querySelector(".image-parameter-menu")?.getBoundingClientRect() : null;
      if (rect && menuRect) rect = DOMRect.fromRect({ x: Math.min(rect.left, menuRect.left), y: Math.min(rect.top, menuRect.top), width: Math.max(rect.right, menuRect.right) - Math.min(rect.left, menuRect.left), height: Math.max(rect.bottom, menuRect.bottom) - Math.min(rect.top, menuRect.top) });
      const x = rect ? Math.max(8, rect.left - bounds.left - 6) : 0;
      const y = rect ? Math.max(8, rect.top - bounds.top - 6) : 0;
      const w = rect ? Math.max(0, Math.min(width - 8, rect.right - bounds.left + 6) - x) : 0;
      const h = rect ? Math.max(0, Math.min(height - 8, rect.bottom - bounds.top + 6) - y) : 0;
      const bubbleW = Math.min(340, width - 32);
      const bubbleH = dialogRef.current?.offsetHeight ?? 290;
      let bubbleY = (height - bubbleH) / 2;
      let bubbleX = (width - bubbleW) / 2;
      if (rect && w && h) {
        if (width - x - w > bubbleW + 24) { bubbleX = x + w + 14; bubbleY = y; }
        else if (y + h + bubbleH + 24 < height) bubbleY = y + h + 14;
        else if (y > bubbleH + 24) bubbleY = y - bubbleH - 14;
        else bubbleY = height - bubbleH - 16;
      }
      const next = { width, height, x, y, w, h, bubbleX: Math.max(16, Math.min(width - bubbleW - 16, bubbleX)), bubbleY: Math.max(16, Math.min(height - bubbleH - 16, bubbleY)) };
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    if (dialogRef.current) resize.observe(dialogRef.current);
    root.addEventListener("scroll", schedule, true);
    if (pageGuide) document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    const timer = setTimeout(schedule, 350);
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      root.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
    };
  }, [step, rootRef, dialogRef, pageGuide]);

  const l = layout;
  const hole = l && l.w > 0 && l.h > 0;
  return <div className={`new-user-tutorial${pageGuide ? " is-page-guide" : ""}${step?.interactive ? " is-interactive" : ""}`} data-no-drag onKeyDown={(event) => event.stopPropagation()}>
    {hole ? <>
      <div className="tutorial-shade" style={{ left: 0, top: 0, width: l.width, height: l.y }} />
      <div className="tutorial-shade" style={{ left: 0, top: l.y, width: l.x, height: l.h }} />
      <div className="tutorial-shade" style={{ left: l.x + l.w, top: l.y, right: 0, height: l.h }} />
      <div className="tutorial-shade" style={{ left: 0, top: l.y + l.h, width: l.width, bottom: 0 }} />
      <div className="tutorial-spotlight" style={{ left: l.x, top: l.y, width: l.w, height: l.h }} />
    </> : <div className="tutorial-shade tutorial-shade-full" />}
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-heading" className="tutorial-bubble" style={l ? { left: l.bubbleX, top: l.bubbleY } : { left: 16, top: 16 }}>
      {step ? <>
        <div className="tutorial-progress">{chapters[step.chapter]} · 第 {index! + 1} / {steps.length} 步</div>
        <h2 id="tutorial-heading" aria-live="polite">{step.title}</h2>
        <p className="tutorial-description">{step.text}</p>
        <div className="tutorial-links"><button type="button" onClick={() => setIndex(null)}>选择章节</button><button type="button" onClick={finish}>跳过引导</button></div>
        <footer>
          <button type="button" className="ghost-button" disabled={index === 0} onClick={() => setIndex(index! - 1)}>上一步</button>
          <button type="button" className="gradient-button" onClick={() => {
            if (index === steps.length - 1) finish();
            else { setIndex(index! + 1); if (index === 1 && !pageGuide && onSettingsTutorial) onSettingsTutorial(); }
          }}>{index === steps.length - 1 ? "完成教程" : index === 1 && !pageGuide && onSettingsTutorial ? "进入设置教程" : "下一步"}</button>
        </footer>
      </> : <>
        <div className="tutorial-progress">新手教程</div>
        <h2 id="tutorial-heading">欢迎使用 Promi</h2>
        <p className="tutorial-description">跟着高亮区域认识插件，也可以直接选择想了解的章节。随时可以跳过，以后点击顶部教程图标就能回来。</p>
        <div className="tutorial-chapters">{chapters.map((title, chapter) => <button type="button" key={title} onClick={() => setIndex(steps.findIndex(item => item.chapter === chapter))}><span>{chapter + 1}</span>{title}</button>)}
          {onSettingsTutorial ? <button type="button" onClick={onSettingsTutorial}><span>6</span>设置与模型接入</button> : null}
        </div>
        <footer><button type="button" className="ghost-button" onClick={finish}>暂时跳过</button><button type="button" className="gradient-button" onClick={() => setIndex(0)}>从头开始</button></footer>
      </>}
    </div>
  </div>;
}
