import type { PromptGroup, SavedPromptRecord } from "../types/prompt";
import { normalizeMarks, type PromptMark } from "./prompt-marks";

export function getPromptContentMarks(record: SavedPromptRecord): PromptMark[] {
  if (!record.group) return normalizeMarks(record.content, record.marks ?? record.variantMarks?.[record.format] ?? []);
  const { group } = record;
  const result: PromptMark[] = [];
  let offset = group.notes ? `备注：${group.notes}\n\n`.length : 0;
  group.steps.forEach((step, index) => {
    const header = group.steps.length === 1 && !step.name ? "" : `第 ${index + 1} 步${step.name ? ` · ${step.name}` : ""}\n`;
    offset += header.length;
    result.push(...normalizeMarks(step.content, step.marks ?? []).map(mark => ({ ...mark, start: mark.start + offset, end: mark.end + offset })));
    offset += step.content.length + 2;
  });
  return normalizeMarks(record.content, result);
}

export function isCollectedPrompt(record: SavedPromptRecord) {
  return record.source !== "creator" && record.source !== "ai-generated";
}

export function formatPromptGroup(group: PromptGroup) {
  return [group.notes ? `备注：${group.notes}` : "", ...group.steps.map((step, index) =>
    group.steps.length === 1 && !step.name ? step.content : `第 ${index + 1} 步${step.name ? ` · ${step.name}` : ""}\n${step.content}`
  )].filter(Boolean).join("\n\n");
}

export function getPromptGroup(record: SavedPromptRecord): PromptGroup {
  if (record.group) return record.group;
  // Read the text format used by the previous group editor without changing ordinary prompts.
  const matches = [...record.content.matchAll(/(?:^|\n\n)第 (\d+) 步(?: · ([^\n]*))?\n/g)];
  if (matches.length && matches.every((match, index) => Number(match[1]) === index + 1)) {
    const prefix = record.content.slice(0, matches[0].index).trim();
    if (!prefix || prefix.startsWith("备注：")) {
      return { notes: prefix.replace(/^备注：/, ""), steps: matches.map((match, index) => ({
        name: match[2] || "", content: record.content.slice(match.index! + match[0].length, matches[index + 1]?.index ?? record.content.length).trim()
      })) };
    }
  }
  if (record.source === "user-created" && record.content.startsWith("备注：") && record.content.includes("\n\n")) {
    const separator = record.content.indexOf("\n\n");
    return { notes: record.content.slice(3, separator), steps: [{ name: "", content: record.content.slice(separator + 2) }] };
  }
  return { notes: "", steps: [{ name: "", content: record.content, marks: record.marks }] };
}
