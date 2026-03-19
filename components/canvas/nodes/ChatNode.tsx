"use client";

import { memo, useCallback, useState } from "react";
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
import type { ChatNodeData, ChatMessage } from "@/types";

const SOURCE_ENDPOINT: Record<string, string> = {
  chatgpt: "/api/sources/chatgpt",
  claude: "/api/sources/claude",
};

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopyLink = useCallback(() => {
    if (!data.sourceUrl) return;
    navigator.clipboard.writeText(data.sourceUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [data.sourceUrl]);

  const handleRefresh = useCallback(() => {
    if (!data.sourceUrl || refreshing) return;
    const endpoint = SOURCE_ENDPOINT[data.source];
    if (!endpoint) return;
    setRefreshing(true);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.sourceUrl }),
    })
      .then((res) => res.json())
      .then((result) => {
        const messages: ChatMessage[] = result.messages ?? [];
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...(n.data as ChatNodeData),
                    title: result.title ?? (n.data as ChatNodeData).title,
                    model: result.model,
                    messages,
                  },
                }
              : n,
          ),
        );
      })
      .finally(() => setRefreshing(false));
  }, [id, data.sourceUrl, data.source, refreshing, setNodes]);

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
          isVisible
          minWidth={300}
          minHeight={200}
          lineClassName="!border-transparent !border-[3px]"
          handleClassName="!hidden"
        />
        <ConnectorHandle type="source" />
        <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-gray-300">
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
        isVisible
        minWidth={300}
        minHeight={200}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!hidden"
      />
      <ConnectorHandle type="source" />
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition-colors duration-150 hover:border-gray-300">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3 min-w-0">
          <EditableTitle
            title={data.title}
            onChange={handleTitleChange}
          />
          <span
            className={`ml-2 mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.source]}`}
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

        {/* Bottom bar */}
        <div className="flex h-[26px] shrink-0 items-center gap-1 border-t border-gray-100 px-2">
          {data.sourceUrl && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                title="Copy source link"
                className="nodrag rounded p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                {linkCopied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                title="Refresh content"
                className={`nodrag rounded p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ${refreshing ? "animate-spin" : ""}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(ChatNode);
