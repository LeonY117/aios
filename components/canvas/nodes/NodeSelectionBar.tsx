"use client";

import { NodeToolbar, Position } from "@xyflow/react";

type NodeSelectionBarProps = {
  children: React.ReactNode;
};

/**
 * Floating action bar that appears below a node when selected.
 * Uses React Flow's NodeToolbar for automatic viewport-aware positioning.
 */
export default function NodeSelectionBar({ children }: NodeSelectionBarProps) {
  return (
    <NodeToolbar
      position={Position.Bottom}
      offset={8}
      align="center"
      className="nodrag flex items-center gap-0.5 rounded-lg border border-line bg-surface px-1.5 py-1 shadow-md"
    >
      {children}
    </NodeToolbar>
  );
}
