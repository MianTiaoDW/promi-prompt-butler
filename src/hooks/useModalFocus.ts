import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function useModalFocus<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    const root = dialog?.getRootNode() as Document | ShadowRoot | undefined;
    const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    const previouslyFocused = activeElement instanceof HTMLElement ? activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const currentDialog = dialogRef.current;
      const firstFocusable = currentDialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? currentDialog)?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const root = dialog.getRootNode() as Document | ShadowRoot;
      const openDialogs = Array.from(root.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"));
      if (openDialogs[openDialogs.length - 1] !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        const colorPanel = dialog.querySelector(".prompt-color-panel, .prompt-format-toolbar");
        if (colorPanel) { colorPanel.dispatchEvent(new Event("prompt-mark-dismiss")); return; }
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return dialogRef;
}
