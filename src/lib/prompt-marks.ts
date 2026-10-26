export type MarkKind = 'background' | 'text';
export type MarkTheme = 'light' | 'dark';

export interface PromptMark {
  start: number;
  end: number;
  kind: MarkKind;
  light: string;
  dark: string;
  opacity?: number;
}

function splitsSurrogate(text: string, offset: number): boolean {
  const previous = text.charCodeAt(offset - 1);
  const next = text.charCodeAt(offset);
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
}

function selectionRange(text: string, start: number, end: number): [number, number] | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null;
  start = Math.max(0, Math.min(text.length, start));
  end = Math.max(0, Math.min(text.length, end));
  if (start >= end) return null;
  if (splitsSurrogate(text, start)) start--;
  if (splitsSurrogate(text, end)) end++;
  return [start, end];
}

export function normalizeMarks(text: string, marks: unknown): PromptMark[] {
  if (!Array.isArray(marks)) return [];
  const result: PromptMark[] = [];
  const hex = /^#[0-9a-f]{6}$/i;
  for (const value of marks) {
    if (!value || typeof value !== 'object') continue;
    const mark = value as Partial<PromptMark>;
    if (mark.kind !== 'background' && mark.kind !== 'text') continue;
    if (typeof mark.light !== 'string' || !hex.test(mark.light) || typeof mark.dark !== 'string' || !hex.test(mark.dark)) continue;
    if (mark.opacity !== undefined && (typeof mark.opacity !== 'number' || !Number.isFinite(mark.opacity) || mark.opacity < 0 || mark.opacity > 1)) continue;
    if (typeof mark.start !== 'number' || typeof mark.end !== 'number') continue;
    const range = selectionRange(text, mark.start, mark.end);
    if (!range) continue;
    result.push({ start: range[0], end: range[1], kind: mark.kind, light: mark.light, dark: mark.dark, ...(mark.opacity !== undefined ? { opacity: mark.opacity } : {}) });
  }
  return result.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function clearMarks(text: string, marks: unknown, start: number, end: number, kind?: MarkKind): PromptMark[] {
  const normalized = normalizeMarks(text, marks);
  const range = selectionRange(text, start, end);
  if (!range) return normalized;
  const [from, to] = range;
  const result: PromptMark[] = [];
  for (const mark of normalized) {
    if ((kind && mark.kind !== kind) || mark.end <= from || mark.start >= to) {
      result.push(mark);
      continue;
    }
    if (mark.start < from) result.push({ ...mark, end: from });
    if (mark.end > to) result.push({ ...mark, start: to });
  }
  return normalizeMarks(text, result);
}

export function applyMark(text: string, marks: unknown, start: number, end: number, style: Omit<PromptMark, 'start' | 'end'>): PromptMark[] {
  const added = normalizeMarks(text, [{ ...style, start, end }])[0];
  if (!added) return normalizeMarks(text, marks);
  return normalizeMarks(text, [...clearMarks(text, marks, added.start, added.end, added.kind), added]);
}

export function remapMarks(before: string, after: string, marks: unknown): PromptMark[] {
  const normalized = normalizeMarks(before, marks);
  if (before === after) return normalized;
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  if (splitsSurrogate(before, prefix) || splitsSurrogate(after, prefix)) prefix--;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  if (splitsSurrogate(before, before.length - suffix) || splitsSurrogate(after, after.length - suffix)) suffix--;
  const removedEnd = before.length - suffix;
  const insertedEnd = after.length - suffix;
  const delta = after.length - before.length;
  const result: PromptMark[] = [];
  for (const mark of normalized) {
    // Only an insertion strictly inside an existing span inherits that span.
    if (prefix === removedEnd && mark.start < prefix && mark.end > prefix) {
      result.push({ ...mark, end: mark.end + delta });
      continue;
    }
    const leftEnd = Math.min(mark.end, prefix);
    const rightStart = Math.max(mark.start, removedEnd);
    const left = mark.start < leftEnd ? { ...mark, end: leftEnd } : null;
    const right = rightStart < mark.end ? { ...mark, start: rightStart + delta, end: mark.end + delta } : null;
    if (left && right && left.end === right.start && insertedEnd === prefix) {
      result.push({ ...left, end: right.end });
    } else {
      if (left) result.push(left);
      if (right) result.push(right);
    }
  }
  return normalizeMarks(after, result);
}

export function getMarkedSegments(text: string, marks: unknown): { text: string; start: number; marks: PromptMark[] }[] {
  const normalized = normalizeMarks(text, marks);
  const boundaries = [...new Set([0, text.length, ...normalized.flatMap(mark => [mark.start, mark.end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => ({
    text: text.slice(start, boundaries[index + 1]),
    start,
    marks: normalized.filter(mark => mark.start <= start && mark.end >= boundaries[index + 1]),
  }));
}
