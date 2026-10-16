import { useEffect, useRef, useState, type ReactNode } from "react";
import FolderFloat from "../components/FolderFloat/FolderFloat";
import type { SavedPromptRecord } from "../types/prompt";
import { getFolderColor } from "../lib/folder-colors";

export function CollectionFolder({ name, color, records, disabled, onOpen, onRename, onHover, labelEditor }: { name: string; color?: string; records: SavedPromptRecord[]; disabled: boolean; onOpen: () => void; onRename: () => void; labelEditor?: ReactNode; onHover: (open: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(146);
  useEffect(() => {
    const element = ref.current!;
    const observer = new ResizeObserver(() => setWidth(Math.max(96, element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="collection-folder" ref={ref}><FolderFloat
    width={width} height={Math.round(width * 0.74)} spread={Math.min(width / 2 - 10, 110)} lift={24} tilt={4} physics={false}
    label={name} labelEditor={labelEditor} sublabel={`${records.length} 条`} items={[]}
    folderColor={getFolderColor(color).back} frontColor={getFolderColor(color).front} labelColor={getFolderColor(color).ink} itemColor="var(--bg-elevated)" itemTextColor="var(--text-primary)"
    disabled={disabled} onOpenFolder={onOpen} onRename={onRename} onOpenChange={onHover}
  /></div>;
}
