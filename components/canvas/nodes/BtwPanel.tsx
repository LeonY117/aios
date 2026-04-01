"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamChat } from "@/lib/api/chat-client";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models-client";
import { ChatIcon } from "@/components/icons";
import type { ChatMessage } from "@/types";

type BtwPanelProps = {
  selectedText: string;
  /** Viewport X center of the selection */
  anchorX: number;
  /** Viewport Y bottom of the selection */
  anchorY: number;
  modelId?: string;
  onClose: () => void;
  onKeep?: (messages: ChatMessage[]) => void;
};

const PANEL_WIDTH = 320;

export default function BtwPanel({
  selectedText,
  anchorX,
  anchorY,
  modelId,
  onClose,
  onKeep,
}: BtwPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute a stable position on mount, clamped to viewport
  const left = Math.min(
    Math.max(8, anchorX - PANEL_WIDTH / 2),
    (typeof window !== "undefined" ? window.innerWidth : 800) - PANEL_WIDTH - 8,
  );
  const top = Math.min(
    anchorY + 6,
    (typeof window !== "undefined" ? window.innerHeight : 600) - 420,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close when clicking outside the panel
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // slight delay so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", onMouseDown), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  // Abort streaming if the panel unmounts
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Block wheel so canvas doesn't zoom
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await streamChat(
        {
          messages: currentMessages,
          modelId: modelId || DEFAULT_MODEL_ID,
          attachedSots: [],
          webSearch: false,
          signal: abortController.signal,
          btw: { selectedText },
        },
        {
          onTextDelta: (fullContent) => {
            setMessages([
              ...currentMessages,
              { role: "assistant" as const, content: fullContent, timestamp: Date.now() },
            ]);
          },
          onToolCall: () => {},
          onToolResult: () => {},
          onBlocksUpdate: () => {},
          onSource: () => {},
          onComplete: (content) => {
            setIsStreaming(false);
            setMessages([
              ...currentMessages,
              { role: "assistant" as const, content, timestamp: Date.now() },
            ]);
          },
          onError: (error) => {
            setIsStreaming(false);
            setMessages([
              ...currentMessages,
              { role: "assistant" as const, content: `Error: ${error}`, timestamp: Date.now() },
            ]);
          },
        },
      );
    } catch {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, selectedText, modelId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] flex flex-col rounded-xl border border-line bg-surface shadow-2xl animate-[scaleIn_0.15s_ease]"
      style={{ left, top, width: PANEL_WIDTH, maxHeight: 420 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-line-subtle shrink-0">
        <div className="flex items-center gap-1.5 text-fg-muted">
          <ChatIcon />
          <span className="text-xs font-semibold tracking-wide">btw</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && onKeep && (
            <button
              onClick={() => onKeep(messages)}
              className="rounded px-1.5 py-0.5 text-xs text-fg-muted hover:text-fg hover:bg-hover transition-colors"
              title="Keep as chat window"
            >
              keep
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-0.5 text-fg-muted hover:text-fg hover:bg-hover transition-colors"
            title="Close"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Selected text quote */}
      <div className="px-3 py-2 border-b border-line-subtle shrink-0">
        <p className="text-xs text-fg-faint italic line-clamp-3 border-l-2 border-line-hover pl-2 leading-relaxed">
          {selectedText}
        </p>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
          {messages.map((msg, i, arr) => {
            const isLastAssistant =
              isStreaming && msg.role === "assistant" && i === arr.length - 1;
            return msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-hover px-2.5 py-1.5">
                  <p className="text-xs text-fg-dim whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div
                key={i}
                className={`prose prose-xs max-w-none text-xs leading-relaxed text-fg-dim ${isLastAssistant ? "streaming-prose" : ""}`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            );
          })}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-fg-muted animate-pulse" />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <div className="px-2 pb-2 pt-1.5 shrink-0">
        <div className="flex items-end gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 focus-within:border-line-hover transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // auto-height
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-fg placeholder:text-fg-faint outline-none leading-relaxed"
            style={{ maxHeight: 80 }}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 rounded-md bg-fg-muted p-1 text-surface hover:opacity-80 transition-opacity"
              title="Stop"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 rounded-md bg-fg p-1 text-surface hover:opacity-80 disabled:opacity-30 transition-opacity"
              title="Send"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
