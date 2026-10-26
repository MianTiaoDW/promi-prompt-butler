import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { applyMark, clearMarks, getMarkedSegments, normalizeMarks, remapMarks, type MarkKind, type MarkTheme, type PromptMark } from "../lib/prompt-marks";
import { compositeColor, contrastRatio, hexToHsv, hsvToHex, MARK_THEME_BASES, normalizeHex, PRESET_MARK_COLORS, readableTextColor } from "../lib/mark-colors";
import { storageGet, storageSet } from "../lib/storage";
import { showToast } from "../lib/toast";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  text: string; marks?: PromptMark[]; editable?: boolean;
  onTextChange?: (text: string, marks: PromptMark[]) => void;
  onMarksChange?: (marks: PromptMark[]) => void | Promise<void>;
  onReadEdit?: () => void;
};
type SelectionRange = { start: number; end: number; x: number; y: number; host: HTMLElement };

export function PromptInline({ text, marks }: { text: string; marks?: PromptMark[] }) {
  if (!marks?.length) return <>{text}</>;
  return <>{getMarkedSegments(text, marks).map(segment => {
    const background = segment.marks.filter(mark => mark.kind === "background").slice(-1)[0];
    const foreground = segment.marks.filter(mark => mark.kind === "text").slice(-1)[0];
    return <span key={segment.start} className="prompt-inline-mark" style={{
      "--prompt-mark-light-bg": background ? compositeColor(background.light, MARK_THEME_BASES.light.background, background.opacity ?? .45) : undefined,
      "--prompt-mark-dark-bg": background ? compositeColor(background.dark, MARK_THEME_BASES.dark.background, background.opacity ?? .45) : undefined,
      "--prompt-mark-light-text": foreground?.light, "--prompt-mark-dark-text": foreground?.dark
    } as CSSProperties}>{segment.text}</span>;
  })}</>;
}

function MarkedContent({ text, marks, theme }: { text: string; marks: PromptMark[]; theme: MarkTheme }) {
  return <>{getMarkedSegments(text, marks).map(segment => {
    const background = segment.marks.filter(mark => mark.kind === "background").slice(-1)[0];
    const foreground = segment.marks.filter(mark => mark.kind === "text").slice(-1)[0];
    return <span key={segment.start} data-prompt-mark={segment.marks.length ? "true" : undefined} data-mark-start={segment.start} data-mark-end={segment.start + segment.text.length} style={{
      backgroundColor: background ? compositeColor(background[theme], MARK_THEME_BASES[theme].background, background.opacity ?? .45) : undefined,
      color: foreground?.[theme]
    }}>{segment.text}</span>;
  })}</>;
}

