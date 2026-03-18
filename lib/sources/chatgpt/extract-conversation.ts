import type { ChatMessage } from "@/types";

type MessageNode = {
  message?: {
    author?: { role?: string };
    content?: { parts?: unknown[] };
    metadata?: { model_slug?: string };
  };
};

type ConversationData = {
  title?: string;
  mapping?: Record<string, MessageNode>;
  linear_conversation?: Array<{ id?: string }>;
};

export type ExtractedConversation = {
  title: string;
  model: string;
  messages: ChatMessage[];
};

export function extractConversation(
  resolved: unknown,
): ExtractedConversation | null {
  // Navigate to the conversation data
  const data = navigateToData(resolved);
  if (!data) return null;

  const title = (data.title as string) ?? "ChatGPT Conversation";
  const mapping = data.mapping as Record<string, MessageNode> | undefined;
  const linearConversation = data.linear_conversation as
    | Array<{ id?: string }>
    | undefined;

  if (!mapping) return null;

  let model = "";
  const messages: ChatMessage[] = [];

  // Use linear_conversation for ordering if available, otherwise iterate mapping
  const orderedIds = linearConversation
    ? linearConversation.map((ref) => ref.id).filter(Boolean)
    : Object.keys(mapping);

  for (const id of orderedIds) {
    if (!id) continue;
    const node = mapping[id];
    if (!node?.message) continue;

    const role = node.message.author?.role;
    if (!role || role === "system" || role === "tool") continue;

    const parts = node.message.content?.parts;
    if (!Array.isArray(parts)) continue;

    const content = parts.filter((p): p is string => typeof p === "string").join("\n");
    if (!content) continue;

    if (role === "assistant" && node.message.metadata?.model_slug) {
      model = node.message.metadata.model_slug;
    }

    messages.push({
      role: role === "user" ? "user" : "assistant",
      content,
    });
  }

  if (messages.length === 0) return null;

  return { title, model: model || "unknown", messages };
}

function navigateToData(obj: unknown): ConversationData | null {
  if (!obj || typeof obj !== "object") return null;

  // Try the known path: loaderData["routes/share.$shareId.($action)"].serverResponse.data
  const loaderData = (obj as Record<string, unknown>)["loaderData"];
  if (loaderData && typeof loaderData === "object") {
    for (const value of Object.values(loaderData as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const serverResponse = (value as Record<string, unknown>)[
        "serverResponse"
      ];
      if (serverResponse && typeof serverResponse === "object") {
        const data = (serverResponse as Record<string, unknown>)["data"];
        if (data && typeof data === "object" && "mapping" in data) {
          return data as ConversationData;
        }
      }
    }
  }

  // Fallback: search for an object with "mapping" and "title" keys
  return findConversationData(obj, 0);
}

function findConversationData(
  obj: unknown,
  depth: number,
): ConversationData | null {
  if (depth > 10 || !obj || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;
  if (record["mapping"] && typeof record["mapping"] === "object") {
    return record as ConversationData;
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findConversationData(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}
