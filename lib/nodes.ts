import type { Node } from "@xyflow/react";
import type { SotNodeData } from "@/types";

export function createSotNode(
  data: SotNodeData,
  position: { x: number; y: number },
): Node {
  return {
    id: crypto.randomUUID(),
    type: "sotCard",
    position,
    data,
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
