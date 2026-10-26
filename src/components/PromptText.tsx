import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import { Copy, Eraser, PencilLine, X, ArrowLeft } from "./PromiIcons";
import { createPortal } from "react-dom";
import { applyMark, clearMarks, getMarkedSegments, isRangeBold, normalizeMarks, remapMarks, toggleBold, type MarkKind, type MarkTheme, type PromptMark } from "../lib/prompt-marks";
import { compositeColor, contrastRatio, hexToHsv, hsvToHex, MARK_THEME_BASES, normalizeHex, PRESET_MARK_COLORS, readableTextColor } from "../lib/mark-colors";
import { storageGet, storageSet } from "../lib/storage";
import { showToast } from "../lib/toast";
import { latestFrame, placeMarkPanel, placeMarkToolbar, type MarkSelectionBounds } from "../lib/mark-panel-layout";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  text: string; marks?: PromptMark[]; editable?: boolean;
  onTextChange?: (text: string, marks: PromptMark[]) => void;
  onMarksChange?: (marks: PromptMark[]) => void | Promise<void>;
  onReadEdit?: () => void;
};
type SelectionRange = { start: number; end: number; x: number; y: number; bounds: MarkSelectionBounds; host: HTMLElement };

function textareaSelectionBounds(input: HTMLTextAreaElement, start: number, end: number): DOMRect {
  const rect = input.getBoundingClientRect(), style = getComputedStyle(input), probe = document.createElement("pre");
  Object.assign(probe.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", margin: "0", left: `${rect.left - input.scrollLeft}px`, top: `${rect.top - input.scrollTop}px`, width: `${input.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)}px`, boxSizing: "border-box", padding: style.padding, borderWidth: style.borderWidth, borderStyle: "solid", fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, wordSpacing: style.wordSpacing, tabSize: style.tabSize, whiteSpace: style.whiteSpace === "pre" ? "pre" : "pre-wrap", overflowWrap: style.overflowWrap });
  const selected = document.createElement("span"); selected.textContent = input.value.slice(start, end);
  probe.append(document.createTextNode(input.value.slice(0, start)), selected, document.createTextNode(input.value.slice(end)));
  document.body.append(probe);
  const bounds = selected.getBoundingClientRect(); probe.remove();
  const top = Math.max(rect.top, bounds.top), bottom = Math.min(rect.bottom, bounds.bottom);
  return bottom > top ? DOMRect.fromRect({ x: Math.max(rect.left, bounds.left), y: top, width: Math.max(1, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)), height: bottom - top }) : rect;
}

