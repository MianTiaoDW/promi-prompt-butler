import type { ComponentType, ReactNode } from "react";
interface RubberSegmentProps {
  items: Array<string | { value: string; label: ReactNode; icon?: ReactNode }>;
  value?: string;
  onChange?: (value: string, index: number) => void;
  trackColor?: string;
  thumbColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  inset?: number;
  equalSlots?: boolean;
  stretch?: number;
  squash?: number;
  speed?: number;
  glide?: number;
  draggable?: boolean;
  className?: string;
  "aria-label"?: string;
}
declare const RubberSegment: ComponentType<RubberSegmentProps>;
export default RubberSegment;
