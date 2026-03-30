"use client";

import type { NodeViewMode } from "@/types";
import { MinimizeIcon, MaximizeIcon, RestoreIcon } from "@/components/icons";

type NodeWindowControlsProps = {
  viewMode: NodeViewMode;
  onViewModeChange: (mode: NodeViewMode) => void;
};

export default function NodeWindowControls({
  viewMode,
  onViewModeChange,
}: NodeWindowControlsProps) {
  return (
    <div className="flex gap-0.5 ml-1.5 shrink-0">
      {viewMode === "minimized" ? (
        <button
          type="button"
          title="Restore"
          onClick={(e) => {
            e.stopPropagation();
            onViewModeChange("normal");
          }}
          className="nodrag rounded p-0.5 text-fg-faint hover:text-fg hover:bg-hover transition-colors cursor-pointer"
        >
          <RestoreIcon />
        </button>
      ) : viewMode === "maximized" ? (
        <>
          <button
            type="button"
            title="Minimize"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange("minimized");
            }}
            className="nodrag rounded p-0.5 text-fg-faint hover:text-fg hover:bg-hover transition-colors cursor-pointer"
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            title="Restore"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange("normal");
            }}
            className="nodrag rounded p-0.5 text-fg-faint hover:text-fg hover:bg-hover transition-colors cursor-pointer"
          >
            <RestoreIcon />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            title="Minimize"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange("minimized");
            }}
            className="nodrag rounded p-0.5 text-fg-faint hover:text-fg hover:bg-hover transition-colors cursor-pointer"
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            title="Maximize"
            onClick={(e) => {
              e.stopPropagation();
              onViewModeChange("maximized");
            }}
            className="nodrag rounded p-0.5 text-fg-faint hover:text-fg hover:bg-hover transition-colors cursor-pointer"
          >
            <MaximizeIcon />
          </button>
        </>
      )}
    </div>
  );
}
