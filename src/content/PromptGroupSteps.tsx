import { useState } from "react";
import { PromptText } from "../components/PromptText";
import { remapMarks, type PromptMark } from "../lib/prompt-marks";
import { Check, Copy, PencilLine, Trash2, X } from "../components/PromiIcons";
import type { PromptGroup } from "../types/prompt";
import { showToast } from "../lib/toast";

export function PromptGroupSteps({ group, onSave, allowEditing = true }: { group: PromptGroup; onSave?: (group: PromptGroup) => Promise<void>; allowEditing?: boolean }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [marks, setMarks] = useState<PromptMark[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const persist = async (next: PromptGroup) => {
    if (!onSave || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(next);
      setEditing(null);
      showToast("步骤修改已保存");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，请重试。"); }
    finally { setSaving(false); }
  };
  return <div className="space-y-3" aria-busy={saving}>{error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}{group.steps.map((step, index) => <section key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="min-w-0 break-words text-sm font-medium">{index + 1}{step.name ? ` · ${step.name}` : ""}</h3>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="icon-button" aria-label={`复制第 ${index + 1} 步`} onClick={async () => { try { await navigator.clipboard.writeText(step.content); showToast("已复制这一步的正文"); } catch { showToast("复制失败，请重试"); } }}><Copy className="h-4 w-4" /></button>
        {onSave && allowEditing ? <><button type="button" className="icon-button" disabled={saving} aria-label={`编辑第 ${index + 1} 步`} onClick={() => { setEditing(index); setError(""); setName(step.name); setContent(step.content); setMarks(step.marks ?? []); }}><PencilLine className="h-4 w-4" /></button>
        <button type="button" className="icon-button" disabled={saving || group.steps.length === 1} title={group.steps.length === 1 ? "至少保留一步" : "删除这一步"} aria-label={`删除第 ${index + 1} 步`} onClick={() => void persist({ ...group, steps: group.steps.filter((_, position) => position !== index) })}><Trash2 className="h-4 w-4" /></button></> : null}
      </div>
    </div>
    {editing === index ? <div data-enter-confirm className="space-y-3">
      <input className="form-field w-full rounded-xl p-3 text-sm" disabled={saving} aria-label="步骤名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="步骤名称（可选）" />
      <PromptText editable className="form-field min-h-[160px] w-full rounded-xl p-3 text-sm" disabled={saving} aria-label="步骤正文" text={content} marks={marks} onTextChange={(text, next) => { setContent(text); setMarks(next); }} onMarksChange={setMarks} />
      <div className="flex justify-end gap-2"><button type="button" className="ghost-button px-3 py-2 text-xs" disabled={saving} onClick={() => { setEditing(null); setError(""); }}><X className="h-4 w-4" />取消</button><button type="button" data-enter-submit className="gradient-button px-3 py-2 text-xs" disabled={saving || !content.trim()} onClick={() => void persist({ ...group, steps: group.steps.map((item, position) => position === index ? { name: name.trim(), content: content.trim(), marks: remapMarks(content, content.trim(), marks) } : item) })}><Check className="h-4 w-4" />{saving ? "保存中…" : "保存"}</button></div>
    </div> : <PromptText text={step.content} marks={step.marks} className="whitespace-pre-wrap break-words text-sm leading-7 text-white/75" onMarksChange={onSave && !saving ? async marks => { await onSave({ ...group, steps: group.steps.map((item, position) => position === index ? { ...item, marks } : item) }); } : undefined} />}
  </section>)}</div>;
}
