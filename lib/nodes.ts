import type { Node } from "@xyflow/react";
import type { SotNodeData } from "@/types";

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
