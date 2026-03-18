"use client";

import { memo, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { compileContext } from "@/lib/context-export";
import type { ChatNodeData, SotNodeData } from "@/types";
import type { Node } from "@xyflow/react";

const sourceBadgeColors: Record<ChatNodeData["source"], string> = {
  chatgpt: "bg-emerald-600 text-white",
  claude: "bg-orange-500 text-white",
  manual: "bg-gray-600 text-white",
};

function ChatNode({ id, data, selected }: NodeProps & { data: ChatNodeData }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { getNodes, getEdges } = useReactFlow();

  const handleCopyContext = () => {
    const edges = getEdges();
    const allNodes = getNodes();
    const connectedSotIds = edges
      .filter((e) => e.target === id)
      .map((e) => e.source);
    const sotNodes = allNodes.filter((n) =>
      connectedSotIds.includes(n.id),
    ) as Node<SotNodeData>[];

    const compiled = compileContext(sotNodes);
    if (!compiled) return;

    navigator.clipboard.writeText(compiled);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokenEstimate = (() => {
    const edges = getEdges();
    const allNodes = getNodes();
    const connectedSotIds = edges
      .filter((e) => e.target === id)
      .map((e) => e.source);
    const sotNodes = allNodes.filter((n) =>
      connectedSotIds.includes(n.id),
    ) as Node<SotNodeData>[];
    const totalLen = sotNodes.reduce(
      (sum, n) => sum + ((n.data as SotNodeData).content?.length ?? 0),
      0,
    );
    return Math.round(totalLen / 4);
  })();

  if (data.isLoading) {
    return (
      <>
        <NodeResizer
          isVisible={selected}
          minWidth={300}
          minHeight={200}
          lineClassName="!border-transparent !border-[6px]"
          handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
        />
        <Handle type="target" position={Position.Left} />
        <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              Loading conversation…
            </h3>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        lineClassName="!border-transparent !border-[6px]"
        handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
      />
      <Handle type="target" position={Position.Left} />
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {data.title}
            </h3>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
              {data.messages.length} msgs
            </span>
            {data.model && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
                {data.model}
              </span>
            )}
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.source]}`}
            >
              {data.source}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleCopyContext}
              className="nodrag rounded px-2 py-1 text-[11px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              {copied ? "Copied!" : "Copy Context"}
            </button>
            {tokenEstimate > 0 && (
              <span className="text-[10px] text-gray-400">
                ~{tokenEstimate.toLocaleString()}t
              </span>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="nodrag rounded px-2 py-1 text-[11px] font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {/* Messages */}
        {expanded && (
          <div className="nodrag nowheel min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
            {data.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <div
                    className={`prose prose-xs ${msg.role === "user" ? "prose-invert" : "prose-gray"}`}
                  >
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const inline =
                            !className &&
                            typeof children === "string" &&
                            !children.includes("\n");
                          if (inline) {
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <SyntaxHighlighter
                              style={oneLight}
                              language={match?.[1] ?? "text"}
                              PreTag="div"
                              customStyle={{ fontSize: "11px" }}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default memo(ChatNode);
