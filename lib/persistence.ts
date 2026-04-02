import type { Node, Edge, Viewport } from "@xyflow/react";
import type { ChatMessage } from "@/types";

type SessionLayout = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

// --- Content serialization ---

function serializeChatMessages(messages: ChatMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.timestamp != null ? { timestamp: m.timestamp } : {}),
      ...(m.sources && m.sources.length > 0 ? { sources: m.sources } : {}),
      ...(m.blocks && m.blocks.length > 0 ? { blocks: m.blocks } : {}),
      ...(m.toolCalls && m.toolCalls.length > 0 ? { toolCalls: m.toolCalls } : {}),
    })),
  );
}

function deserializeChatMessages(raw: string): ChatMessage[] {
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
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
  delete data.isStreaming;
  // Don't persist "maximized" — restore to normal on reload
  if (data.viewMode === "maximized") data.viewMode = "normal";
  return { ...node, data };
}

// --- API calls ---

async function fetchLayout(sessionName: string): Promise<SessionLayout> {
  const res = await fetch(`/api/session?name=${encodeURIComponent(sessionName)}`);
  return res.json();
}

async function postLayout(sessionName: string, layout: SessionLayout): Promise<void> {
  await fetch(`/api/session?name=${encodeURIComponent(sessionName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
}

async function fetchContent(sessionName: string, nodeId: string, nodeType?: string): Promise<string> {
  const params = new URLSearchParams({ name: sessionName, id: nodeId });
  if (nodeType) params.set("type", nodeType);
  const res = await fetch(`/api/session/content?${params}`);
  const { content } = await res.json();
  return content;
}

async function postContent(sessionName: string, nodeId: string, content: string, nodeType?: string): Promise<void> {
  const params = new URLSearchParams({ name: sessionName, id: nodeId });
  if (nodeType) params.set("type", nodeType);
  await fetch(`/api/session/content?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function deleteContent(sessionName: string, nodeId: string): Promise<void> {
  await fetch(`/api/session/content?name=${encodeURIComponent(sessionName)}&id=${nodeId}`, {
    method: "DELETE",
  });
}

// --- Content hash tracking ---

const contentHashes = new Map<string, string>();

export function clearContentHashes(): void {
  contentHashes.clear();
}

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

export async function loadSession(sessionName: string): Promise<{
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
} | null> {
  try {
    const layout = await fetchLayout(sessionName);
    if (layout.nodes.length === 0 && layout.edges.length === 0) {
      return null;
    }

    // Load content for each node in parallel
    const nodes = await Promise.all(
      layout.nodes.map(async (node) => {
        const content = await fetchContent(sessionName, node.id, node.type);
        const data = { ...node.data } as Record<string, unknown>;

        if (node.type === "chatWindow" && content) {
          data.messages = deserializeChatMessages(content);
        } else if (content) {
          data.content = content;
        }

        // Reconstruct pdfUrl for PDF nodes
        if (data.sourceType === "pdf") {
          data.pdfUrl = `/api/session/files?name=${encodeURIComponent(sessionName)}&id=${node.id}`;
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
  sessionName: string,
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
): Promise<void> {
  try {
    // Save layout (without content)
    const strippedNodes = nodes
      .filter((n) => !n.data?.isLoading)
      .map(stripContent);
    await postLayout(sessionName, { nodes: strippedNodes, edges, viewport });

    // Save dirty content files in parallel
    const contentSaves = nodes
      .filter((n) => !n.data?.isLoading)
      .map((node) => {
        const content = getNodeContent(node);
        if (content === null) return null;
        if (!isContentDirty(node.id, content)) return null;
        return postContent(sessionName, node.id, content, node.type);
      })
      .filter(Boolean);

    await Promise.all(contentSaves);
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export async function deleteNodeContent(sessionName: string, nodeId: string): Promise<void> {
  contentHashes.delete(nodeId);
  await deleteContent(sessionName, nodeId).catch(() => {});
  // Also clean up any associated PDF file
  await fetch(
    `/api/session/files?name=${encodeURIComponent(sessionName)}&id=${nodeId}`,
    { method: "DELETE" },
  ).catch(() => {});
}

export async function createSession(sessionName: string): Promise<boolean> {
  const layout = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  const res = await fetch(
    `/api/session?name=${encodeURIComponent(sessionName)}&create=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    },
  );
  return res.ok;
}

// --- Session management ---

export type SessionEntry = { name: string; createdAt: string; updatedAt: string; archived: boolean; emoji?: string };

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
}

export async function updateSessionEmoji(
  name: string,
  emoji: string | null,
): Promise<void> {
  await fetch("/api/session/emoji", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, emoji }),
  });
}

export async function archiveSession(
  name: string,
  archived: boolean,
): Promise<void> {
  const res = await fetch("/api/session/archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, archived }),
  });
  if (!res.ok) throw new Error("Failed to archive session");
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
