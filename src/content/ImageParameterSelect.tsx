import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown } from "../components/PromiIcons";

export function ImageParameterSelect({ label, value, options, onChange, className = "" }: {
  label: string;
  value: string;
  options: { value: string; label: string; href?: string; linkLabel?: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, options.findIndex(option => option.value === value))]?.focus();
    const close = (event: PointerEvent) => {
      if (root.current && !event.composedPath().includes(root.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div ref={root} className={`image-parameter-select ${className}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <span className="mb-1.5 block text-xs text-white/50">{label}</span>
    <button ref={trigger} type="button" className="form-field image-parameter-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
    }}>
      {options.find(option => option.value === value)?.label}<ChevronDown className="h-4 w-4" />
    </button>
    {open ? <div className="image-parameter-menu" role="listbox" aria-label={label} onKeyDown={event => {
      const scope = root.current?.getRootNode() as Document | ShadowRoot;
      const index = items.current.indexOf(scope.activeElement as HTMLButtonElement);
      let next = index;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
      if (event.key === "ArrowDown") next = Math.min(options.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      else return;
      event.preventDefault(); items.current[next]?.focus();
    }}>
      {options.map((option, index) => option.linkLabel ? <div key={option.value} ref={element => { items.current[index] = element; }} className="image-parameter-option" role="option" aria-selected={option.value === value} tabIndex={-1} onClick={() => {
        onChange(option.value); setOpen(false); trigger.current?.focus();
      }} onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault(); onChange(option.value); setOpen(false); trigger.current?.focus();
        }
      }}>
        <span className="provider-option-name">{option.label}</span>
        {option.value === value ? <Check className="h-4 w-4 shrink-0" /> : null}
        {option.href ? <a className="provider-api-link" href={option.href} target="_blank" rel="noopener noreferrer" aria-label={`${option.label}官方 API 平台`} title={`打开${option.label}官方 API 平台`} onClick={event => event.stopPropagation()}>{option.linkLabel}<ArrowUpRight className="h-3 w-3" /></a>
          : <span className="provider-api-unavailable" title="中转站不是单一平台，请到你使用的服务商网站创建密钥">自选平台</span>}
      </div> : <button ref={element => { items.current[index] = element; }} key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => {
        onChange(option.value); setOpen(false); trigger.current?.focus();
      }}>{option.label}{option.value === value ? <Check className="h-4 w-4" /> : null}</button>)}
    </div> : null}
  </div>;
}
