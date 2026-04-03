"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
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
import { SOURCE_ENDPOINT } from "@/lib/canvas/source-endpoints";
import { copyWithFeedback } from "@/lib/canvas/clipboard";
import { updateNodeData, changeViewMode } from "@/lib/canvas/actions";
import { CheckIcon, CopyIcon, LinkIcon, RefreshIcon } from "@/components/icons";
import NodeWindowControls from "./NodeWindowControls";
import NodeSelectionBar from "./NodeSelectionBar";
import MinimizedNodeView from "./MinimizedNodeView";
import MaximizePortal from "./MaximizePortal";
import BtwOverlay from "./BtwOverlay";
import EmojiPicker from "@/components/EmojiPicker";
import { useBtwSelection } from "@/lib/canvas/useBtwSelection";
import type { NodeViewMode } from "@/types";

const REHYPE_PLUGINS = [rehypeRaw];

/** Extract plain text of the first block element from HTML. */
function extractFirstLine(content: string): string {
  // Handle markdown content: take first non-empty line, strip markdown syntax
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  if (!firstLine) return "";
  return firstLine
    .replace(/^#{1,6}\s+/, "") // headings
    .replace(/\*\*|__/g, "") // bold
    .replace(/\*|_/g, "") // italic
    .replace(/~~|~~/g, "") // strikethrough
    .replace(/\+\+/g, "") // underline
    .replace(/<[^>]*>/g, "") // any remaining HTML
    .trim();
}

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
    <div className="h-full rounded-lg border border-line bg-surface p-4 shadow-sm transition-colors duration-150 hover:border-line-hover">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg truncate">
          {data.title}
        </h3>
        <span
          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
        >
          {data.sourceType === "manual" ? "note" : data.sourceType}
        </span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-handle" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-handle" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-handle" />
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
  const isRichText = (data.sourceType === "manual" || data.sourceType === "file") && data.isRichText;
  const isPdf = data.sourceType === "pdf";
  const [linkCopied, setLinkCopied] = useState(false);
  const [contextCopied, setContextCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiAnchorRef = useRef<HTMLButtonElement>(null);

  const handleEmojiChange = useCallback(
    (emoji: string | null) => {
      setNodes((nds) => updateNodeData<SotNodeData>(nds, id, { emoji }));
    },
    [id, setNodes],
  );

  const handleCloseEmojiPicker = useCallback(() => setShowEmojiPicker(false), []);

  // BTW quick-ask
  const btw = useBtwSelection(id);
  const { containerRef: btwContainerRef, handleMouseUp: handleBtwMouseUp } = btw;

  const handleCopyContext = useCallback(() => {
    const fakeNode = { id, data } as Node<SotNodeData>;
    const text = compileSingleContext(fakeNode);
    copyWithFeedback(text, setContextCopied);
  }, [id, data]);

  const handleCopyLink = useCallback(() => {
    if (!data.sourceUrl) return;
    copyWithFeedback(data.sourceUrl, setLinkCopied);
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
          updateNodeData<SotNodeData>(nds, id, {
            title: result.title,
            content: result.content,
          }),
        );
      })
      .finally(() => setRefreshing(false));
  }, [id, data.sourceUrl, data.sourceType, refreshing, setNodes]);

  const handleContentChange = useCallback(
    (markdown: string) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === id);
        const d = node?.data as SotNodeData | undefined;
        const updates: Partial<SotNodeData> = { content: markdown };
        if (d?.sourceType === "manual") {
          updates.title = extractFirstLine(markdown) || "Untitled";
        }
        return updateNodeData<SotNodeData>(nds, id, updates);
      });
    },
    [id, setNodes],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      setNodes((nds) => updateNodeData<SotNodeData>(nds, id, { title }));
    },
    [id, setNodes],
  );

  // Refs for moving editor DOM between inline and portal without unmounting
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const portalSlotRef = useRef<HTMLDivElement>(null);
  const tiptapEditorRef = useRef<Editor | null>(null);
  const handleEditorReady = useCallback((editor: Editor | null) => {
    tiptapEditorRef.current = editor;
  }, []);
  const inlineSlotRef = useRef<HTMLDivElement>(null);

  const handleViewModeChange = useCallback(
    (viewMode: NodeViewMode) => {
      setNodes((nds) => changeViewMode(nds, id, viewMode));
    },
    [id, setNodes],
  );

  const viewMode = data.viewMode ?? "normal";

  // Move the editor DOM node between inline and portal slots without unmounting.
  // The editor's React tree stays mounted — only the physical DOM parent changes.
  // After moving, re-focus the editor so the cursor reappears in its original position.
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper || !isRichText) return;
    let moved = false;
    if (viewMode === "maximized" && portalSlotRef.current) {
      portalSlotRef.current.appendChild(wrapper);
      moved = true;
    } else if (inlineSlotRef.current && wrapper.parentElement !== inlineSlotRef.current) {
      inlineSlotRef.current.appendChild(wrapper);
      moved = true;
    }
    // After DOM move, ProseMirror loses focus — restore it without changing selection
    if (moved && tiptapEditorRef.current && !tiptapEditorRef.current.isDestroyed) {
      requestAnimationFrame(() => {
        tiptapEditorRef.current?.view.focus();
      });
    }
  }, [viewMode, isRichText]);

  const strippedContent = useMemo(
    () => data.content?.replace(/<[^>]*>/g, "") ?? "",
    [data.content],
  );

  const wordCount = useMemo(() => {
    if (!strippedContent) return 0;
    const text = strippedContent.replace(/[#*_~`\[\]()>+|\\-]/g, " ");
    return text.split(/\s+/).filter(Boolean).length;
  }, [strippedContent]);

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

  const isNote = data.sourceType === "manual" || data.sourceType === "file";

  const hoverReveal = `transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`;

  const noteTitle = isNote ? (
    <>{data.emoji && <span className="mr-1">{data.emoji}</span>}{data.title}</>
  ) : null;

  // --- Header ---
  const header = isNote ? (
    // Notes: centered grey title (no badge), controls absolutely positioned so they don't shift the title
    <div className="relative px-4">
      <div className="text-center">
        <span className="text-[12px] font-semibold text-fg-faint truncate">
          {noteTitle}
        </span>
      </div>
      <div className={`absolute right-4 top-0 ${hoverReveal}`}>
        <NodeWindowControls viewMode={viewMode} onViewModeChange={handleViewModeChange} />
      </div>
    </div>
  ) : (
    // Other sources: title + controls on line 1, badge on line 2
    <div className="px-4 pb-2">
      <div className="flex items-start justify-between">
        <EditableTitle title={data.title} onChange={handleTitleChange} />
        <div className={hoverReveal}>
          <NodeWindowControls viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        </div>
      </div>
      <span
        className={`mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
      >
        {data.sourceType}
      </span>
    </div>
  );

  const isMaximized = viewMode === "maximized";
  const emojiHeaderSlot = isNote ? (
    <div className={`group/emoji relative px-4 ${isMaximized ? "pt-24 mb-3" : data.emoji ? "flex items-center" : ""}`}>
      {data.emoji ? (
        <button
          ref={emojiAnchorRef}
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className={`nodrag leading-none rounded cursor-pointer hover:bg-hover transition-colors ${isMaximized ? "text-[48px]" : "text-[28px]"}`}
          title="Change icon"
        >
          {data.emoji}
        </button>
      ) : (
        <button
          ref={emojiAnchorRef}
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className={`nodrag text-fg-faint rounded cursor-pointer opacity-0 group-hover/emoji:opacity-100 hover:bg-hover transition-opacity ${isMaximized ? "text-[13px] px-2 py-1" : "text-[11px] px-1.5 py-0.5"}`}
        >
          + Add icon
        </button>
      )}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiChange}
          onRemove={() => handleEmojiChange(null)}
          onClose={handleCloseEmojiPicker}
          anchorRef={emojiAnchorRef}
        />
      )}
    </div>
  ) : null;

  // --- Content section ---
  const contentSection = isPdf && data.pdfUrl ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <iframe
        src={data.pdfUrl}
        className="h-full w-full border-0"
        title={data.title}
      />
    </div>
  ) : isRichText ? (
    <div ref={btwContainerRef} onMouseUp={handleBtwMouseUp} className={`nodrag min-h-0 flex-1 overflow-hidden cursor-text flex flex-col ${viewMode === "maximized" ? "!h-0 !min-h-0 !overflow-hidden" : ""}`}>
      <div ref={inlineSlotRef} className="flex min-h-0 flex-1 flex-col">
        <div ref={editorWrapperRef} className="flex min-h-0 flex-1 flex-col">
          <RichTextEditor
            content={data.content}
            onChange={handleContentChange}
            autoFocus={!!data.isEditing}
            selected={selected}
            onEditor={handleEditorReady}
            headerSlot={emojiHeaderSlot}
          />
        </div>
      </div>
    </div>
  ) : (
    <div ref={btwContainerRef} onMouseUp={handleBtwMouseUp} className={`${selected ? "nowheel" : ""} min-h-0 flex-1 overflow-y-auto px-4 pb-3 cursor-text`}>
      <div className="mx-auto max-w-xl text-xs leading-relaxed text-fg-dim prose prose-xs">
        <ReactMarkdown rehypePlugins={REHYPE_PLUGINS}>{data.content}</ReactMarkdown>
      </div>
    </div>
  );

  return (
    <>
      <NodeResizer
        isVisible={viewMode !== "minimized"}
        minWidth={280}
        minHeight={viewMode === "minimized" ? 0 : 120}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!w-3 !h-3 !bg-transparent !border-0"
      />
      {viewMode !== "minimized" && <ConnectorHandle type="source" />}
      <div className={`group flex h-full flex-col rounded-lg border bg-surface shadow-sm transition-all duration-150 ${selected ? "border-selection ring-2 ring-selection/30" : "border-line hover:border-line-hover"}`}>
        {viewMode === "minimized" ? (
          <MinimizedNodeView title={data.title} wordCount={wordCount} viewMode={viewMode} onViewModeChange={handleViewModeChange} emoji={data.emoji} />
        ) : (
          <>
            <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing" onDoubleClick={() => handleViewModeChange("minimized")}>
              <div className={`h-[3px] w-6 rounded-full bg-handle ${hoverReveal}`} />
            </div>
            {header}
            {contentSection}
          </>
        )}
      </div>

      {/* Selection action bar */}
      <NodeSelectionBar>
        <button
          type="button"
          onClick={handleCopyContext}
          title="Copy as context"
          className="rounded p-1 text-fg-muted hover:text-fg-dim transition-colors cursor-pointer"
        >
          {contextCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
        {data.sourceUrl && (
          <>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy source link"
              className="rounded p-1 text-fg-muted hover:text-fg-dim transition-colors cursor-pointer"
            >
              {linkCopied ? <CheckIcon /> : <LinkIcon />}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh content"
              className={`rounded p-1 text-fg-muted hover:text-fg-dim transition-colors cursor-pointer ${refreshing ? "animate-spin" : ""}`}
            >
              <RefreshIcon />
            </button>
          </>
        )}
      </NodeSelectionBar>

      {/* Maximized overlay */}
      {viewMode === "maximized" && (
        <MaximizePortal onClose={() => handleViewModeChange("normal")}>
          <div className="flex h-3.5 shrink-0 items-center justify-center rounded-t-xl">
            <div className="h-[3px] w-6 rounded-full bg-handle" />
          </div>
          {isNote ? (
            <div className="relative px-4">
              <div className="text-center">
                <span className="text-[12px] font-semibold text-fg-faint truncate">
                  {noteTitle}
                </span>
              </div>
              <div className="absolute right-4 top-0">
                <NodeWindowControls viewMode="maximized" onViewModeChange={handleViewModeChange} />
              </div>
            </div>
          ) : (
            <div className="px-4 pb-2">
              <div className="flex items-start justify-between">
                <EditableTitle title={data.title} onChange={handleTitleChange} />
                <NodeWindowControls viewMode="maximized" onViewModeChange={handleViewModeChange} />
              </div>
              <span className={`mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}>
                {data.sourceType}
              </span>
            </div>
          )}
          <div ref={portalSlotRef} className="nodrag min-h-0 flex-1 overflow-hidden cursor-text flex flex-col" />
        </MaximizePortal>
      )}

      <BtwOverlay
        {...btw}
        nodeTitle={data.title}
        nodeContent={strippedContent}
      />
    </>
  );
}

export default memo(SotCardNode);
