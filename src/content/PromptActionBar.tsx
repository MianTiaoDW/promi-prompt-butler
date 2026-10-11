import { BookmarkPlus, Check, Copy, Image } from "lucide-react";

interface PromptActionBarProps {
  copied?: boolean;
  saved?: boolean;
  onCopy: () => void;
  onSave: () => void;
  onSendToImage: () => void;
}

export function PromptActionBar(props: PromptActionBarProps) {
  const actions = [
    { label: props.copied ? "已复制" : "复制", icon: props.copied ? Check : Copy, onClick: props.onCopy },
    { label: props.saved ? "已保存到提示词库" : "保存到提示词库", icon: BookmarkPlus, onClick: props.onSave, active: props.saved },
    { label: "发送到图像工坊", icon: Image, onClick: props.onSendToImage }
  ];

  return (
    <div className="prompt-action-bar" aria-label="提示词操作">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          title={action.label}
          aria-label={action.label}
          className={action.active ? "is-active" : ""}
          onClick={action.onClick}
        >
          <action.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
