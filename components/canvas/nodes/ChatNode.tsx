"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ConnectorHandle from "./ConnectorHandle";
import EditableTitle from "./EditableTitle";
import BtwOverlay from "./BtwOverlay";
import { useBtwSelection } from "@/lib/canvas/useBtwSelection";
import { compileSingleContext } from "@/lib/context-export";
import { ALL_MODELS, DEFAULT_MODEL_ID, getModelName, modelSupportsWebSearch } from "@/lib/ai/models-client";
import { useTheme } from "@/lib/themes";
import type { ChatNodeData, ChatMessage, ChatSource, AttachedSot, SotNodeData } from "@/types";
import { streamChat } from "@/lib/api/chat-client";
import type { Node } from "@xyflow/react";

// ---------------------------------------------------------------------------
// React Flow selectors (same pattern as ContextBlockNode)
// ---------------------------------------------------------------------------

const selectIsConnecting = (state: ReactFlowState) =>
  state.connection.inProgress;

function selectConnectedSources(id: string) {
  return (state: ReactFlowState) => {
    const directSourceIds = state.edges
      .filter((e) => e.target === id)
      .map((e) => e.source);
    const directNodes = state.nodes.filter((n) =>
      directSourceIds.includes(n.id),
    );

    // For context blocks, also pull in their connected SOTs (transitive)
    const transitiveNodes: Node[] = [];
    for (const node of directNodes) {
      if (node.type === "contextBlock") {
        const childIds = state.edges
          .filter((e) => e.target === node.id)
          .map((e) => e.source);
        const children = state.nodes.filter((n) => childIds.includes(n.id));
        transitiveNodes.push(...children);
      }
    }

    return [...directNodes, ...transitiveNodes];
  };
}

import { shallowArrayEqual } from "@/lib/canvas/shallow-equal";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const match = /language-(\w+)/.exec(className || "");
  const inline =
    !className &&
    typeof children === "string" &&
    !children.includes("\n");
  if (inline) {
    return <code className={className}>{children}</code>;
  }
  return (
    <SyntaxHighlighter
      style={theme.type === "dark" ? oneDark : oneLight}
      language={match?.[1] ?? "text"}
      PreTag="div"
      customStyle={{ fontSize: "11px" }}
    >
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  );
}

const REMARK_PLUGINS = [remarkGfm];
const MD_COMPONENTS = { code: CodeBlock };


