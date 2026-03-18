"use client";

import { memo, useCallback } from "react";
import {
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import ConnectorHandle from "./ConnectorHandle";
import EditableTitle from "./EditableTitle";
import type { ChatNodeData } from "@/types";

function CodeBlock({
  className,
  children,
  ...props
}: { className?: string; children?: React.ReactNode }) {
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
}

const sourceBadgeColors: Record<ChatNodeData["source"], string> = {
  chatgpt: "bg-emerald-600 text-white",
  claude: "bg-orange-500 text-white",
  manual: "bg-gray-600 text-white",
};

function ChatNode({
  id,
  data,
  selected,
}: NodeProps & { data: ChatNodeData }) {
  const { setNodes } = useReactFlow();
  const handleTitleChange = useCallback(
    (title: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as ChatNodeData), title } }
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
          minWidth={300}
          minHeight={200}
          lineClassName="!border-transparent !border-[6px]"
          handleClassName="!w-2 !h-2 !bg-gray-300 !border-gray-300 !opacity-0 hover:!opacity-100"
        />
        <ConnectorHandle type="source" />
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
      <ConnectorHandle type="source" />
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 min-w-0">
          <EditableTitle
            title={data.title}
            onChange={handleTitleChange}
          />
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
            {data.messages?.length ?? 0} msgs
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

        {/* Messages */}
        <div className="nowheel min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {(data.messages ?? []).map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-100 px-3 py-2">
                  <div className="prose prose-xs prose-gray text-xs leading-relaxed text-gray-700">
                    <ReactMarkdown
                      components={{
                        code: CodeBlock,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div key={i}>
                <div className="prose prose-xs prose-gray text-xs leading-relaxed text-gray-600">
                  <ReactMarkdown
                    components={{
                      code: CodeBlock,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}

export default memo(ChatNode);
