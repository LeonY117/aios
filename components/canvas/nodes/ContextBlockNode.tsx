"use client";

import { memo, useCallback, useState } from "react";
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

function ContextBlockNode({
  id,
  data,
  selected,
}: NodeProps & { data: ContextBlockData }) {
  const { setNodes } = useReactFlow();
  const handleTitleChange = useCallback(
    (title: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as ContextBlockData), title } }
            : n,
        ),
      );
    },
    [id, setNodes],
  );
  const [copied, setCopied] = useState(false);
  const isConnecting = useStore(selectIsConnecting);
  const sotNodes = useStore(selectConnectedSots(id));

  const tokenEstimate = sotNodes.reduce(
    (sum, n) => sum + ((n.data as SotNodeData).content?.length ?? 0),
    0,
  );
  const tokenCount = Math.round(tokenEstimate / 4);

  const handleCopy = () => {
    const compiled = compileContext(sotNodes);
    if (!compiled) return;
    navigator.clipboard.writeText(compiled);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <NodeResizer
        isVisible
        minWidth={240}
        minHeight={160}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!hidden"
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
      <div className="context-drop-content flex h-full flex-col rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 p-4 shadow-sm transition-all duration-150 hover:border-indigo-400">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <EditableTitle
            title={data.title}
            onChange={handleTitleChange}
            className="text-sm font-semibold text-indigo-900"
          />
          <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-600">
            context
          </span>
        </div>

        {/* Connected sources list */}
        <div className="min-h-0 flex-1 overflow-y-auto nowheel">
          {sotNodes.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Drag SOT connections here to build context
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sotNodes.map((n) => {
                const d = n.data as SotNodeData;
                return (
                  <li
                    key={n.id}
                    className="flex items-center gap-2 rounded bg-white px-2 py-1.5 text-xs text-gray-700 border border-gray-100"
                  >
                    <span className="truncate flex-1">{d.title}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {d.sourceType}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {sotNodes.length} source{sotNodes.length !== 1 ? "s" : ""}
            {tokenCount > 0 && ` · ~${tokenCount.toLocaleString()} tokens`}
          </span>
          <button
            onClick={handleCopy}
            disabled={sotNodes.length === 0}
            className="nodrag rounded px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {copied ? "Copied!" : "Copy Context"}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(ContextBlockNode);
