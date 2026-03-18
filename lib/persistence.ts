import type { Node, Edge, Viewport } from "@xyflow/react";
import type { ChatMessage } from "@/types";

let currentSessionName = "default";

export function getSessionName(): string {
  return currentSessionName;
}

export function setSessionName(name: string): void {
  currentSessionName = name;
  contentHashes.clear();
}

type SessionLayout = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

// --- Content serialization ---

function serializeChatMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => `**${m.role}:**\n${m.content}`)
    .join("\n\n---\n\n");
}

function deserializeChatMessages(md: string): ChatMessage[] {
  if (!md.trim()) return [];
  return md.split("\n\n---\n\n").map((block) => {
    const match = block.match(/^\*\*(\w+):\*\*\n([\s\S]*)$/);
    if (!match) return { role: "user" as const, content: block };
    return {
      role: match[1] as ChatMessage["role"],
      content: match[2],
    };
  });
}

function getNodeContent(node: Node): string | null {
  const data = node.data as Record<string, unknown>;
  if (node.type === "chatWindow" && Array.isArray(data.messages)) {
    return serializeChatMessages(data.messages as ChatMessage[]);
  }
  if (typeof data.content === "string") {
    return data.content;
  }
  return null;
}

function stripContent(node: Node): Node {
  const data = { ...node.data } as Record<string, unknown>;
  delete data.content;
  delete data.messages;
  delete data.isLoading;
  return { ...node, data };
}

// --- API calls ---

async function fetchLayout(): Promise<SessionLayout> {
  const res = await fetch(`/api/session?name=${currentSessionName}`);
  return res.json();
}

async function postLayout(layout: SessionLayout): Promise<void> {
  await fetch(`/api/session?name=${currentSessionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
}

async function fetchContent(nodeId: string): Promise<string> {
  const res = await fetch(
    `/api/session/content?name=${currentSessionName}&id=${nodeId}`,
  );
  const { content } = await res.json();
  return content;
}

async function postContent(nodeId: string, content: string): Promise<void> {
  await fetch(`/api/session/content?name=${currentSessionName}&id=${nodeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function deleteContent(nodeId: string): Promise<void> {
  await fetch(`/api/session/content?name=${currentSessionName}&id=${nodeId}`, {
    method: "DELETE",
  });
}

// --- Content hash tracking ---

const contentHashes = new Map<string, string>();

function hashContent(content: string): string {
  // Simple fast hash — good enough for dirty checking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function isContentDirty(nodeId: string, content: string): boolean {
  const hash = hashContent(content);
  if (contentHashes.get(nodeId) === hash) return false;
  contentHashes.set(nodeId, hash);
  return true;
}

// --- Public API ---

export async function loadSession(): Promise<{
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
} | null> {
  try {
    const layout = await fetchLayout();
    if (layout.nodes.length === 0 && layout.edges.length === 0) {
      return null;
    }

    // Load content for each node in parallel
    const nodes = await Promise.all(
      layout.nodes.map(async (node) => {
        const content = await fetchContent(node.id);
        const data = { ...node.data } as Record<string, unknown>;

        if (node.type === "chatWindow" && content) {
          data.messages = deserializeChatMessages(content);
        } else if (content) {
          data.content = content;
        }

        // Initialize content hash so first save doesn't re-write unchanged content
        if (content) {
          contentHashes.set(node.id, hashContent(content));
        }

        return { ...node, data };
      }),
    );

    return { nodes, edges: layout.edges, viewport: layout.viewport };
  } catch (e) {
    console.error("Failed to load session:", e);
    return null;
  }
}

export async function saveSession(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
): Promise<void> {
  try {
    // Save layout (without content)
    const strippedNodes = nodes
      .filter((n) => !n.data?.isLoading)
      .map(stripContent);
    await postLayout({ nodes: strippedNodes, edges, viewport });

    // Save dirty content files in parallel
    const contentSaves = nodes
      .filter((n) => !n.data?.isLoading)
      .map((node) => {
        const content = getNodeContent(node);
        if (content === null) return null;
        if (!isContentDirty(node.id, content)) return null;
        return postContent(node.id, content);
      })
      .filter(Boolean);

    await Promise.all(contentSaves);
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export async function deleteNodeContent(nodeId: string): Promise<void> {
  contentHashes.delete(nodeId);
  await deleteContent(nodeId).catch(() => {});
}

// --- Session management ---

export async function listSessions(): Promise<string[]> {
  const res = await fetch("/api/session/list");
  const { sessions } = await res.json();
  return sessions;
}

export async function deleteSession(name: string): Promise<void> {
  await fetch(`/api/session?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function renameSession(
  oldName: string,
  newName: string,
): Promise<void> {
  await fetch("/api/session/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldName, newName }),
  });
  if (currentSessionName === oldName) {
    currentSessionName = newName;
  }
}

// --- Debounce utility ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): ((...args: Parameters<T>) => void) & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
    }
  };

  return debounced;
}
