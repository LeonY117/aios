"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { GROUP_CONNECTOR_ID } from "@/lib/canvas/constants";

const MAX_HISTORY = 50;

// Transient node-level fields that should not be compared or restored
const TRANSIENT_NODE_KEYS = new Set(["selected", "dragging", "measured", "draggable", "selectable"]);

// Transient data-level fields
const TRANSIENT_DATA_KEYS = new Set(["isLoading", "isStreaming", "isEditing", "attachedSots"]);

type HistorySnapshot = {
  nodes: Node[];
  edges: Edge[];
};

/** Strip transient fields from a node for snapshotting. */
function stripNode(node: Node): Node {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!TRANSIENT_NODE_KEYS.has(key)) {
      stripped[key] = value;
    }
  }
  // Strip transient data fields
  if (node.data) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.data as Record<string, unknown>)) {
      if (!TRANSIENT_DATA_KEYS.has(key)) {
        data[key] = value;
      }
    }
    stripped.data = data;
  }
  return stripped as Node;
}

/** Create a snapshot of current state, stripping transient fields. */
function takeSnapshot(nodes: Node[], edges: Edge[]): HistorySnapshot {
  return {
    nodes: nodes
      .filter((n) => n.id !== GROUP_CONNECTOR_ID)
      .map(stripNode),
    edges: edges.map((e) => ({ ...e })),
  };
}

/**
 * Restore a snapshot, preserving current content/messages for nodes that
 * exist in both current and snapshot (avoids conflict with Tiptap/chat).
 * Nodes being un-deleted get their full snapshot data (including content).
 */
function applySnapshot(
  snapshot: HistorySnapshot,
  currentNodes: Node[],
): { nodes: Node[]; edges: Edge[] } {
  const currentById = new Map(currentNodes.map((n) => [n.id, n]));
  const restoredNodes = snapshot.nodes.map((snapNode) => {
    const current = currentById.get(snapNode.id);
    if (current) {
      // Node exists in both — restore layout, keep current content/messages
      const data = {
        ...(snapNode.data as Record<string, unknown>),
      };
      const currentData = current.data as Record<string, unknown>;
      // Preserve live content and messages from current state
      if ("content" in currentData) data.content = currentData.content;
      if ("messages" in currentData) data.messages = currentData.messages;
      // Preserve transient state from current
      for (const key of TRANSIENT_DATA_KEYS) {
        if (key in currentData) data[key] = currentData[key];
      }
      return {
        ...snapNode,
        data,
        // Preserve current transient node-level fields
        selected: current.selected,
        measured: current.measured,
        dragging: current.dragging,
      };
    }
    // Node only in snapshot — being un-deleted, restore fully
    return { ...snapNode, selected: false };
  });

  return { nodes: restoredNodes, edges: snapshot.edges };
}

export function useUndoRedo(
  nodes: Node[],
  edges: Edge[],
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  workspace: string,
) {
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const isRestoringRef = useRef(false);

  // Microtask coalescing: only the first set* call in a synchronous block
  // captures a snapshot. A queued microtask resets the flag so the next
  // event loop turn can capture again.
  const pendingRef = useRef(false);

  // Keep current state accessible via refs for snapshot creation
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Clear history on workspace change
  useEffect(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, [workspace]);

  /**
   * Snapshot current state onto the undo stack. Call BEFORE mutating.
   * Safe to call multiple times in the same tick — only the first call
   * captures; subsequent calls are no-ops until the microtask flushes.
   */
  const pushSnapshot = useCallback(() => {
    if (isRestoringRef.current) return;
    if (pendingRef.current) return; // already captured this tick
    pendingRef.current = true;
    queueMicrotask(() => { pendingRef.current = false; });
    const snapshot = takeSnapshot(nodesRef.current, edgesRef.current);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
    futureRef.current = [];
  }, []);

  /** Wrap a setter so it automatically pushes history before mutating. */
  const setNodesWithHistory: typeof setNodes = useCallback(
    (updater) => {
      pushSnapshot();
      setNodes(updater);
    },
    [setNodes, pushSnapshot],
  );

  const setEdgesWithHistory: typeof setEdges = useCallback(
    (updater) => {
      pushSnapshot();
      setEdges(updater);
    },
    [setEdges, pushSnapshot],
  );

  /** Undo: restore previous state. */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    isRestoringRef.current = true;
    // Save current state to future
    futureRef.current = [...futureRef.current, takeSnapshot(nodesRef.current, edgesRef.current)];
    // Pop from past
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    // Apply
    const restored = applySnapshot(prev, nodesRef.current);
    setNodes(restored.nodes);
    setEdges(restored.edges);
    // Use setTimeout to clear flag after React processes the state update
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, [setNodes, setEdges]);

  /** Redo: restore next state. */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    isRestoringRef.current = true;
    // Save current state to past
    pastRef.current = [...pastRef.current, takeSnapshot(nodesRef.current, edgesRef.current)];
    // Pop from future
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    // Apply
    const restored = applySnapshot(next, nodesRef.current);
    setNodes(restored.nodes);
    setEdges(restored.edges);
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, [setNodes, setEdges]);

  return {
    pushSnapshot,
    setNodesWithHistory,
    setEdgesWithHistory,
    undo,
    redo,
    isRestoringRef,
  };
}
