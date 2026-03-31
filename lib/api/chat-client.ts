import type { ChatMessage, ChatSource } from "@/types";
import type { StreamEvent } from "@/app/api/chat/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatStreamCallbacks = {
  onTextDelta: (fullContent: string, sources: ChatSource[]) => void;
  onToolCall: (toolName: string) => void;
  onSource: (source: ChatSource) => void;
  onComplete: (content: string, sources: ChatSource[]) => void;
  onError: (error: string) => void;
};

export type ChatStreamOptions = {
  messages: ChatMessage[];
  modelId: string;
  attachedSots: { title: string; content: string; sourceType: string }[];
  webSearch: boolean;
  signal?: AbortSignal;
  btw?: { selectedText: string };
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
        case "text":
          assistantContent += event.text;
          callbacks.onTextDelta(assistantContent, [...sources]);
          break;
        case "tool-call":
          callbacks.onToolCall(event.toolName);
          break;
        case "source":
          sources.push({ url: event.url, title: event.title });
          callbacks.onSource({ url: event.url, title: event.title });
          break;
        case "error":
          assistantContent += `\n\nError: ${event.message}`;
          break;
      }
    }
  }

  if (assistantContent) {
    callbacks.onComplete(assistantContent, sources);
  } else {
    callbacks.onError(
      "Something went wrong — the model returned an empty response. Check the server logs for details.",
    );
  }
}
