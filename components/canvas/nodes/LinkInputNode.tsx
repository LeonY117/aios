"use client";

import { memo, useState } from "react";
import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import { handleLinkAdd } from "@/lib/hooks/useCanvasPaste";
import { LinkIcon } from "@/components/icons";

type LinkInputNodeData = Record<string, never>;

function LinkInputNode({
  id,
  selected,
}: NodeProps & { data: LinkInputNodeData }) {
  const { setNodes, getNode } = useReactFlow();
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const node = getNode(id);
    const position = node?.position ?? { x: 0, y: 0 };

    // Remove this input node
    setNodes((nds) => nds.filter((n) => n.id !== id));

    // Create the real node at the same position
    handleLinkAdd(trimmed, position, setNodes);
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={320}
        minHeight={140}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!w-3 !h-3 !bg-transparent !border-0"
      />
      <div className={`flex h-full flex-col rounded-lg border bg-surface shadow-sm transition-all duration-150 ${selected ? "border-selection ring-2 ring-selection/30" : "border-line hover:border-line-hover"}`}>
        <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing">
          <div className="h-[3px] w-6 rounded-full bg-handle" />
        </div>
        <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="mb-3 flex items-center gap-2">
          <LinkIcon width={16} height={16} className="shrink-0 text-fg-muted" />
          <span className="text-sm font-semibold text-fg">
            Add from Link
          </span>
        </div>

        <p className="mb-3 text-xs text-fg-muted">
          Paste a link (Notion, GitHub, Slack, ChatGPT, Claude, or any URL)
        </p>

        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") {
                setNodes((nds) => nds.filter((n) => n.id !== id));
              }
            }}
            placeholder="https://..."
            autoFocus
            className="nodrag flex-1 rounded-md border border-line-hover bg-transparent text-fg px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="nodrag rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

export default memo(LinkInputNode);