function ColorPanel({ selection, text, marks, theme, onApply, onClose }: {
  selection: SelectionRange; text: string; marks: PromptMark[]; theme: MarkTheme;
  onApply: (marks: PromptMark[]) => void | Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<MarkKind>("background");
  const existing = marks.find(mark => mark.start < selection.end && mark.end > selection.start && mark.kind === "background");
  const [colors, setColors] = useState({ light: existing?.light ?? PRESET_MARK_COLORS[2].background.light, dark: existing?.dark ?? PRESET_MARK_COLORS[2].background.dark });
  const [opacity, setOpacity] = useState(existing?.opacity ?? .45);
  const [previewTheme, setPreviewTheme] = useState(theme);
  const [hexDraft, setHexDraft] = useState(colors[theme]);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hue, setHue] = useState(() => hexToHsv(colors[theme]).h);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const hsv = { ...hexToHsv(colors[previewTheme]), h: hue };
  const setColor = (hex: string, keepHue = false) => { setColors(current => ({ ...current, [previewTheme]: hex })); setHexDraft(hex); if (!keepHue) { const next = hexToHsv(hex); if (next.s > 0 && next.v > 0) setHue(next.h); } };
  const panelMarks = applyMark(text, marks, selection.start, selection.end, { kind, ...colors, ...(kind === "background" ? { opacity } : {}) });
  const selectedMarks = panelMarks.filter(mark => mark.start <= selection.start && mark.end > selection.start);
  const background = selectedMarks.filter(mark => mark.kind === "background").slice(-1)[0];
  const foreground = selectedMarks.filter(mark => mark.kind === "text").slice(-1)[0];
  const bg = background ? compositeColor(background[previewTheme], MARK_THEME_BASES[previewTheme].background, background.opacity ?? .45) : MARK_THEME_BASES[previewTheme].background;
  const fg = foreground?.[previewTheme] ?? MARK_THEME_BASES[previewTheme].text;
  const contrast = contrastRatio(fg, bg);
  useEffect(() => { void storageGet<string[]>("prompt-butler-mark-recent-colors", []).then(value => setRecent(Array.isArray(value) ? value.filter(color => typeof color === "string" && normalizeHex(color)).slice(0, 8) : [])).catch(() => {}); }, []);
  useEffect(() => {
    const panel = ref.current;
    const dismiss = () => onClose();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } };
    panel?.addEventListener("prompt-mark-dismiss", dismiss); window.addEventListener("keydown", escape, true);
    return () => { panel?.removeEventListener("prompt-mark-dismiss", dismiss); window.removeEventListener("keydown", escape, true); };
  }, [onClose]);
  useLayoutEffect(() => {
    const place = () => {
      const host = selection.host.getBoundingClientRect(), panel = ref.current;
      if (!panel) return;
      const left = Math.max(8, Math.min(selection.x - host.left, host.width - panel.offsetWidth - 8));
      const top = Math.max(8, Math.min(selection.y - host.top + 8, Math.min(host.height, window.innerHeight - host.top) - panel.offsetHeight - 8));
      setPosition({ left, top });
    };
    place(); const observer = new ResizeObserver(place); if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [selection]);
  const persist = async (next: PromptMark[]) => {
    if (busy) return;
    setBusy(true);
    try { await onApply(next); onClose(); }
    catch { showToast("重点标记未保存，请重试", "error"); }
    finally { setBusy(false); }
  };
  const changeMode = (next: MarkKind) => {
    setKind(next);
    const found = marks.find(mark => mark.kind === next && mark.start < selection.end && mark.end > selection.start);
    const pair = found ?? (next === "background" ? PRESET_MARK_COLORS[2].background : PRESET_MARK_COLORS[5].text);
    setColors({ light: pair.light, dark: pair.dark }); setHexDraft(pair[previewTheme]); setHue(hexToHsv(pair[previewTheme]).h);
  };
  const selectPreset = (pair: { light: string; dark: string }) => { setColors(pair); setHexDraft(pair[previewTheme]); setHue(hexToHsv(pair[previewTheme]).h); };
  return createPortal(<div ref={ref} className="prompt-color-panel" role="region" aria-label="重点标记色板" data-no-drag style={position}
    onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDownCapture={event => { if (event.key === "Enter") event.stopPropagation(); }}>
    <header><strong>画重点</strong><button type="button" aria-label="关闭重点色板" onClick={onClose}>×</button></header>
    <div className="mark-mode-tabs">{(["background", "text"] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => changeMode(value)}>{value === "background" ? "背景高亮" : "文字颜色"}</button>)}</div>
    <label>阅读预设</label><div className="mark-swatches">{PRESET_MARK_COLORS.map(preset => <button type="button" key={preset.name} aria-label={`${preset.name}预设`} title={preset.name} style={{ background: (kind === "background" ? preset.background : preset.text)[previewTheme] }} onClick={() => selectPreset(kind === "background" ? preset.background : preset.text)} />)}</div>
    <div className="mark-theme-tabs"><span>预览及调色</span>{(["light", "dark"] as const).map(value => <button type="button" key={value} aria-pressed={previewTheme === value} onClick={() => { setPreviewTheme(value); setHexDraft(colors[value]); setHue(hexToHsv(colors[value]).h); }}>{value === "light" ? "日间" : "夜间"}</button>)}</div>
    <div className="mark-sv-square" aria-label="饱和度与明度色板" style={{ backgroundColor: hsvToHex(hsv.h, 100, 100) }} onPointerDown={event => {
      if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect(); setColor(hsvToHex(hsv.h, Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100))));
    }} onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = event.currentTarget.getBoundingClientRect(); setColor(hsvToHex(hsv.h, Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100)))); }}>
      <span style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
    </div>
    <label className="mark-hue">色相<input type="range" aria-label="色相" min={0} max={359} value={Math.round(hsv.h)} onChange={event => { const next = Number(event.target.value); setHue(next); setColor(hsvToHex(next, hsv.s, hsv.v), true); }} /></label>
    <div className="mark-color-values"><label>HEX<input aria-label="颜色 HEX" value={hexDraft} maxLength={7} onChange={event => { setHexDraft(event.target.value); const value = normalizeHex(event.target.value); if (value) { setColors(current => ({ ...current, [previewTheme]: value })); setHue(hexToHsv(value).h); } }} onBlur={() => setHexDraft(colors[previewTheme])} /></label>
      {(["s", "v"] as const).map(key => <label key={key}>{key === "s" ? "饱和度" : "明度"}<input type="number" aria-label={key === "s" ? "饱和度" : "明度"} min={0} max={100} value={Math.round(hsv[key])} onChange={event => setColor(hsvToHex(hsv.h, key === "s" ? Number(event.target.value) : hsv.s, key === "v" ? Number(event.target.value) : hsv.v))} /></label>)}
    </div>
    {kind === "background" ? <label className="mark-opacity">背景不透明度 {Math.round(opacity * 100)}%<input type="range" aria-label="背景不透明度" min={5} max={100} value={Math.round(opacity * 100)} onChange={event => setOpacity(Number(event.target.value) / 100)} /></label> : null}
    {recent.length ? <><label>最近使用</label><div className="mark-swatches">{recent.map(color => <button type="button" key={color} style={{ background: color }} aria-label={`最近颜色 ${color}`} onClick={() => setColor(color)} />)}</div></> : null}
    <div className="mark-reading-preview" style={{ background: bg, color: fg }} aria-label="重点文字预览">{text.slice(selection.start, selection.end).slice(0, 70) || "重点文字预览"}</div>
    <div className="mark-contrast" role="status">对比度 {contrast.toFixed(2)}:1 {contrast < 4.5 ? "· 当前颜色不易阅读" : "· 清晰可读"}</div>
    {contrast < 4.5 ? <button type="button" className="mark-fix" onClick={() => {
      if (kind === "text") setColor(readableTextColor(colors[previewTheme], bg));
      else { setColor(readableTextColor(colors[previewTheme], fg)); setOpacity(1); }
    }}>调整为清晰颜色</button> : null}
    <div className="mark-clear-actions"><button type="button" disabled={busy} onClick={() => void persist(clearMarks(text, marks, selection.start, selection.end, kind))}>清除{kind === "background" ? "背景" : "文字色"}</button><button type="button" disabled={busy} onClick={() => void persist(clearMarks(text, marks, selection.start, selection.end))}>清除全部标记</button></div>
    <button type="button" className="mark-apply" disabled={busy} onClick={() => {
      const nextRecent = [colors[previewTheme], ...recent.filter(color => color !== colors[previewTheme])].slice(0, 8);
      void storageSet("prompt-butler-mark-recent-colors", nextRecent).catch(() => {});
      void persist(panelMarks);
    }}>{busy ? "保存中…" : "应用标记"}</button>
  </div>, selection.host);
}

