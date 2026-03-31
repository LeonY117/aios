"use client";

import { createPortal } from "react-dom";
import { ChatIcon } from "@/components/icons";

export default function BtwTooltip({
  x,
  y,
  onClick,
}: {
  x: number;
  y: number;
  onClick: () => void;
}) {
  return createPortal(
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="fixed z-[9998] flex items-center justify-center rounded-full border border-line bg-surface w-7 h-7 shadow-md text-fg-muted hover:text-fg hover:border-line-hover hover:shadow-lg transition-all animate-[fadeIn_0.1s_ease] select-none"
      style={{ left: x - 14, top: y - 36 }}
      title="Quick ask (btw)"
    >
      <ChatIcon />
    </button>,
    document.body,
  );
}
