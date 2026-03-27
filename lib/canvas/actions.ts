import type { Node, Edge } from "@xyflow/react";
import { addEdge } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Pure action helpers — take current state, return next state.
// No React dependencies. Designed for future undo/redo dispatch.
// ---------------------------------------------------------------------------

/** Update a single node's data by merging a partial patch. */
export function updateNodeData<T extends Record<string, unknown>>(
  nodes: Node[],
  nodeId: string,
  patch: Partial<T>,
): Node[] {
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
  );
}

/** Select only SOT-type nodes (sotCard + contextBlock). */
export function selectAllSots(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    selected: n.type === "sotCard" || n.type === "contextBlock",
  }));
}

/** Select a single node, deselecting all others. */
export function soloSelect(nodes: Node[], nodeId: string): Node[] {
  return nodes.map((n) => ({ ...n, selected: n.id === nodeId }));
}

/** Add edges from multiple source SOTs to a single target, skipping duplicates. */
export function addEdgesFromSots(
  edges: Edge[],
  sotNodeIds: string[],
  targetId: string,
): Edge[] {
  let next = [...edges];
  for (const sotId of sotNodeIds) {
    if (!next.some((e) => e.source === sotId && e.target === targetId)) {
      next = addEdge(
        { source: sotId, target: targetId, sourceHandle: null, targetHandle: null },
        next,
      );
    }
  }
  return next;
}

/** Remove all edges between a specific source and target. */
export function removeEdgeBetween(
  edges: Edge[],
  sourceId: string,
  targetId: string,
): Edge[] {
  return edges.filter((e) => !(e.source === sourceId && e.target === targetId));
}

// ---------------------------------------------------------------------------
// CanvasAction discriminated union — for future undo/redo dispatch.
// ---------------------------------------------------------------------------

export type CanvasAction =
  | { type: "update-node-data"; nodeId: string; patch: Record<string, unknown> }
  | { type: "add-edges"; sotIds: string[]; targetId: string }
  | { type: "remove-edge"; sourceId: string; targetId: string }
  | { type: "select-all-sots" }
  | { type: "solo-select"; nodeId: string };
