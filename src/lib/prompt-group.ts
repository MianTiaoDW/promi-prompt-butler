import type { PromptGroup, SavedPromptRecord } from "../types/prompt";

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
  return { notes: "", steps: [{ name: "", content: record.content }] };
}
