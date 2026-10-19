async function readClipboardPng(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("图片读取失败，请重新打开预览后重试。");
  const source = await response.blob();
  if (source.type === "image/png") return source;

  // Clipboard image support is narrower than the formats an <img> can display.
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法处理图片，请下载后使用。");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片转换失败，请重试。")), "image/png");
    });
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}

export async function copyImageToClipboard(url: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前页面不支持复制图片，请在独立插件窗口中重试或下载图片。");
  }
  // Invoke write during the click, before fetching/decoding consumes activation.
  const png = readClipboardPng(url);
  // A rejected write can leave the deferred image unread by the browser.
  void png.catch(() => undefined);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
