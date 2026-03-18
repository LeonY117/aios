import type { ChatMessage } from "@/types";

type ContentReference = {
  matched_text?: string;
  alt?: string;
  type?: string;
  safe_urls?: string[];
};

type MessageNode = {
  message?: {
    author?: { role?: string };
    content?: { parts?: unknown[]; content_type?: string };
    metadata?: {
      model_slug?: string;
      is_visually_hidden_from_conversation?: boolean;
      content_references?: ContentReference[];
    };
  };
  parent?: string;
  children?: string[];
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

/**
 * Replace ChatGPT's unicode-delimited markers (entity[], image_group{}, etc.)
 * with their plain-text or markdown equivalents using content_references metadata.
 *
 * Markers use private-use-area delimiters: \ue200 (start) \ue202 (separator) \ue201 (end).
 * Each marker has a corresponding entry in content_references with `matched_text` and `alt`.
 */
function resolveContentReferences(
  text: string,
  refs: ContentReference[] | undefined,
): string {
  if (!refs || refs.length === 0) return text;

  // Replace each matched_text with its alt value
  let result = text;
  for (const ref of refs) {
    if (!ref.matched_text || ref.alt === undefined) continue;
    result = result.replace(ref.matched_text, ref.alt);
  }

  // Remove any remaining unicode markers that weren't matched
  // \ue200...\ue201 with optional \ue202 separator
  result = result.replace(/\ue200[^\ue201]*\ue201/g, "");

  return result;
}

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

  // Use linear_conversation for ordering if available, otherwise walk the tree
  const orderedIds = linearConversation
    ? linearConversation.map((ref) => ref.id).filter(Boolean)
    : walkTree(mapping);

  for (const id of orderedIds) {
    if (!id) continue;
    const node = mapping[id];
    if (!node?.message) continue;

    const role = node.message.author?.role;
    if (!role || role === "system" || role === "tool") continue;

    // Skip hidden messages (e.g. system context, model_editable_context)
    if (node.message.metadata?.is_visually_hidden_from_conversation) continue;
    if (node.message.content?.content_type === "model_editable_context") continue;

    const parts = node.message.content?.parts;
    if (!Array.isArray(parts)) continue;

    let content = parts
      .filter((p): p is string => typeof p === "string")
      .join("\n");
    if (!content) continue;

    // Resolve entity[], image_group{}, and other markers
    content = resolveContentReferences(
      content,
      node.message.metadata?.content_references,
    );

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

/** Walk the mapping tree from root following children links to get ordered IDs. */
function walkTree(mapping: Record<string, MessageNode>): string[] {
  // Find root: a node with no parent or parent not in mapping
  let rootId: string | undefined;
  for (const [id, node] of Object.entries(mapping)) {
    if (!node.parent || !(node.parent in mapping)) {
      rootId = id;
      break;
    }
  }
  if (!rootId) return Object.keys(mapping);

  const ordered: string[] = [];
  const visit = (id: string) => {
    ordered.push(id);
    const node = mapping[id];
    if (node?.children) {
      for (const childId of node.children) {
        visit(childId);
      }
    }
  };
  visit(rootId);
  return ordered;
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