export function PromptText({ text, marks: rawMarks, editable = false, onTextChange, onMarksChange, onReadEdit, className = "", ...props }: Props) {
  const wrapper = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), reader = useRef<HTMLPreElement>(null), mirror = useRef<HTMLPreElement>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [theme, setTheme] = useState<MarkTheme>("light");
  const [mirrorStyle, setMirrorStyle] = useState<CSSProperties>({});
  const marks = normalizeMarks(text, rawMarks ?? []);
  useLayoutEffect(() => {
    const root = wrapper.current?.getRootNode(), host = root instanceof ShadowRoot ? root.host : document.documentElement;
    const update = () => setTheme(host.getAttribute("data-theme") === "dark" ? "dark" : "light"); update();
    const observer = new MutationObserver(update); observer.observe(host, { attributes: true, attributeFilter: ["data-theme"] }); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input || !marks.length) return;
    const sync = () => {
      const style = getComputedStyle(input);
      setMirrorStyle({ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, wordSpacing: style.wordSpacing, padding: style.padding, borderWidth: style.borderWidth, borderStyle: "solid", borderColor: "transparent", boxSizing: "border-box", width: input.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth), whiteSpace: style.whiteSpace === "pre" ? "pre" : "pre-wrap", overflowWrap: style.overflowWrap as CSSProperties["overflowWrap"], tabSize: style.tabSize, transform: `translate(${-input.scrollLeft}px, ${input.offsetTop - input.scrollTop}px)` });
    };
    sync(); input.addEventListener("scroll", sync); const observer = new ResizeObserver(sync); observer.observe(input);
    return () => { input.removeEventListener("scroll", sync); observer.disconnect(); };
  }, [text, editable, marks.length]);
  useEffect(() => {
    if (!selection) return;
    const host = selection.host;
    const previousPosition = host.style.position;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const close = (event: Event) => { const path = event.composedPath(); if (path.some(node => node instanceof Element && node.closest(".prompt-color-panel"))) return; if (!path.includes(wrapper.current!)) setSelection(null); };
    document.addEventListener("pointerdown", close, true);
    return () => { document.removeEventListener("pointerdown", close, true); host.style.position = previousPosition; };
  }, [selection]);
  const select = () => {
    if (!onMarksChange || props.disabled) return;
    const element = editable ? textarea.current : reader.current;
    if (!element) return;
    let start = 0, end = 0, rect = element.getBoundingClientRect();
    if (editable && textarea.current) { start = textarea.current.selectionStart; end = textarea.current.selectionEnd; }
    else {
      const root = element.getRootNode() as Document & { getSelection(): Selection | null };
      const selected = root.getSelection?.() ?? window.getSelection();
      if (!selected?.rangeCount || !element.contains(selected.anchorNode) || !element.contains(selected.focusNode)) return;
      const range = selected.getRangeAt(0), before = range.cloneRange(); before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset); start = before.toString().length; end = start + range.toString().length;
      rect = range.getBoundingClientRect();
    }
    if (start === end) { setSelection(null); return; }
    const host = element.closest<HTMLElement>("[role='dialog'], .fluxora-shell, .settings-page") ?? wrapper.current!;
    setSelection({ start, end, x: rect.left, y: editable ? Math.min(rect.bottom, rect.top + 72) : rect.bottom, host });
  };
  return <div ref={wrapper} className="prompt-mark-field" data-prompt-text>
    {editable ? <>
      <textarea {...props} ref={textarea} value={text} className={`${className}${marks.length ? " has-prompt-marks" : ""}`} onSelect={select} onChange={event => { setSelection(null); onTextChange?.(event.target.value, remapMarks(text, event.target.value, marks)); }} />
      {marks.length ? <div className="prompt-mark-mirror" aria-hidden="true"><pre ref={mirror} style={mirrorStyle}><MarkedContent text={text + (text.endsWith("\n") ? " " : "")} marks={marks} theme={theme} /></pre></div> : null}
    </> : <pre ref={reader} className={className} aria-label={props["aria-label"]} tabIndex={onReadEdit || onMarksChange ? 0 : undefined} onMouseUp={select} onKeyUp={select} onClick={event => {
      const root = reader.current?.getRootNode() as Document, selected = root?.getSelection?.() ?? window.getSelection();
      if (selected?.toString()) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-prompt-mark]") : null;
      if (target && onMarksChange) {
        const rect = target.getBoundingClientRect(), host = target.closest<HTMLElement>("[role='dialog'], .fluxora-shell, .settings-page") ?? wrapper.current!;
        setSelection({ start: Number(target.dataset.markStart), end: Number(target.dataset.markEnd), x: rect.left, y: rect.bottom, host });
      } else if (!selection) onReadEdit?.();
    }} onKeyDown={event => { if ((event.key === "Enter" || event.key === " ") && onReadEdit) { event.preventDefault(); onReadEdit(); } }}><MarkedContent text={text} marks={marks} theme={theme} /></pre>}
    {selection && onMarksChange ? <ColorPanel key={`${selection.start}:${selection.end}`} selection={selection} text={text} marks={marks} theme={theme} onApply={onMarksChange} onClose={() => {
      setSelection(null);
      if (textarea.current) { textarea.current.setSelectionRange(selection.end, selection.end); textarea.current.focus({ preventScroll: true }); }
      else { const root = reader.current?.getRootNode() as Document; (root?.getSelection?.() ?? window.getSelection())?.removeAllRanges(); reader.current?.focus({ preventScroll: true }); }
    }} /> : null}
  </div>;
}
