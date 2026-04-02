import type { Node, Edge } from "@xyflow/react";
import { GROUP_CONNECTOR_ID } from "./constants";

/** Node types that should never be copied. */
const SKIP_TYPES = new Set(["linkInput", "groupConnector"]);

/** Source types that cannot be duplicated (file-backed). */
const SKIP_SOURCE_TYPES = new Set(["pdf"]);

/** Transient data keys stripped from every cloned node. */
const TRANSIENT_KEYS: string[] = [
  "isLoading",
  "isStreaming",
  "isEditing",
  "attachedSots",
  "_savedHeight",
];

export type CloneResult = {
  nodes: Node[];
  edges: Edge[];
  idMap: Map<string, string>;
};

/**
 * Clone a set of nodes and the edges between them.
 *
 * Returns new nodes with fresh IDs, offset positions, cleaned data,
 * and remapped edges. Pure function — no side effects.
 */
export function cloneNodes(
  selectedNodes: Node[],
  selectedEdges: Edge[],
  offset: { x: number; y: number },
): CloneResult {
  const copyable = selectedNodes.filter(
    (n) =>
      n.id !== GROUP_CONNECTOR_ID &&
      !SKIP_TYPES.has(n.type ?? "") &&
      !SKIP_SOURCE_TYPES.has((n.data as Record<string, unknown>)?.sourceType as string ?? ""),
  );

  const idMap = new Map<string, string>();
  for (const n of copyable) {
    idMap.set(n.id, crypto.randomUUID());
  }

  const clonedNodes: Node[] = copyable.map((n) => {
    const newId = idMap.get(n.id)!;
    const data = structuredClone(n.data) as Record<string, unknown>;

    for (const key of TRANSIENT_KEYS) {
      delete data[key];
    }
    if (data.viewMode === "maximized") {
      data.viewMode = "normal";
    }

    return {
      ...n,
      id: newId,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
      data,
      style: n.style ? { ...n.style } : undefined,
      selected: true,
      measured: undefined,
    };
  });

  const clonedEdges: Edge[] = selectedEdges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      data: e.data ? structuredClone(e.data) : undefined,
    }));

  return { nodes: clonedNodes, edges: clonedEdges, idMap };
}