export function PromptInline({ text, marks }: { text: string; marks?: PromptMark[] }) {
  if (!marks?.length) return <>{text}</>;
  return <>{getMarkedSegments(text, marks).map(segment => {
    const background = segment.marks.filter(mark => mark.kind === "background").slice(-1)[0];
    const foreground = segment.marks.filter(mark => mark.kind === "text").slice(-1)[0];
    return <span key={segment.start} className="prompt-inline-mark" style={{
      fontWeight: segment.marks.some(mark => mark.kind === "bold") ? 700 : undefined,
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
    return <span key={segment.start} data-prompt-mark={segment.marks.length ? "true" : undefined} data-mark-bold={segment.marks.some(mark => mark.kind === "bold") ? "true" : undefined} data-mark-start={segment.start} data-mark-end={segment.start + segment.text.length} style={{
      fontWeight: segment.marks.some(mark => mark.kind === "bold") ? 700 : undefined,
      backgroundColor: background ? compositeColor(background[theme], MARK_THEME_BASES[theme].background, background.opacity ?? .45) : undefined,
      color: foreground?.[theme], "--mark-live-text": foreground?.[theme] ?? MARK_THEME_BASES[theme].text
    } as CSSProperties}>{segment.text}</span>;
  })}</>;
}

function ColorPanel({ selection, text, marks, theme, onApply, onClose, onPreview, initialKind = "background", onBack }: {
  selection: SelectionRange; text: string; marks: PromptMark[]; theme: MarkTheme;
  onApply: (marks: PromptMark[]) => void | Promise<void>; onClose: () => void;
  onPreview: (marks: PromptMark[]) => void;
  initialKind?: Exclude<MarkKind, "bold">; onBack?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<Exclude<MarkKind, "bold">>(initialKind);
  const existing = marks.find(mark => mark.start < selection.end && mark.end > selection.start && mark.kind === initialKind);
  const initialColors = initialKind === "background" ? PRESET_MARK_COLORS[2].background : PRESET_MARK_COLORS[5].text;
  const [colors, setColors] = useState({ light: existing?.light ?? initialColors.light, dark: existing?.dark ?? initialColors.dark });
  const [opacity, setOpacity] = useState(existing?.opacity ?? .45);
  const [previewTheme, setPreviewTheme] = useState(theme);
  const [hexDraft, setHexDraft] = useState(colors[theme]);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hue, setHue] = useState(() => hexToHsv(colors[theme]).h);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 280, maxHeight: 400 });
  const [frame] = useState(() => latestFrame(callback => requestAnimationFrame(callback), cancelAnimationFrame));
  const dragBounds = useRef<DOMRect | null>(null);
  useEffect(() => () => frame.cancel(), [frame]);
  const hsv = { ...hexToHsv(colors[previewTheme]), h: hue };
  const setColor = (hex: string, keepHue = false) => { setColors(current => ({ ...current, [previewTheme]: hex })); setHexDraft(hex); if (!keepHue) { const next = hexToHsv(hex); if (next.s > 0 && next.v > 0) setHue(next.h); } };
  const panelMarks = useMemo(() => applyMark(text, marks, selection.start, selection.end, { kind, ...colors, ...(kind === "background" ? { opacity } : {}) }), [text, marks, selection.start, selection.end, kind, colors, opacity]);
  useEffect(() => { onPreview(panelMarks); }, [panelMarks, onPreview]);
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
      const host = selection.host.getBoundingClientRect();
      const next = placeMarkPanel(host, selection.bounds, window.innerWidth, window.innerHeight);
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    place(); const observer = new ResizeObserver(place); observer.observe(selection.host); window.addEventListener("resize", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [selection]);
  const persist = async (next: PromptMark[]) => {
    if (busy) return;
    setBusy(true);
    try { await onApply(next); onClose(); }
    catch { showToast("重点标记未保存，请重试", "error"); }
    finally { setBusy(false); }
  };
  const changeMode = (next: Exclude<MarkKind, "bold">) => {
    setKind(next);
    const found = marks.find(mark => mark.kind === next && mark.start < selection.end && mark.end > selection.start);
    const pair = found ?? (next === "background" ? PRESET_MARK_COLORS[2].background : PRESET_MARK_COLORS[5].text);
    setColors({ light: pair.light, dark: pair.dark }); setHexDraft(pair[previewTheme]); setHue(hexToHsv(pair[previewTheme]).h);
  };
  const selectPreset = (pair: { light: string; dark: string }) => { setColors(pair); setHexDraft(pair[previewTheme]); setHue(hexToHsv(pair[previewTheme]).h); };
  return createPortal(<div ref={ref} className="prompt-color-panel" role="region" aria-label="重点标记色板" data-no-drag style={position}
    onPointerDown={event => { if (event.target instanceof Element && event.target.closest("button")) frame.flush(); event.stopPropagation(); }} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDownCapture={event => { if (event.key === "Enter") event.stopPropagation(); }}>
    <header>{onBack ? <button type="button" aria-label="返回文字工具栏" title="返回文字工具栏" onClick={onBack}><ArrowLeft className="h-4 w-4" /></button> : null}<strong>画重点</strong><button type="button" aria-label="关闭重点色板" onClick={onClose}>×</button></header>
    <div className="mark-bold-toolbar"><button type="button" aria-label="加粗" title="加粗／取消加粗" aria-pressed={isRangeBold(text, marks, selection.start, selection.end)} disabled={busy} onClick={() => void persist(toggleBold(text, marks, selection.start, selection.end))}><b aria-hidden="true">B</b><span>加粗</span></button></div>
    <div className="mark-mode-tabs">{(["background", "text"] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => changeMode(value)}>{value === "background" ? "背景高亮" : "文字颜色"}</button>)}</div>
    <label>阅读预设</label><div className="mark-swatches">{PRESET_MARK_COLORS.map(preset => <button type="button" key={preset.name} aria-label={`${preset.name}预设`} title={preset.name} style={{ background: (kind === "background" ? preset.background : preset.text)[previewTheme] }} onClick={() => selectPreset(kind === "background" ? preset.background : preset.text)} />)}</div>
    <div className="mark-theme-tabs"><span>预览及调色</span>{(["light", "dark"] as const).map(value => <button type="button" key={value} aria-pressed={previewTheme === value} onClick={() => { setPreviewTheme(value); setHexDraft(colors[value]); setHue(hexToHsv(colors[value]).h); }}>{value === "light" ? "日间" : "夜间"}</button>)}</div>
    <div className="mark-sv-square" aria-label="饱和度与明度色板" style={{ backgroundColor: hsvToHex(hsv.h, 100, 100) }} onPointerDown={event => {
      if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect(); dragBounds.current = rect; setColor(hsvToHex(hsv.h, Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100))));
    }} onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId) || !dragBounds.current) return; const rect = dragBounds.current; const hex = hsvToHex(hsv.h, Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100))); frame.schedule(() => setColor(hex)); }} onPointerUp={() => frame.flush()} onPointerCancel={() => frame.flush()}>
      <span style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
    </div>
    <label className="mark-hue">色相<input type="range" aria-label="色相" min={0} max={359} value={Math.round(hsv.h)} onPointerUp={() => frame.flush()} onKeyUp={() => frame.flush()} onChange={event => { const next = Number(event.target.value); frame.schedule(() => { setHue(next); setColor(hsvToHex(next, hsv.s, hsv.v), true); }); }} /></label>
    <div className="mark-color-values"><label>HEX<input aria-label="颜色 HEX" value={hexDraft} maxLength={7} onChange={event => { setHexDraft(event.target.value); const value = normalizeHex(event.target.value); if (value) { setColors(current => ({ ...current, [previewTheme]: value })); setHue(hexToHsv(value).h); } }} onBlur={() => setHexDraft(colors[previewTheme])} /></label>
      {(["s", "v"] as const).map(key => <label key={key}>{key === "s" ? "饱和度" : "明度"}<input type="number" aria-label={key === "s" ? "饱和度" : "明度"} min={0} max={100} value={Math.round(hsv[key])} onChange={event => setColor(hsvToHex(hsv.h, key === "s" ? Number(event.target.value) : hsv.s, key === "v" ? Number(event.target.value) : hsv.v))} /></label>)}
    </div>
    {kind === "background" ? <label className="mark-opacity">背景不透明度 {Math.round(opacity * 100)}%<input type="range" aria-label="背景不透明度" min={5} max={100} value={Math.round(opacity * 100)} onPointerUp={() => frame.flush()} onKeyUp={() => frame.flush()} onChange={event => { const next = Number(event.target.value) / 100; frame.schedule(() => setOpacity(next)); }} /></label> : null}
    {recent.length ? <><label>最近使用</label><div className="mark-swatches">{recent.map(color => <button type="button" key={color} style={{ background: color }} aria-label={`最近颜色 ${color}`} onClick={() => setColor(color)} />)}</div></> : null}
    <div className="mark-reading-preview" style={{ background: bg, color: fg }} aria-label="重点文字预览">{text.slice(selection.start, selection.end).slice(0, 70) || "重点文字预览"}</div>
    <div className="mark-contrast" role="status">对比度 {contrast.toFixed(2)}:1 {contrast < 4.5 ? "· 当前颜色不易阅读" : "· 清晰可读"}</div>
    {contrast < 4.5 ? <button type="button" className="mark-fix" onClick={() => {
      if (kind === "text") setColor(readableTextColor(colors[previewTheme], bg));
      else { setColor(readableTextColor(colors[previewTheme], fg)); setOpacity(1); }
    }}>调整为清晰颜色</button> : null}
    <div className="mark-clear-actions"><button type="button" disabled={busy} onClick={() => void persist(clearMarks(text, marks, selection.start, selection.end, kind))}>清除{kind === "background" ? "背景" : "文字色"}</button><button type="button" disabled={busy} onClick={() => void persist(clearMarks(text, marks, selection.start, selection.end))}>清除全部标记</button></div>
    <div className="mark-color-commit"><button type="button" className="mark-apply" disabled={busy} onClick={() => {
      const nextRecent = [colors[previewTheme], ...recent.filter(color => color !== colors[previewTheme])].slice(0, 8);
      void storageSet("prompt-butler-mark-recent-colors", nextRecent).catch(() => {});
      void persist(panelMarks);
    }}>{busy ? "保存中…" : "应用标记"}</button></div>
  </div>, selection.host);
}

