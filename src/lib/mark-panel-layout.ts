interface Host { left: number; top: number; width: number; height: number }
export interface MarkSelectionBounds { left: number; top: number; right: number; bottom: number }

export function placeMarkPanel(host: Host, selected: MarkSelectionBounds, viewportWidth: number, viewportHeight: number) {
  const left = Math.max(host.left, 0) + 10, top = Math.max(host.top, 0) + 10;
  const right = Math.min(host.left + host.width, viewportWidth) - 10, bottom = Math.min(host.top + host.height, viewportHeight) - 10;
  const width = Math.min(280, Math.max(100, right - left)), gap = 12;
  let x = Math.max(left, Math.min(right - width, selected.left)), y: number, maxHeight: number;
  if (right - selected.right >= width + gap || selected.left - left >= width + gap) {
    x = right - selected.right >= width + gap ? selected.right + gap : selected.left - width - gap;
    maxHeight = Math.min(460, bottom - top); y = Math.max(top, Math.min(selected.top, bottom - maxHeight));
  } else {
    const above = Math.max(0, selected.top - gap - top), below = Math.max(0, bottom - selected.bottom - gap);
    const useBelow = below >= above;
    maxHeight = Math.min(400, Math.max(80, useBelow ? below : above));
    y = useBelow ? Math.min(selected.bottom + gap, bottom - maxHeight) : Math.max(top, selected.top - gap - maxHeight);
  }
  return { left: x - host.left, top: y - host.top, width, maxHeight };
}

// Pointer events may arrive faster than paint. Keep only the newest sample.
export function latestFrame(request: (callback: () => void) => number, cancel: (id: number) => void) {
  let id: number | null = null, pending: (() => void) | null = null;
  const run = () => { id = null; const action = pending; pending = null; action?.(); };
  return {
    schedule(action: () => void) { pending = action; if (id === null) id = request(run); },
    flush() { if (id !== null) cancel(id); run(); },
    cancel() { if (id !== null) cancel(id); id = null; pending = null; }
  };
}
