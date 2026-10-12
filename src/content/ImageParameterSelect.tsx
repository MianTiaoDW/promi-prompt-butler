import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "../components/PromiIcons";

export function ImageParameterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, options.findIndex(option => option.value === value))]?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div ref={root} className="image-parameter-select" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <span className="mb-1.5 block text-xs text-white/50">{label}</span>
    <button ref={trigger} type="button" className="form-field image-parameter-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
    }}>
      {options.find(option => option.value === value)?.label}<ChevronDown className="h-4 w-4" />
    </button>
    {open ? <div className="image-parameter-menu" role="listbox" aria-label={label} onKeyDown={event => {
      const index = items.current.indexOf(document.activeElement as HTMLButtonElement);
      let next = index;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
      if (event.key === "ArrowDown") next = Math.min(options.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      else return;
      event.preventDefault(); items.current[next]?.focus();
    }}>
      {options.map((option, index) => <button ref={element => { items.current[index] = element; }} key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => {
        onChange(option.value); setOpen(false); trigger.current?.focus();
      }}>{option.label}{option.value === value ? <Check className="h-4 w-4" /> : null}</button>)}
    </div> : null}
  </div>;
}