function SelectionTools({ selection, text, marks, theme, onApply, onClose, onPreview, onResetPreview }: {
  selection: SelectionRange; text: string; marks: PromptMark[]; theme: MarkTheme;
  onApply: (marks: PromptMark[]) => void | Promise<void>; onClose: () => void;
  onPreview: (marks: PromptMark[]) => void; onResetPreview: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [colorKind, setColorKind] = useState<Exclude<MarkKind, "bold"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 228, height: 42 });
  useLayoutEffect(() => {
    if (colorKind) return;
    const place = () => setPosition(placeMarkToolbar(selection.host.getBoundingClientRect(), selection.bounds, window.innerWidth, window.innerHeight));
    place();
    const observer = new ResizeObserver(place); observer.observe(selection.host);
    window.addEventListener("resize", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [selection, colorKind]);
  useEffect(() => {
    if (colorKind) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } };
    const toolbar = toolbarRef.current;
    toolbar?.addEventListener("prompt-mark-dismiss", onClose);
    window.addEventListener("keydown", escape, true);
    return () => { toolbar?.removeEventListener("prompt-mark-dismiss", onClose); window.removeEventListener("keydown", escape, true); };
  }, [colorKind, onClose]);
  const persist = async (next: PromptMark[]) => {
    if (busy) return;
    setBusy(true);
    try { await onApply(next); onClose(); }
    catch { showToast("文字格式未保存，请重试", "error"); }
    finally { setBusy(false); }
  };
  if (colorKind) return <ColorPanel key={colorKind} selection={selection} text={text} marks={marks} theme={theme} initialKind={colorKind} onApply={onApply} onClose={onClose} onPreview={onPreview} onBack={() => { onResetPreview(); setColorKind(null); }} />;
  return createPortal(<div ref={toolbarRef} className="prompt-format-toolbar" role="toolbar" aria-label="文字格式工具栏" data-no-drag style={position}
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <button type="button" aria-label="加粗" title="加粗／取消加粗" aria-pressed={isRangeBold(text, marks, selection.start, selection.end)} disabled={busy} onClick={() => void persist(toggleBold(text, marks, selection.start, selection.end))}><b>B</b></button>
    <button type="button" aria-label="背景高亮" title="文字背景高亮" disabled={busy} onClick={() => setColorKind("background")}><span className="format-highlight"><PencilLine className="h-4 w-4" /></span></button>
    <button type="button" aria-label="文字颜色" title="文字颜色" disabled={busy} onClick={() => setColorKind("text")}><span className="format-text-color">A</span></button>
    <span className="format-toolbar-divider" aria-hidden="true" />
    <button type="button" aria-label="复制选中文字" title="复制选中文字" disabled={busy} onClick={() => {
      if (!navigator.clipboard?.writeText) { showToast("当前页面不支持复制，请在独立窗口中重试", "error"); return; }
      setBusy(true);
      void navigator.clipboard.writeText(text.slice(selection.start, selection.end)).then(() => { showToast("已复制选中文字"); onClose(); }).catch(() => showToast("复制失败，请重试", "error")).finally(() => setBusy(false));
    }}><Copy className="h-4 w-4" /></button>
    <button type="button" aria-label="清除全部标记" title="清除选区格式" disabled={busy} onClick={() => void persist(clearMarks(text, marks, selection.start, selection.end))}><Eraser className="h-4 w-4" /></button>
    <button type="button" aria-label="关闭文字工具栏" title="关闭" onClick={onClose}><X className="h-4 w-4" /></button>
  </div>, selection.host);
}

