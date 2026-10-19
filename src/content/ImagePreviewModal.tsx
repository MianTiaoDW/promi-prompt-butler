import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Close, Copy, Download } from "../components/PromiIcons";

import { useModalFocus } from "../hooks/useModalFocus";
import { MOTION } from "../lib/motion";
import { sendRuntimeMessage } from "../lib/runtime";
import { showToast } from "../lib/toast";
import { copyImageToClipboard } from "../lib/image-clipboard";

export interface ImagePreviewAsset {
  id?: string;
  url: string;
  alt?: string;
}

export function ImagePreviewModal(props: {
  image: ImagePreviewAsset | null;
  onClose: () => void;
}) {
  const { image, onClose } = props;
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useModalFocus<HTMLDivElement>(Boolean(image), onClose);
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setIsCopying(false);
    setIsDownloading(false);
  }, [image?.url]);

  const copyImage = async () => {
    if (!image || isCopying) return;
    setIsCopying(true);
    try {
      await copyImageToClipboard(image.url);
      showToast("已复制到剪贴板~");
    } catch (error) {
      console.warn("[Prompt Butler] 图片复制失败：", error);
      showToast(error instanceof DOMException && error.name === "NotAllowedError"
        ? "剪贴板访问被拒绝，请回到插件窗口点击复制。"
        : error instanceof Error && !(error instanceof DOMException) ? error.message : "图片复制失败，请下载后使用。", "error");
    } finally {
      setIsCopying(false);
    }
  };

  const downloadImage = async () => {
    if (!image || isDownloading) return;
    setIsDownloading(true);
    try {
      const url = image.url.startsWith("blob:") ? await fetch(image.url).then(response => response.blob()).then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
      })) : image.url;
      await sendRuntimeMessage<number[]>({
        type: "image:download",
        payload: { urls: [url] }
      });
      showToast("已开始下载~");
    } catch {
      showToast("下载失败，请重试。", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {image ? (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="图片大图预览"
          tabIndex={-1}
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.modalMs / 1000, ease: MOTION.easeOut }}
          onMouseDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="relative max-h-[90vh] max-w-[90vw]"
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }}
            transition={{ duration: shouldReduceMotion ? 0.06 : MOTION.modalMs / 1000, ease: MOTION.easeOut }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <img
              src={image.url}
              alt={image.alt ?? "图片大图预览"}
              className="max-h-[85vh] max-w-[85vw] rounded-[1.35rem] object-contain shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
            />
            <div className="image-preview-actions absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
              <button
                type="button"
                onClick={() => void copyImage()}
                disabled={isCopying}
                className="ghost-button image-preview-copy border-white/20 bg-black/60 px-5 py-3 text-sm backdrop-blur hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Copy className="h-4 w-4" />
                复制
              </button>
              <button
                type="button"
                onClick={() => void downloadImage()}
                disabled={isDownloading}
                className="gradient-button px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Download className="h-4 w-4" />
                下载
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="image-preview-close absolute right-4 top-4"
              aria-label="关闭图片预览"
              title="关闭"
            >
              <Close className="h-6 w-6" />
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
