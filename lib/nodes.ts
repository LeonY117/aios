import type { Node } from "@xyflow/react";
import type { SotNodeData, ChatNodeData, ContextBlockData } from "@/types";

/** Returns a zIndex higher than any existing node so the new node renders on top. */
export function topZIndex(nodes: Node[]): number {
  let max = 0;
  for (const n of nodes) {
    if (n.zIndex != null && n.zIndex > max) max = n.zIndex;
  }
  return max + 1;
}

export function createSotNode(
  data: SotNodeData,
  position: { x: number; y: number },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "sotCard",
    position,
    data,
    style: { width: 288, height: 320 },
  };
}

/** Deselect all nodes and append a new node at the top z-index. */
export function appendNode(nodes: Node[], newNode: Node): Node[] {
  return [
    ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    { ...newNode, zIndex: topZIndex(nodes), selected: true },
  ];
}

export function createTextBlockNode(
  position: { x: number; y: number },
  opts: { isEditing: boolean },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "sotCard",
    position,
    data: {
      title: "Untitled",
      content: "",
      sourceType: "manual",
      isRichText: true,
      isEditing: opts.isEditing,
    } satisfies SotNodeData,
    style: { width: 280, height: 360 },
  };
}

export function createChatWindowNode(
  position: { x: number; y: number },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "chatWindow",
    position,
    data: {
      title: "New conversation",
      source: "interactive",
      messages: [],
      webSearch: false,
    } satisfies ChatNodeData,
    style: { width: 380, height: 500 },
  };
}

export function createContextBlockNode(
  position: { x: number; y: number },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "contextBlock",
    position,
    data: { title: "Context Block" } satisfies ContextBlockData,
    style: { width: 280, height: 280 },
  };
}

export function createLinkInputNode(
  position: { x: number; y: number },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "linkInput",
    position,
    data: {},
    style: { width: 360, height: 140 },
  };
}

export function viewportCenter(
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
): { x: number; y: number } {
  const center = screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const jitter = () => Math.round((Math.random() - 0.5) * 100);
  return { x: center.x + jitter(), y: center.y + jitter() };
}
