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

/** Update a single node's data AND dimensions by merging partial patches.
 *  Sets both style.height and the top-level node height/measured so React Flow
 *  actually re-renders at the new size (it caches measured dimensions).
 *  Pass `height: undefined` in stylePatch to remove the height constraint (auto-size). */
export function updateNode<T extends Record<string, unknown>>(
  nodes: Node[],
  nodeId: string,
  dataPatch: Partial<T>,
  stylePatch?: Record<string, unknown>,
): Node[] {
  return nodes.map((n) => {
    if (n.id !== nodeId) return n;
    // Build new style, removing keys set to undefined
    const newStyle = { ...(n.style ?? {}), ...stylePatch };
    for (const key of Object.keys(newStyle)) {
      if ((newStyle as Record<string, unknown>)[key] === undefined) {
        delete (newStyle as Record<string, unknown>)[key];
      }
    }
    const updated: Node = {
      ...n,
      data: { ...n.data, ...dataPatch },
      style: newStyle,
    };
    // Sync node-level height/width + clear measured cache so RF picks up the change
    if (stylePatch && "height" in stylePatch) {
      if (stylePatch.height != null) {
        updated.height = stylePatch.height as number;
        updated.measured = { ...n.measured, height: stylePatch.height as number };
      } else {
        // Removing height — clear measured so RF re-measures from DOM
        updated.height = undefined;
        updated.measured = undefined;
      }
    }
    if (stylePatch?.width != null) {
      updated.width = stylePatch.width as number;
      updated.measured = { ...(updated.measured ?? n.measured), width: stylePatch.width as number };
    }
    return updated;
  });
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