export function PromptText({ text, marks: rawMarks, editable = false, onTextChange, onMarksChange, onReadEdit, className = "", ...props }: Props) {
  const wrapper = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), reader = useRef<HTMLPreElement>(null), mirror = useRef<HTMLPreElement>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [theme, setTheme] = useState<MarkTheme>("light");
  const [mirrorStyle, setMirrorStyle] = useState<CSSProperties>({});
  const [previewMarks, setPreviewMarks] = useState<PromptMark[] | null>(null);
  const marks = useMemo(() => normalizeMarks(text, rawMarks ?? []), [text, rawMarks]);
  const displayMarks = previewMarks ?? marks;
  const preview = useCallback((next: PromptMark[]) => setPreviewMarks(next), []);
  const dismissPanel = useCallback(() => {
    setSelection(null); setPreviewMarks(null);
    if (textarea.current) { const end = selection?.end ?? textarea.current.selectionEnd; textarea.current.setSelectionRange(end, end); textarea.current.focus({ preventScroll: true }); }
    else { const root = reader.current?.getRootNode() as Document; (root?.getSelection?.() ?? window.getSelection())?.removeAllRanges(); reader.current?.focus({ preventScroll: true }); }
  }, [selection]);
  useLayoutEffect(() => {
    const root = wrapper.current?.getRootNode(), host = root instanceof ShadowRoot ? root.host : document.documentElement;
    const update = () => setTheme(host.getAttribute("data-theme") === "dark" ? "dark" : "light"); update();
    const observer = new MutationObserver(update); observer.observe(host, { attributes: true, attributeFilter: ["data-theme"] }); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input || !displayMarks.length) return;
    const sync = () => {
      const style = getComputedStyle(input);
      setMirrorStyle({ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, wordSpacing: style.wordSpacing, padding: style.padding, borderWidth: style.borderWidth, borderStyle: "solid", borderColor: "transparent", boxSizing: "border-box", width: input.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth), whiteSpace: style.whiteSpace === "pre" ? "pre" : "pre-wrap", overflowWrap: style.overflowWrap as CSSProperties["overflowWrap"], tabSize: style.tabSize, transform: `translate(${-input.scrollLeft}px, ${input.offsetTop - input.scrollTop}px)` });
    };
    sync(); input.addEventListener("scroll", sync); const observer = new ResizeObserver(sync); observer.observe(input);
    return () => { input.removeEventListener("scroll", sync); observer.disconnect(); };
  }, [text, editable, Boolean(displayMarks.length)]);
  useEffect(() => {
    if (!selection) return;
    const host = selection.host;
    const previousPosition = host.style.position;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const close = (event: Event) => { const path = event.composedPath(); if (path.some(node => node instanceof Element && node.closest(".prompt-color-panel, .prompt-format-toolbar"))) return; if (!path.includes(wrapper.current!)) { setSelection(null); setPreviewMarks(null); } };
    document.addEventListener("pointerdown", close, true);
    return () => { document.removeEventListener("pointerdown", close, true); host.style.position = previousPosition; };
  }, [selection]);
  const select = () => {
    if (!onMarksChange || props.disabled) return;
    const element = editable ? textarea.current : reader.current;
    if (!element) return;
    let start = 0, end = 0, rect = element.getBoundingClientRect();
    if (editable && textarea.current) { start = textarea.current.selectionStart; end = textarea.current.selectionEnd; if (start !== end) rect = textareaSelectionBounds(textarea.current, start, end); }
    else {
      const root = element.getRootNode() as Document & { getSelection(): Selection | null };
      const selected = root.getSelection?.() ?? window.getSelection();
      if (!selected?.rangeCount || !element.contains(selected.anchorNode) || !element.contains(selected.focusNode)) return;
      const range = selected.getRangeAt(0), before = range.cloneRange(); before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset); start = before.toString().length; end = start + range.toString().length;
      rect = range.getBoundingClientRect();
    }
    if (start === end) { setSelection(null); return; }
    const host = element.closest<HTMLElement>("[role='dialog'], .fluxora-shell, .settings-page") ?? wrapper.current!;
    const bounds = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    setSelection({ start, end, x: rect.left, y: rect.bottom, bounds, host });
  };
  return <div ref={wrapper} className="prompt-mark-field" data-prompt-text>
    {editable ? <>
      <textarea {...props} ref={textarea} value={text} className={`${className}${displayMarks.length ? " has-prompt-marks" : ""}${previewMarks ? " is-mark-preview" : ""}`} onSelect={select} onChange={event => { setSelection(null); setPreviewMarks(null); onTextChange?.(event.target.value, remapMarks(text, event.target.value, marks)); }} />
      {displayMarks.length ? <div className="prompt-mark-mirror" aria-hidden="true"><pre ref={mirror} style={mirrorStyle}><MarkedContent text={text + (text.endsWith("\n") ? " " : "")} marks={displayMarks} theme={theme} /></pre></div> : null}
    </> : <pre ref={reader} className={`${className}${previewMarks ? " is-mark-preview" : ""}`} aria-label={props["aria-label"]} tabIndex={onReadEdit || onMarksChange ? 0 : undefined} onMouseUp={select} onKeyUp={select} onClick={event => {
      const root = reader.current?.getRootNode() as Document, selected = root?.getSelection?.() ?? window.getSelection();
      if (selected?.toString()) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-prompt-mark]") : null;
      if (target && onMarksChange) {
        const rect = target.getBoundingClientRect(), host = target.closest<HTMLElement>("[role='dialog'], .fluxora-shell, .settings-page") ?? wrapper.current!;
        setSelection({ start: Number(target.dataset.markStart), end: Number(target.dataset.markEnd), x: rect.left, y: rect.bottom, bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, host });
      } else if (!selection) onReadEdit?.();
    }} onKeyDown={event => { if ((event.key === "Enter" || event.key === " ") && onReadEdit) { event.preventDefault(); onReadEdit(); } }}><MarkedContent text={text} marks={displayMarks} theme={theme} /></pre>}
    {selection && onMarksChange ? <SelectionTools key={`${selection.start}:${selection.end}`} selection={selection} text={text} marks={marks} theme={theme} onPreview={preview} onResetPreview={() => setPreviewMarks(null)} onApply={onMarksChange} onClose={dismissPanel} /> : null}
  </div>;
}
