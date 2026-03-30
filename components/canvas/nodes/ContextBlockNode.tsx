"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { compileContext } from "@/lib/context-export";
import EditableTitle from "./EditableTitle";
import type { ContextBlockData, SotNodeData } from "@/types";
import type { Node } from "@xyflow/react";

const selectIsConnecting = (state: ReactFlowState) =>
  state.connection.inProgress;

function selectConnectedSots(id: string) {
  return (state: ReactFlowState) => {
    const connectedSotIds = state.edges
      .filter((e) => e.target === id)
      .map((e) => e.source);
    return state.nodes.filter((n) =>
      connectedSotIds.includes(n.id),
    ) as Node<SotNodeData>[];
  };
}

import { shallowArrayEqual } from "@/lib/canvas/shallow-equal";
import { copyWithFeedback } from "@/lib/canvas/clipboard";
import { updateNodeData, updateNode } from "@/lib/canvas/actions";
import NodeWindowControls from "./NodeWindowControls";
import MinimizedNodeView from "./MinimizedNodeView";
import MaximizePortal from "./MaximizePortal";
import type { NodeViewMode } from "@/types";

function ContextBlockNode({
  id,
  data,
  selected,
}: NodeProps & { data: ContextBlockData }) {
  const { setNodes } = useReactFlow();
  const handleTitleChange = useCallback(
    (title: string) => {
      setNodes((nds) => updateNodeData<ContextBlockData>(nds, id, { title }));
    },
    [id, setNodes],
  );
  const [copied, setCopied] = useState(false);
  const isConnecting = useStore(selectIsConnecting);
  const sotSelector = useMemo(() => selectConnectedSots(id), [id]);
  const sotNodes = useStore(sotSelector, shallowArrayEqual);

  const tokenEstimate = sotNodes.reduce(
    (sum, n) => sum + ((n.data as SotNodeData).content?.length ?? 0),
    0,
  );
  const tokenCount = Math.round(tokenEstimate / 4);

  const wordCount = useMemo(() => {
    const text = sotNodes.map((n) => {
      const content = (n.data as SotNodeData).content ?? "";
      return content.replace(/<[^>]*>/g, " ");
    }).join(" ");
    return text.split(/\s+/).filter(Boolean).length;
  }, [sotNodes]);

  const handleCopy = () => {
    const compiled = compileContext(sotNodes);
    if (!compiled) return;
    copyWithFeedback(compiled, setCopied);
  };

  const handleViewModeChange = useCallback(
    (viewMode: NodeViewMode) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === id);
        if (!node) return nds;
        const currentHeight = node.measured?.height ?? (node.style as Record<string, unknown>)?.height as number | undefined;
        const savedHeight = (node.data as ContextBlockData & { _savedHeight?: number })._savedHeight;

        if (viewMode === "minimized") {
          return updateNode<ContextBlockData>(nds, id, { viewMode, _savedHeight: currentHeight } as Partial<ContextBlockData>, { height: undefined });
        }
        const restoreHeight = savedHeight ?? currentHeight;
        return updateNode<ContextBlockData>(nds, id, { viewMode, _savedHeight: undefined } as Partial<ContextBlockData>, restoreHeight ? { height: restoreHeight } : {});
      });
    },
    [id, setNodes],
  );

  const viewMode = data.viewMode ?? "normal";

  // --- Shared sub-sections ---
  const sourcesList = (
    <div className="mx-auto max-w-xl">
      {sotNodes.length === 0 ? (
        <p className="text-xs text-fg-muted italic">
          Drag SOT connections here to build context
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sotNodes.map((n) => {
            const d = n.data as SotNodeData;
            return (
              <li
                key={n.id}
                className="flex items-center gap-2 rounded bg-surface px-2 py-1.5 text-xs text-fg-dim border border-line-subtle"
              >
                <span className="truncate flex-1">{d.title}</span>
                <span className="shrink-0 text-[10px] text-fg-muted">
                  {d.sourceType}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const footer = (
    <div className="mt-3 flex items-center justify-between px-4 pb-4">
      <span className="text-[10px] text-fg-muted">
        {sotNodes.length} source{sotNodes.length !== 1 ? "s" : ""}
        {tokenCount > 0 && ` · ~${tokenCount.toLocaleString()} tokens`}
      </span>
      <button
        onClick={handleCopy}
        disabled={sotNodes.length === 0}
        className="nodrag rounded px-3 py-1.5 text-xs font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {copied ? "Copied!" : "Copy Context"}
      </button>
    </div>
  );

  return (
    <>
      <NodeResizer
        isVisible={viewMode !== "minimized"}
        minWidth={240}
        minHeight={viewMode === "minimized" ? 0 : 160}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!w-3 !h-3 !bg-transparent !border-0"
      />
      {/* Full-size invisible target handle — only active during edge drag */}
      <Handle
        type="target"
        position={Position.Left}
        className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-lg !transform-none context-drop-handle"
        style={{
          top: 0,
          left: 0,
          transform: "none",
          pointerEvents: isConnecting ? "all" : "none",
        }}
      />
      <div className={`context-drop-content flex h-full flex-col rounded-lg border-2 border-dashed bg-accent-surface shadow-sm transition-all duration-150 ${selected ? "border-selection ring-2 ring-selection/30" : "border-accent-line hover:border-accent"}`}>
        {viewMode === "minimized" ? (
          <MinimizedNodeView title={data.title} wordCount={wordCount} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        ) : (
          <>
            <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing">
              <div className="h-[3px] w-6 rounded-full bg-accent-handle" />
            </div>

            {/* Header */}
            <div className="mb-3 px-4">
              <div className="flex items-start justify-between">
                <EditableTitle
                  title={data.title}
                  onChange={handleTitleChange}
                  className="text-sm font-semibold text-on-accent"
                />
                <NodeWindowControls viewMode={viewMode} onViewModeChange={handleViewModeChange} />
              </div>
              <span className="mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent-surface text-accent">
                context
              </span>
            </div>

            {viewMode !== "maximized" && (
              <>
                <div className={`min-h-0 flex-1 overflow-y-auto ${selected ? "nowheel" : ""} px-4`}>
                  {sourcesList}
                </div>
                {footer}
              </>
            )}
          </>
        )}
      </div>

      {/* Maximized overlay */}
      {viewMode === "maximized" && (
        <MaximizePortal onClose={() => handleViewModeChange("normal")}>
          <div className="flex h-3.5 shrink-0 items-center justify-center rounded-t-xl">
            <div className="h-[3px] w-6 rounded-full bg-handle" />
          </div>
          <div className="mb-3 px-4">
            <div className="flex items-start justify-between">
              <EditableTitle
                title={data.title}
                onChange={handleTitleChange}
                className="text-sm font-semibold text-on-accent"
              />
              <NodeWindowControls viewMode="maximized" onViewModeChange={handleViewModeChange} />
            </div>
            <span className="mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent-surface text-accent">
              context
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {sourcesList}
          </div>
          {footer}
        </MaximizePortal>
      )}
    </>
  );
}

export default memo(ContextBlockNode);
