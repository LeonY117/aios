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
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import ConnectorHandle from "./ConnectorHandle";
import EditableTitle from "./EditableTitle";
import { compileSingleContext } from "@/lib/context-export";
import { ALL_MODELS, DEFAULT_MODEL_ID, getModelName } from "@/lib/ai/models-client";
import type { ChatNodeData, ChatMessage, AttachedSot, SotNodeData } from "@/types";
import type { Node } from "@xyflow/react";

// ---------------------------------------------------------------------------
// React Flow selectors (same pattern as ContextBlockNode)
// ---------------------------------------------------------------------------

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
      style={oneLight}
      language={match?.[1] ?? "text"}
      PreTag="div"
      customStyle={{ fontSize: "11px" }}
    >
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  );
}

const SOURCE_ENDPOINT: Record<string, string> = {
  chatgpt: "/api/sources/chatgpt",
  claude: "/api/sources/claude",
};

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
            ? "text-gray-400 cursor-not-allowed"
            : "text-gray-500 hover:bg-gray-100 cursor-pointer"
        } ${open ? "bg-gray-100" : ""}`}
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
        <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-50">
          {ALL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`w-full flex items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 ${
                m.id === modelId ? "bg-gray-50 font-medium" : ""
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
        className="nodrag shrink-0 flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/30 px-3 py-1.5 hover:bg-gray-50 transition-colors w-full text-left cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="text-[10px] font-medium text-gray-400">
          {sots.length} source{sots.length !== 1 ? "s" : ""} attached
        </span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    );
  }

  return (
    <div className="shrink-0 border-b border-gray-100 bg-gray-50/50 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="nodrag flex items-center gap-1.5 mb-1.5 cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="text-[10px] font-medium text-gray-400">Attached context</span>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {sots.map((sot) => (
          <div
            key={sot.nodeId}
            className="nodrag flex items-center gap-1 rounded-md bg-white border border-gray-200 pl-1.5 pr-1 py-0.5 shadow-sm"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${sot.color}`} />
            <span className="text-[10px] font-medium text-gray-600">
              {sot.title}
            </span>
            <button
              type="button"
              onClick={() => onRemove(sot.nodeId)}
              className="text-gray-300 hover:text-gray-500 ml-0.5 cursor-pointer"
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
  onSend,
  onStop,
  onModelChange,
  onWebSearchToggle,
}: {
  modelId: string;
  webSearch: boolean;
  isStreaming: boolean;
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
          ? "border-gray-200 bg-gray-50/50"
          : "border-gray-200 focus-within:border-gray-300"
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
        className={`nodrag nowheel w-full resize-none rounded-t-lg border-0 bg-transparent px-3 pt-2 pb-1 text-xs placeholder-gray-400 focus:outline-none focus:ring-0 ${
          isStreaming ? "text-gray-400 cursor-not-allowed" : "text-gray-700"
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
          <button
            type="button"
            disabled={isStreaming}
            onClick={onWebSearchToggle}
            className={`nodrag flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors cursor-pointer ${
              isStreaming
                ? "text-gray-400 cursor-not-allowed"
                : webSearch
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Search
          </button>
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
            className="nodrag rounded-full bg-gray-900 p-1.5 text-white hover:bg-gray-800 transition-colors cursor-pointer"
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
}: NodeProps & { data: ChatNodeData }) {
  const { setNodes, setEdges } = useReactFlow();
  const isConnecting = useStore(selectIsConnecting);
  const sotNodes = useStore(selectConnectedSots(id));
  const [contextCopied, setContextCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [hasUserToggledContext, setHasUserToggledContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isInteractive = data.source === "interactive";

  // Derive attached SOTs from edges (single source of truth)
  const attachedSots: AttachedSot[] = useMemo(
    () =>
      sotNodes.map((n, i) => ({
        nodeId: n.id,
        title: (n.data as SotNodeData).title,
        content: (n.data as SotNodeData).content,
        sourceType: (n.data as SotNodeData).sourceType,
        color: SOT_COLORS[i % SOT_COLORS.length],
      })),
    [sotNodes],
  );

  const autoCollapsed =
    (data.messages?.length ?? 0) > 0 && attachedSots.length > 0;
  const contextBarCollapsed = hasUserToggledContext ? contextCollapsed : autoCollapsed;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages]);

  const updateData = useCallback(
    (patch: Partial<ChatNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...(n.data as ChatNodeData), ...patch } }
            : n,
        ),
      );
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

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const modelId = data.modelId || DEFAULT_MODEL_ID;
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: currentMessages.map((m) => ({
              role: m.role,
              content: [{ type: "text", text: m.content }],
            })),
            modelId,
            attachedSots: attachedSots.map((s) => ({
              title: s.title,
              content: s.content,
              sourceType: s.sourceType,
            })),
            webSearch: data.webSearch ?? true,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const err = await res.text();
          updateData({
            messages: [
              ...currentMessages,
              { role: "assistant", content: `Error: ${err}`, timestamp: Date.now() },
            ],
            isStreaming: false,
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          assistantContent += decoder.decode(value, { stream: true });

          // Update in-place by replacing the last assistant message
          const updatedMessages = [
            ...currentMessages,
            {
              role: "assistant" as const,
              content: assistantContent,
              timestamp: Date.now(),
            },
          ];

          updateData({ messages: updatedMessages });
        }

        // If the stream completed but produced no content, show a fallback error
        if (!assistantContent) {
          updateData({
            messages: [
              ...currentMessages,
              {
                role: "assistant",
                content:
                  "Something went wrong — the model returned an empty response. Check the server logs for details.",
                timestamp: Date.now(),
              },
            ],
          });
        }

        updateData({ isStreaming: false });
      } catch (err) {
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
    [data.messages, data.modelId, attachedSots, data.webSearch, updateData],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleRemoveSot = useCallback(
    (sotNodeId: string) => {
      setEdges((eds) => eds.filter((e) => !(e.source === sotNodeId && e.target === id)));
    },
    [id, setEdges],
  );

  // --- Loading state ---
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

  const hasMessages = (data.messages ?? []).length > 0;

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
      <div className="chat-drop-content flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition-colors duration-150 hover:border-gray-300">
        {/* Drag handle */}
        <div className="custom-drag-handle flex h-3.5 shrink-0 cursor-grab items-center justify-center rounded-t-lg active:cursor-grabbing">
          <div className="h-[3px] w-6 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-4 pb-2 min-w-0">
          <EditableTitle title={data.title} onChange={handleTitleChange} />
          {!isInteractive && data.source && sourceBadgeColors[data.source] && (
            <span
              className={`ml-2 mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.source]}`}
            >
              {data.source}
            </span>
          )}
        </div>

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
          <div className="nowheel min-h-0 flex-1 overflow-y-auto p-3 space-y-3 cursor-text">
            {(data.messages ?? []).map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-100 px-3 py-2">
                    <div className="prose prose-xs prose-gray text-xs leading-relaxed text-gray-700">
                      <ReactMarkdown components={{ code: CodeBlock }}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i}>
                  <div className="prose prose-xs prose-gray text-xs leading-relaxed text-gray-600">
                    <ReactMarkdown components={{ code: CodeBlock }}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ),
            )}
            {data.isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-gray-400 animate-pulse" />
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : isInteractive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">Start a conversation</p>
            <p className="text-[10px] text-gray-300 mt-1">Drag SOTs here to attach context</p>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Composer (interactive only) */}
        {isInteractive && (
          <Composer
            modelId={data.modelId || DEFAULT_MODEL_ID}
            webSearch={data.webSearch ?? true}
            isStreaming={data.isStreaming ?? false}
            onSend={handleSend}
            onStop={handleStop}
            onModelChange={(modelId) => updateData({ modelId })}
            onWebSearchToggle={() => updateData({ webSearch: !(data.webSearch ?? true) })}
          />
        )}

        {/* Bottom bar */}
        <div className="flex h-[26px] shrink-0 items-center gap-1 border-t border-gray-100 px-2">
          {/* Imported chat: link + refresh buttons */}
          {!isInteractive && data.sourceUrl && (
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

          {/* Interactive: context summary */}
          {isInteractive && attachedSots.length > 0 && (
            <div className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="text-[10px] text-gray-400">
                {attachedSots.length} source{attachedSots.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {isInteractive && attachedSots.length === 0 && (
            <span className="text-[10px] text-gray-300">No context attached</span>
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
      </div>
    </>
  );
}

export default memo(ChatNode);
export { SOT_COLORS };