function SourcesDropdown({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="nodrag inline-flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg-dim transition-colors cursor-pointer"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {sources.length} source{sources.length !== 1 ? "s" : ""}
        <ChevronDownIcon width={8} height={8} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5">
          {sources.map((src, j) => (
            <a
              key={j}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="nodrag inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg transition-colors truncate"
            >
              <LinkIcon width={9} height={9} className="shrink-0" />
              {src.title || new URL(src.url).hostname}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

import { SOURCE_ENDPOINT } from "@/lib/canvas/source-endpoints";
import { copyWithFeedback } from "@/lib/canvas/clipboard";
import { updateNodeData, updateNode, removeEdgeBetween } from "@/lib/canvas/actions";
import { CheckIcon, CopyIcon, LinkIcon, RefreshIcon, ChevronDownIcon } from "@/components/icons";
import NodeWindowControls from "./NodeWindowControls";
import NodeSelectionBar from "./NodeSelectionBar";
import MinimizedNodeView from "./MinimizedNodeView";
import MaximizePortal from "./MaximizePortal";
import type { NodeViewMode } from "@/types";

const SOT_COLORS = [
  "bg-purple-400",
  "bg-blue-400",
  "bg-green-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-cyan-400",
];

// ---------------------------------------------------------------------------
// Model selector dropdown
// ---------------------------------------------------------------------------

function ModelSelector({
  modelId,
  onChange,
  disabled,
}: {
  modelId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`nodrag flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
          disabled
            ? "text-fg-muted cursor-not-allowed"
            : "text-fg-muted hover:bg-hover cursor-pointer"
        } ${open ? "bg-hover" : ""}`}
      >
        {getModelName(modelId)}
        {!disabled && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points={open ? "6 15 12 9 18 15" : "6 9 12 15 18 9"} />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg border border-line bg-surface shadow-lg py-1 z-50">
          {ALL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`w-full flex items-center px-3 py-1.5 text-xs text-fg-dim hover:bg-hover ${
                m.id === modelId ? "bg-hover font-medium" : ""
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context bar
// ---------------------------------------------------------------------------

function ContextBar({
  sots,
  collapsed,
  onToggle,
  onRemove,
}: {
  sots: AttachedSot[];
  collapsed: boolean;
  onToggle: () => void;
  onRemove: (nodeId: string) => void;
}) {
  if (sots.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="nodrag shrink-0 flex items-center gap-1.5 border-b border-line-subtle bg-surface-alt/30 px-3 py-1.5 hover:bg-surface-alt transition-colors w-full text-left cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="text-[10px] font-medium text-fg-muted">
          {sots.length} source{sots.length !== 1 ? "s" : ""} attached
        </span>
        <ChevronDownIcon width={8} height={8} className="ml-auto text-fg-faint" />
      </button>
    );
  }

  return (
    <div className="shrink-0 border-b border-line-subtle bg-surface-alt/50 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="nodrag flex items-center gap-1.5 mb-1.5 cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="text-[10px] font-medium text-fg-muted">Attached context</span>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {sots.map((sot) => (
          <div
            key={sot.nodeId}
            className="nodrag flex items-center gap-1 rounded-md bg-surface border border-line pl-1.5 pr-1 py-0.5 shadow-sm"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${sot.color}`} />
            <span className="text-[10px] font-medium text-fg-dim">
              {sot.title}
            </span>
            <button
              type="button"
              onClick={() => onRemove(sot.nodeId)}
              className="text-fg-faint hover:text-fg-muted ml-0.5 cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer (input area)
// ---------------------------------------------------------------------------

function Composer({
  modelId,
  webSearch,
  isStreaming,
  selected,
  onSend,
  onStop,
  onModelChange,
  onWebSearchToggle,
}: {
  modelId: string;
  webSearch: boolean;
  isStreaming: boolean;
  selected?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onModelChange: (id: string) => void;
  onWebSearchToggle: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      adjustHeight();
    },
    [adjustHeight],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;
        setInput("");
        // Reset height on next tick
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        });
        onSend(text);
      }
    },
    [input, isStreaming, onSend],
  );

  return (
    <div
      className={`shrink-0 mx-3 mb-2 rounded-lg border transition-colors ${
        isStreaming
          ? "border-line bg-surface-alt/50"
          : "border-line focus-within:border-line-hover"
      }`}
    >
      <textarea
        ref={textareaRef}
        placeholder="Ask anything..."
        rows={1}
        disabled={isStreaming}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={`nodrag ${selected ? "nowheel" : ""} w-full resize-none rounded-t-lg border-0 bg-transparent px-3 pt-2 pb-1 text-xs placeholder-fg-muted focus:outline-none focus:ring-0 ${
          isStreaming ? "text-fg-muted cursor-not-allowed" : "text-fg-dim"
        }`}
        style={{ minHeight: "28px", maxHeight: "120px" }}
      />
      <div className="flex items-center justify-between px-2 pb-1.5">
        <div className="flex items-center gap-1.5">
          <ModelSelector
            modelId={modelId}
            onChange={onModelChange}
            disabled={isStreaming}
          />
          {modelSupportsWebSearch(modelId) && (
            <button
              type="button"
              disabled={isStreaming}
              onClick={onWebSearchToggle}
              className={`nodrag flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors cursor-pointer ${
                isStreaming
                  ? "text-fg-muted cursor-not-allowed"
                  : webSearch
                    ? "bg-action-surface text-action hover:bg-action-surface"
                    : "text-fg-muted hover:bg-hover hover:text-fg-dim"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Search
            </button>
          )}
        </div>
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="nodrag rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600 transition-colors cursor-pointer"
            title="Stop generating"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const text = input.trim();
              if (!text) return;
              setInput("");
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto";
                }
              });
              onSend(text);
            }}
            className="nodrag rounded-full bg-contrast p-1.5 text-contrast-fg hover:bg-contrast-hover transition-colors cursor-pointer"
            title="Send"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BTW tooltip — speech bubble that appears above a text selection
// ---------------------------------------------------------------------------
// Main ChatNode
// ---------------------------------------------------------------------------

const sourceBadgeColors: Record<string, string> = {
  chatgpt: "bg-emerald-600 text-white",
  claude: "bg-orange-500 text-white",
  manual: "bg-gray-600 text-white",
};

function ChatNode({
  id,
  data,
  selected,
}: NodeProps & { data: ChatNodeData }) {
  const { setNodes, setEdges, screenToFlowPosition } = useReactFlow();
  const isConnecting = useStore(selectIsConnecting);
  const sourceSelector = useMemo(() => selectConnectedSources(id), [id]);
  const sourceNodes = useStore(sourceSelector, shallowArrayEqual);
  const [contextCopied, setContextCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [hasUserToggledContext, setHasUserToggledContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(data.messages?.length ?? 0);
  const abortRef = useRef<AbortController | null>(null);

  // BTW quick-ask
  const btw = useBtwSelection(id);
  const { containerRef: messagesContainerRef, handleMouseUp: handleBtwMouseUp } = btw;

  const isInteractive = data.source === "interactive";

  // Derive attached context from edges — handle SOT cards, chat nodes, and context blocks
  const attachedSots: AttachedSot[] = useMemo(() => {
    const results: AttachedSot[] = [];
    let colorIdx = 0;
    for (const n of sourceNodes) {
      if (n.type === "sotCard") {
        const d = n.data as SotNodeData;
        results.push({
          nodeId: n.id,
          title: d.title,
          content: d.content,
          sourceType: d.sourceType,
          color: SOT_COLORS[colorIdx++ % SOT_COLORS.length],
        });
      } else if (n.type === "chatWindow") {
        const d = n.data as ChatNodeData;
        const content = (d.messages ?? [])
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n\n");
        if (content) {
          results.push({
            nodeId: n.id,
            title: d.title || "Chat",
            content,
            sourceType: "chat",
            color: SOT_COLORS[colorIdx++ % SOT_COLORS.length],
          });
        }
      }
      // contextBlock nodes are skipped — their children are already
      // included as transitive nodes by the selector
    }
    return results;
  }, [sourceNodes]);

  const autoCollapsed =
    (data.messages?.length ?? 0) > 0 && attachedSots.length > 0;
  const contextBarCollapsed = hasUserToggledContext ? contextCollapsed : autoCollapsed;

  // Auto-scroll to bottom when messages change:
  // - Smooth scroll when new messages are added (conversation flow)
  // - Instant scroll otherwise (workspace switch / initial load)
  useEffect(() => {
    const count = data.messages?.length ?? 0;
    const isNewMessage = count > prevMessageCountRef.current;
    prevMessageCountRef.current = count;
    if (count > 0) {
      messagesEndRef.current?.scrollIntoView(
        isNewMessage ? { behavior: "smooth" } : undefined,
      );
    }
  }, [data.messages]);

  const updateData = useCallback(
    (patch: Partial<ChatNodeData>) => {
      setNodes((nds) => updateNodeData<ChatNodeData>(nds, id, patch));
    },
    [id, setNodes],
  );

  const handleTitleChange = useCallback(
    (title: string) => updateData({ title }),
    [updateData],
  );

  const handleCopyContext = useCallback(() => {
    const fakeNode = { id, data } as Node<ChatNodeData>;
    const text = compileSingleContext(fakeNode);
    copyWithFeedback(text, setContextCopied);
  }, [id, data]);

  const handleCopyLink = useCallback(() => {
    if (!data.sourceUrl) return;
    copyWithFeedback(data.sourceUrl, setLinkCopied);
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
        updateData({
          title: result.title ?? data.title,
          model: result.model,
          messages,
        });
      })
      .finally(() => setRefreshing(false));
  }, [data.sourceUrl, data.source, data.title, refreshing, updateData]);

  // --- Interactive chat ---

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      const currentMessages = [...(data.messages ?? []), userMsg];

      updateData({
        messages: currentMessages,
        isStreaming: true,
      });

      // Auto-title: fire immediately on first message
      const isFirstMessage = (data.messages ?? []).length === 0;
      if (
        isFirstMessage &&
        data.source === "interactive" &&
        data.title === "New conversation"
      ) {
        fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((r) => {
            if (r?.title) updateData({ title: r.title });
          })
          .catch(() => {});
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      const collectedSources: ChatSource[] = [];

      try {
        await streamChat(
          {
            messages: currentMessages,
            modelId: data.modelId || DEFAULT_MODEL_ID,
            attachedSots: attachedSots.map((s) => ({
              title: s.title,
              content: s.content,
              sourceType: s.sourceType,
            })),
            webSearch: data.webSearch ?? false,
            signal: abortController.signal,
          },
          {
            onTextDelta: (fullContent, sources) => {
              updateData({
                messages: [
                  ...currentMessages,
                  {
                    role: "assistant" as const,
                    content: fullContent,
                    timestamp: Date.now(),
                    sources: sources.length > 0 ? sources : undefined,
                  },
                ],
              });
            },
            onToolCall: (toolName) => {
              if (toolName === "web_search") {
                setIsSearching(true);
              }
            },
            onSource: (source) => {
              collectedSources.push(source);
            },
            onComplete: (content, sources) => {
              setIsSearching(false);
              updateData({
                messages: [
                  ...currentMessages,
                  {
                    role: "assistant" as const,
                    content,
                    timestamp: Date.now(),
                    sources: sources.length > 0 ? sources : undefined,
                  },
                ],
                isStreaming: false,
              });
            },
            onError: (error) => {
              setIsSearching(false);
              updateData({
                messages: [
                  ...currentMessages,
                  {
                    role: "assistant",
                    content: error.startsWith("Something went wrong")
                      ? error
                      : `Error: ${error}`,
                    timestamp: Date.now(),
                  },
                ],
                isStreaming: false,
              });
            },
          },
        );
      } catch (err) {
        setIsSearching(false);
        if ((err as Error).name === "AbortError") {
          updateData({ isStreaming: false });
          return;
        }
        updateData({
          messages: [
            ...currentMessages,
            {
              role: "assistant",
              content: `Error: ${(err as Error).message}`,
              timestamp: Date.now(),
            },
          ],
          isStreaming: false,
        });
      }
    },
    [
      data.messages,
      data.modelId,
      data.source,
      data.title,
      attachedSots,
      data.webSearch,
      updateData,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleRemoveSot = useCallback(
    (sotNodeId: string) => {
      setEdges((eds) => removeEdgeBetween(eds, sotNodeId, id));
    },
    [id, setEdges],
  );

  const handleViewModeChange = useCallback(
    (viewMode: NodeViewMode) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === id);
        if (!node) return nds;
        const currentHeight = node.measured?.height ?? (node.style as Record<string, unknown>)?.height as number | undefined;
        const savedHeight = (node.data as ChatNodeData & { _savedHeight?: number })._savedHeight;

        if (viewMode === "minimized") {
          return updateNode<ChatNodeData>(nds, id, { viewMode, _savedHeight: currentHeight } as Partial<ChatNodeData>, { height: undefined });
        }
        const restoreHeight = savedHeight ?? currentHeight;
        return updateNode<ChatNodeData>(nds, id, { viewMode, _savedHeight: undefined } as Partial<ChatNodeData>, restoreHeight ? { height: restoreHeight } : {});
      });
    },
    [id, setNodes],
  );

  const viewMode = data.viewMode ?? "normal";

  const wordCount = useMemo(() => {
    const msgs = data.messages ?? [];
    const text = msgs.map((m) => m.content).join(" ");
    return text.split(/\s+/).filter(Boolean).length;
  }, [data.messages]);

  // --- Loading state ---
  if (data.isLoading) {
    return (
      <>
        <NodeResizer
          isVisible
          minWidth={300}
          minHeight={200}
          lineClassName="!border-transparent !border-[3px]"
          handleClassName="!w-3 !h-3 !bg-transparent !border-0"
        />
        <ConnectorHandle type="source" />
        <div className={`h-full rounded-lg border bg-surface p-4 shadow-sm transition-all duration-150 ${selected ? "border-selection ring-2 ring-selection/30" : "border-line hover:border-line-hover"}`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg truncate">
              Loading conversation…
            </h3>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-handle" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-handle" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-handle" />
          </div>
        </div>
      </>
    );
  }

  const hasMessages = (data.messages ?? []).length > 0;

  return (
    <>
      <NodeResizer
        isVisible={viewMode !== "minimized"}
        minWidth={300}
        minHeight={viewMode === "minimized" ? 0 : 200}
        lineClassName="!border-transparent !border-[3px]"
        handleClassName="!w-3 !h-3 !bg-transparent !border-0"
      />
      {viewMode !== "minimized" && <ConnectorHandle type="source" />}
      {/* Full-size invisible target handle — only active during edge drag */}
      {isInteractive && (
        <Handle
          type="target"
          position={Position.Left}
          className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-lg !transform-none chat-drop-handle"
          style={{
            top: 0,
            left: 0,
            transform: "none",
            pointerEvents: isConnecting ? "all" : "none",
          }}
        />
      )}
      <div className={`chat-drop-content group flex h-full flex-col rounded-lg border bg-surface shadow-sm transition-all duration-150 ${selected ? "border-selection ring-2 ring-selection/30" : "border-line hover:border-line-hover"}`}>
        {viewMode === "minimized" ? (
          <MinimizedNodeView title={data.title} wordCount={wordCount} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        ) : (<>
        <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing">
          <div className={`h-[3px] w-6 rounded-full bg-handle transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
        </div>

        <div className="border-b border-line-subtle px-4 pb-2 min-w-0">
          <div className="flex items-start justify-between">
            <EditableTitle title={data.title} onChange={handleTitleChange} />
            <div className={`transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <NodeWindowControls viewMode={viewMode} onViewModeChange={handleViewModeChange} />
            </div>
          </div>
          {!isInteractive && data.source && sourceBadgeColors[data.source] && (
            <span
              className={`mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.source]}`}
            >
              {data.source}
            </span>
          )}
        </div>

        {viewMode !== "maximized" && <>
        {/* Context bar (interactive only) */}
        {isInteractive && (
          <ContextBar
            sots={attachedSots}
            collapsed={contextBarCollapsed}
            onToggle={() => {
              setHasUserToggledContext(true);
              setContextCollapsed(!contextBarCollapsed);
            }}
            onRemove={handleRemoveSot}
          />
        )}

        {/* Messages or empty state */}
        {hasMessages ? (
          <div ref={messagesContainerRef} onMouseUp={handleBtwMouseUp} className={`${selected ? "nowheel" : ""} min-h-0 flex-1 overflow-y-auto p-3 cursor-text`}>
           <div className="mx-auto max-w-xl space-y-3">
            {(data.messages ?? []).map((msg, i, arr) => {
              const isLastAssistant =
                data.isStreaming && msg.role === "assistant" && i === arr.length - 1;
              return msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-hover px-3 py-2">
                    <div className="prose prose-xs text-xs leading-relaxed text-fg-dim">
                      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i}>
                  <div className={`prose prose-xs max-w-none text-xs leading-relaxed text-fg-dim ${isLastAssistant ? "streaming-prose" : ""}`}>
                    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <SourcesDropdown sources={msg.sources} />
                  )}
                </div>
              );
            })}
            {isSearching && (
              <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Searching the web…
              </div>
            )}
            {data.isStreaming && !isSearching && (
              <span className="inline-block w-1.5 h-3.5 bg-fg-muted animate-pulse" />
            )}
            <div ref={messagesEndRef} />
           </div>
          </div>
        ) : isInteractive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-hover flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-fg-muted">Start a conversation</p>
            <p className="text-[10px] text-fg-faint mt-1">Drag SOTs here to attach context</p>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Composer (interactive only) */}
        {isInteractive && (
          <Composer
            modelId={data.modelId || DEFAULT_MODEL_ID}
            webSearch={data.webSearch ?? false}
            isStreaming={data.isStreaming ?? false}
            selected={selected}
            onSend={handleSend}
            onStop={handleStop}
            onModelChange={(modelId) => updateData({
              modelId,
              ...(!modelSupportsWebSearch(modelId) ? { webSearch: false } : {}),
            })}
            onWebSearchToggle={() => updateData({ webSearch: !(data.webSearch ?? false) })}
          />
        )}

        </>}
        </>)}

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
        {!isInteractive && data.sourceUrl && (
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
          {/* Header */}
          <div className="flex h-3.5 shrink-0 items-center justify-center rounded-t-xl">
            <div className="h-[3px] w-6 rounded-full bg-handle" />
          </div>
          <div className="border-b border-line-subtle px-4 pb-2 min-w-0">
            <div className="flex items-start justify-between">
              <EditableTitle title={data.title} onChange={handleTitleChange} />
              <NodeWindowControls viewMode="maximized" onViewModeChange={handleViewModeChange} />
            </div>
            {!isInteractive && data.source && sourceBadgeColors[data.source] && (
              <span className={`mt-1 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.source]}`}>
                {data.source}
              </span>
            )}
          </div>

          {/* Context bar */}
          {isInteractive && (
            <ContextBar
              sots={attachedSots}
              collapsed={contextBarCollapsed}
              onToggle={() => {
                setHasUserToggledContext(true);
                setContextCollapsed(!contextBarCollapsed);
              }}
              onRemove={handleRemoveSot}
            />
          )}

          {/* Messages */}
          {hasMessages ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3 cursor-text">
              <div className="mx-auto max-w-xl space-y-3">
                {(data.messages ?? []).map((msg, i, arr) => {
                  const isLastAssistant =
                    data.isStreaming && msg.role === "assistant" && i === arr.length - 1;
                  return msg.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-hover px-3 py-2">
                        <div className="prose prose-xs text-xs leading-relaxed text-fg-dim">
                          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={i}>
                      <div className={`prose prose-xs max-w-none text-xs leading-relaxed text-fg-dim ${isLastAssistant ? "streaming-prose" : ""}`}>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && <SourcesDropdown sources={msg.sources} />}
                    </div>
                  );
                })}
                {isSearching && (
                  <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Searching the web…
                  </div>
                )}
                {data.isStreaming && !isSearching && (
                  <span className="inline-block w-1.5 h-3.5 bg-fg-muted animate-pulse" />
                )}
              </div>
            </div>
          ) : isInteractive ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-hover flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-xs text-fg-muted">Start a conversation</p>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Composer */}
          {isInteractive && (
            <Composer
              modelId={data.modelId || DEFAULT_MODEL_ID}
              webSearch={data.webSearch ?? false}
              isStreaming={data.isStreaming ?? false}
              onSend={handleSend}
              onStop={handleStop}
              onModelChange={(modelId) => updateData({
                modelId,
                ...(!modelSupportsWebSearch(modelId) ? { webSearch: false } : {}),
              })}
              onWebSearchToggle={() => updateData({ webSearch: !(data.webSearch ?? false) })}
            />
          )}

        </MaximizePortal>
      )}

      <BtwOverlay {...btw} modelId={data.modelId} />
    </>
  );
}

export default memo(ChatNode);
export { SOT_COLORS };
