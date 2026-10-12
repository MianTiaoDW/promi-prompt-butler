import type { ComponentType, ReactNode } from "react";
interface FolderFloatProps {
  items: Array<{ label: string; value: string }>;
  label: string;
  labelEditor?: ReactNode;
  sublabel?: string;
  width?: number;
  height?: number;
  spread?: number;
  lift?: number;
  tilt?: number;
  physics?: boolean;
  disabled?: boolean;
  folderColor?: string;
  frontColor?: string;
  labelColor?: string;
  itemColor?: string;
  itemTextColor?: string;
  onOpenFolder?: () => void;
  onRename?: () => void;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (value: string, index: number) => void;
}
declare const FolderFloat: ComponentType<FolderFloatProps>;
export default FolderFloat;
