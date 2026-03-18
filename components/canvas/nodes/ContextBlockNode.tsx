"use client";

import { memo, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useStore,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import { compileContext } from "@/lib/context-export";
import type { ContextBlockData, SotNodeData } from "@/types";
import type { Node } from "@xyflow/react";

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
  const [copied, setCopied] = useState(false);
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
        isVisible={selected}
        minWidth={240}
        minHeight={160}
        lineClassName="!border-transparent !border-[6px]"
        handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-400 !border-indigo-500"
      />
      <div className="flex h-full flex-col rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-4 shadow-sm">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-indigo-900">
            {data.title}
          </h3>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-600">
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
