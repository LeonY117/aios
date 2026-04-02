"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeViewMode } from "@/types";
import NodeWindowControls from "./NodeWindowControls";

type MinimizedNodeViewProps = {
  title: string;
  wordCount: number;
  viewMode: NodeViewMode;
  onViewModeChange: (mode: NodeViewMode) => void;
};

export default memo(function MinimizedNodeView({
  title,
  wordCount,
  viewMode,
  onViewModeChange,
}: MinimizedNodeViewProps) {
  return (
    <div className="custom-drag-handle flex items-start gap-1.5 pt-3.5 px-4 pb-4 cursor-grab active:cursor-grabbing" onDoubleClick={() => onViewModeChange("normal")}>
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <span className="text-[18px] font-bold leading-[1.3] text-fg line-clamp-3">
          {title}
        </span>
        <span className="mt-1.5 text-[10px] text-fg-faint">
          {wordCount.toLocaleString()} words
        </span>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <NodeWindowControls
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!relative !inset-auto !w-4 !h-4 !bg-transparent !border-0 !rounded-full !transform-none !cursor-pointer connector-handle !mt-1 !ml-[5px]"
        >
          <div className="connector-handle-visual absolute inset-[-4px] rounded-full flex items-center justify-center pointer-events-none opacity-0 scale-90 transition-all duration-200 ease-out bg-surface border-[1.5px] border-line-hover shadow-sm">
            <svg
              width="10"
              height="10"
              viewBox="0 0 14 14"
              fill="none"
              className="text-fg-faint"
            >
              <path
                d="M7 2v10M2 7h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </Handle>
      </div>
    </div>
  );
});
