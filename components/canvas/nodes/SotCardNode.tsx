"use client";

import { memo, useCallback } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import RichTextEditor from "../RichTextEditor";
import EditableTitle from "./EditableTitle";
import type { SotNodeData } from "@/types";

const sourceBadgeColors: Record<SotNodeData["sourceType"], string> = {
  notion: "bg-gray-800 text-white",
  github: "bg-purple-600 text-white",
  slack: "bg-[#4A154B] text-white",
  url: "bg-blue-500 text-white",
  chatgpt: "bg-emerald-600 text-white",
  manual: "bg-green-600 text-white",
};

function LoadingSkeleton({ data }: { data: SotNodeData }) {
  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {data.title}
        </h3>
        <span
          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
        >
          {data.sourceType}
        </span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

function SotCardNode({
  id,
  data,
  selected,
}: NodeProps & { data: SotNodeData }) {
  const { setNodes } = useReactFlow();
  const isRichText = data.sourceType === "manual" && data.isRichText;

  const handleContentChange = useCallback(
    (html: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as SotNodeData), content: html } }
            : n,
        ),
      );
    },
    [id, setNodes],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as SotNodeData), title } }
            : n,
        ),
      );
    },
    [id, setNodes],
  );

  if (data.isLoading) {
    return (
      <>
        <NodeResizer
          isVisible={selected}
          minWidth={240}
          minHeight={120}
          lineClassName="!border-transparent !border-[6px]"
          handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
        />
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-300 !border-gray-400 opacity-0 hover:opacity-100 transition-opacity" />
        <LoadingSkeleton data={data} />
      </>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={120}
        lineClassName="!border-transparent !border-[6px]"
        handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
      />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-300 !border-gray-400 opacity-0 hover:opacity-100 transition-opacity" />
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <EditableTitle
            title={data.title}
            onChange={handleTitleChange}
          />
          <span
            className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
          >
            {data.sourceType}
          </span>
        </div>

        {/* Content */}
        {isRichText ? (
          <div className="nodrag min-h-0 flex-1 overflow-hidden cursor-text">
            <RichTextEditor
              content={data.content}
              onChange={handleContentChange}
              autoFocus={!!data.isEditing}
              selected={selected}
            />
          </div>
        ) : (
          <div className="nowheel min-h-0 flex-1 overflow-y-auto px-4 pb-3 text-xs leading-relaxed text-gray-600 prose prose-xs prose-gray">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(SotCardNode);
