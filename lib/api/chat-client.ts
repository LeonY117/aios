import type { ChatMessage, ChatSource, ContentBlock } from "@/types";
import type { StreamEvent } from "@/app/api/chat/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCallEvent = {
  toolName: string;
  input?: Record<string, unknown>;
};

export type ToolResultEvent = {
  toolName: string;
  result: string;
};

export type ChatStreamCallbacks = {
  onTextDelta: (fullContent: string, sources: ChatSource[]) => void;
  onToolCall: (event: ToolCallEvent) => void;
  onToolResult: (event: ToolResultEvent) => void;
  onBlocksUpdate: (blocks: ContentBlock[]) => void;
  onSource: (source: ChatSource) => void;
  onAutoEdge?: (nodeIds: string[]) => void;
  onComplete: (content: string, sources: ChatSource[], blocks: ContentBlock[]) => void;
  onError: (error: string) => void;
};

export type ChatStreamOptions = {
  messages: ChatMessage[];
  modelId: string;
  attachedSots: { title: string; content: string; sourceType: string }[];
  webSearch: boolean;
  signal?: AbortSignal;
  btw?: { selectedText: string };
  sessionName?: string;
  chatNodeId?: string;
};

// ---------------------------------------------------------------------------
// Stream chat — pure async function, zero React dependencies
// ---------------------------------------------------------------------------

export async function streamChat(
  options: ChatStreamOptions,
  callbacks: ChatStreamCallbacks,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      modelId: options.modelId,
      attachedSots: options.attachedSots,
      webSearch: options.webSearch,
      ...(options.btw ? { btw: options.btw } : {}),
      ...(options.sessionName ? { sessionName: options.sessionName } : {}),
      ...(options.chatNodeId ? { chatNodeId: options.chatNodeId } : {}),
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.text();
    callbacks.onError(err);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let assistantContent = "";
  let buffer = "";
  const sources: ChatSource[] = [];
  const blocks: ContentBlock[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const event = JSON.parse(trimmed.slice(6)) as StreamEvent;

      switch (event.type) {
        case "text": {
          assistantContent += event.text;
          const last = blocks[blocks.length - 1];
          if (last && last.type === "text") {
            last.text += event.text;
          } else {
            blocks.push({ type: "text", text: event.text });
          }
          callbacks.onBlocksUpdate([...blocks]);
          callbacks.onTextDelta(assistantContent, [...sources]);
          break;
        }
        case "tool-call":
          if (event.toolName === "workspace_bash" && event.input?.command) {
            blocks.push({ type: "tool_call", command: event.input.command as string });
            callbacks.onBlocksUpdate([...blocks]);
          }
          callbacks.onToolCall({
            toolName: event.toolName,
            input: event.input,
          });
          break;
        case "tool-result":
          if (event.toolName === "workspace_bash") {
            const pending = blocks.findLast(
              (b): b is Extract<ContentBlock, { type: "tool_call" }> =>
                b.type === "tool_call" && !b.result,
            );
            if (pending) {
              pending.result = event.result;
              callbacks.onBlocksUpdate([...blocks]);
            }
          }
          callbacks.onToolResult({
            toolName: event.toolName,
            result: event.result,
          });
          break;
        case "source":
          sources.push({ url: event.url, title: event.title });
          callbacks.onSource({ url: event.url, title: event.title });
          break;
        case "auto-edge":
          callbacks.onAutoEdge?.(event.nodeIds);
          break;
        case "error":
          assistantContent += `\n\nError: ${event.message}`;
          break;
      }
    }
  }

  if (assistantContent) {
    callbacks.onComplete(assistantContent, sources, blocks);
  } else {
    callbacks.onError(
      "Something went wrong — the model returned an empty response. Check the server logs for details.",
    );
  }
}
