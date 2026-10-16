export const FOLDER_COLORS = [
  { id: "red", name: "红色", front: "#e55362", back: "#bd3449", ink: "#ffffff" },
  { id: "orange", name: "橙色", front: "#ed8d35", back: "#bf651b", ink: "#382312" },
  { id: "yellow", name: "黄色", front: "#e8c64a", back: "#bd981f", ink: "#352c15" },
  { id: "green", name: "绿色", front: "#40a771", back: "#258050", ink: "#102d20" },
  { id: "cyan", name: "青色", front: "#36b9c2", back: "#208d97", ink: "#113136" },
  { id: "blue", name: "蓝色", front: "#1271ff", back: "#005fee", ink: "#ffffff" },
  { id: "purple", name: "紫色", front: "#9565d6", back: "#7345b3", ink: "#ffffff" },
  { id: "black", name: "黑色", front: "#252831", back: "#14171e", ink: "#ffffff" },
  { id: "white", name: "白色", front: "#f3f5f8", back: "#ccd2dc", ink: "#252b36" },
  { id: "gray", name: "灰色", front: "#8b939f", back: "#68717e", ink: "#1d232d" }
] as const;

export type FolderColor = typeof FOLDER_COLORS[number]["id"];
export function getFolderColor(color?: string) {
  return FOLDER_COLORS.find((item) => item.id === color) ?? FOLDER_COLORS.find((item) => item.id === "blue")!;
}
export function validateFolderColor(color: string): FolderColor {
  if (!FOLDER_COLORS.some((item) => item.id === color)) throw new Error("请选择有效的收藏夹颜色。");
  return color as FolderColor;
}
