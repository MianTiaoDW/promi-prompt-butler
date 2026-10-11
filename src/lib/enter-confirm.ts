import type { CompositionEvent, KeyboardEvent, PointerEvent } from "react";

const composing = new WeakSet<EventTarget>();
export function startInputComposition(event: CompositionEvent<HTMLElement>) { composing.add(event.target); }
export function finishInputComposition(event: CompositionEvent<HTMLElement>) { composing.delete(event.target); }

export function confirmInputOnBlankClick(event: PointerEvent<HTMLElement>) {
  if (event.button !== 0 || !(event.target instanceof Element)) return;
  // Controls retain their own actions, especially Cancel and switching fields.
  if (event.target.closest("button, input, textarea, select, label, a, [role='button'], [role='radio'], [contenteditable='true']")) return;
  const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
  const input = root.activeElement;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || composing.has(input)) return;
  const scope = input.closest("[data-enter-confirm]");
  const button = scope?.querySelector<HTMLButtonElement>("[data-enter-submit]");
  if (!button) { input.blur(); return; }
  // Prevent a backdrop close from discarding the editor before save completes.
  event.preventDefault();
  event.stopPropagation();
  if (!button.disabled) button.click();
}

export function confirmInputOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  if (input instanceof HTMLInputElement && ["file", "checkbox", "radio", "button", "submit"].includes(input.type)) return;
  event.preventDefault();
  if (event.repeat) return;
  const scope = input.closest("[data-enter-confirm]");
  const button = scope?.querySelector<HTMLButtonElement>("[data-enter-submit]");
  if (button) {
    // Let same-event combobox selection finish rendering before submitting settings.
    queueMicrotask(() => {
      const current = scope?.querySelector<HTMLButtonElement>("[data-enter-submit]");
      if (current?.isConnected && !current.disabled) current.click();
    });
  }
  else input.blur();
}
