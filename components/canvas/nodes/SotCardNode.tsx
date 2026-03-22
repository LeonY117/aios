"use client";

import { memo, useCallback, useState } from "react";
import {
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import RichTextEditor from "../RichTextEditor";
import ConnectorHandle from "./ConnectorHandle";
import EditableTitle from "./EditableTitle";
import { compileSingleContext } from "@/lib/context-export";
import type { SotNodeData } from "@/types";
import type { Node } from "@xyflow/react";

const REHYPE_PLUGINS = [rehypeRaw];

/** Extract plain text of the first block element from HTML. */
function extractFirstLine(html: string): string {
  const match = html.match(/<(?:h[1-6]|p|li)[^>]*>(.*?)<\/(?:h[1-6]|p|li)>/);
  if (!match) return "";
  return match[1].replace(/<[^>]*>/g, "").trim();
}

const SOURCE_ENDPOINT: Record<string, string> = {
  github: "/api/sources/github",
  notion: "/api/sources/notion",
  slack: "/api/sources/slack",
  url: "/api/sources/url",
  chatgpt: "/api/sources/chatgpt",
  claude: "/api/sources/claude",
};

const sourceBadgeColors: Record<SotNodeData["sourceType"], string> = {
  notion: "bg-gray-800 text-white",
  github: "bg-purple-600 text-white",
  slack: "bg-[#4A154B] text-white",
  url: "bg-blue-500 text-white",
  chatgpt: "bg-emerald-600 text-white",
  manual: "bg-green-600 text-white",
  file: "bg-amber-600 text-white",
  pdf: "bg-red-600 text-white",
};

function LoadingSkeleton({ data }: { data: SotNodeData }) {
  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-gray-300">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {data.title}
        </h3>
        <span
          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
        >
          {data.sourceType === "manual" ? "note" : data.sourceType}
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
}: NodeProps & { data: SotNodeData }) {
  const { setNodes } = useReactFlow();
  const isRichText = (data.sourceType === "manual" || data.sourceType === "file") && data.isRichText;
  const isPdf = data.sourceType === "pdf";
  const [linkCopied, setLinkCopied] = useState(false);
  const [contextCopied, setContextCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopyContext = useCallback(() => {
    const fakeNode = { id, data } as Node<SotNodeData>;
    const text = compileSingleContext(fakeNode);
    navigator.clipboard.writeText(text);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 2000);
  }, [id, data]);

  const handleCopyLink = useCallback(() => {
    if (!data.sourceUrl) return;
    navigator.clipboard.writeText(data.sourceUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [data.sourceUrl]);

  const handleRefresh = useCallback(() => {
    if (!data.sourceUrl || refreshing) return;
    const endpoint = SOURCE_ENDPOINT[data.sourceType] ?? "/api/sources/url";
    setRefreshing(true);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: data.sourceUrl }),
    })
      .then((res) => res.json())
      .then((result) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...(n.data as SotNodeData),
                    title: result.title,
                    content: result.content,
                  },
                }
              : n,
          ),
        );
      })
      .finally(() => setRefreshing(false));
  }, [id, data.sourceUrl, data.sourceType, refreshing, setNodes]);

  const handleContentChange = useCallback(
    (html: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const d = n.data as SotNodeData;
          const updates: Partial<SotNodeData> = { content: html };
          if (d.sourceType === "manual") {
            updates.title = extractFirstLine(html) || "Untitled";
          }
          return { ...n, data: { ...d, ...updates } };
        }),
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
          isVisible
          minWidth={280}
          minHeight={120}
          lineClassName="!border-transparent !border-[3px]"
          handleClassName="!w-3 !h-3 !bg-transparent !border-0"
        />
        <ConnectorHandle type="source" />
        <LoadingSkeleton data={data} />
      </>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible
        minWidth={280}
        minHeight={120}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!w-3 !h-3 !bg-transparent !border-0"
      />
      <ConnectorHandle type="source" />
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition-colors duration-150 hover:border-gray-300">
        {/* Drag handle */}
        <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing">
          <div className="h-[3px] w-6 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        {!isRichText && (
          <div className="flex items-start justify-between px-4 pb-2">
            <EditableTitle
              title={data.title}
              onChange={handleTitleChange}
            />
            <span
              className={`ml-2 mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
            >
              {data.sourceType === "manual" ? "note" : data.sourceType}
            </span>
          </div>
        )}

        {/* Content */}
        {isPdf && data.pdfUrl ? (
          <div className="nowheel min-h-0 flex-1 overflow-y-auto">
            <iframe
              src={data.pdfUrl}
              className="h-full w-full border-0"
              title={data.title}
            />
          </div>
        ) : isRichText ? (
          <div className="nodrag min-h-0 flex-1 overflow-hidden cursor-text">
            <div className="px-4 pt-1 pb-0.5 text-[12px] font-semibold text-gray-300 truncate text-center">{data.title}</div>
            <RichTextEditor
              content={data.content}
              onChange={handleContentChange}
              autoFocus={!!data.isEditing}
              renderActions={() => (
                <button
                  type="button"
                  onClick={handleCopyContext}
                  title="Copy as context"
                  className="nodrag rounded p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {contextCopied ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              )}
            />
          </div>
        ) : (
          <>
            <div className="nowheel min-h-0 flex-1 overflow-y-auto px-4 pb-3 cursor-text">
              <div className="mx-auto max-w-xl text-xs leading-relaxed text-gray-600 prose prose-xs prose-gray">
                <ReactMarkdown rehypePlugins={REHYPE_PLUGINS}>{data.content}</ReactMarkdown>
              </div>
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
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleCopyContext}
                title="Copy as context"
                className="nodrag rounded p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                {contextCopied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default memo(SotCardNode);
