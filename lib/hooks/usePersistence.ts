"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge, Viewport } from "@xyflow/react";
import { GROUP_CONNECTOR_ID } from "@/lib/canvas/constants";
import {
  loadSession,
  saveSession,
  clearContentHashes,
  debounce,
} from "@/lib/persistence";

type SaveStatus = "idle" | "saving" | "saved";

type DebouncedSave = (() => void) & { flush: () => void };

/**
 * Manages session persistence: load, save (debounced), viewport tracking,
 * and ref-based snapshots of nodes/edges for closure-safe access.
 */
export function usePersistence(
  workspace: string,
  nodes: Node[],
  edges: Edge[],
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  setViewport: (vp: Viewport) => void,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);

  // Refs keep current values available in debounced/async callbacks.
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Keep refs in sync without mutating during render.
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // --- Save ---

  const doSave = useCallback((): void => {
    setSaveStatus("saving");
    const persistNodes = nodesRef.current.filter(
      (n) => n.id !== GROUP_CONNECTOR_ID,
    );
    void saveSession(
      workspace,
      persistNodes,
      edgesRef.current,
      viewportRef.current,
    ).then(() => {
      setSaveStatus("saved");
      setTimeout(
        () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
        2000,
      );
    });
  }, [workspace]);

  const debouncedSaveRef = useRef<DebouncedSave | null>(null);

  useEffect(() => {
    debouncedSaveRef.current = debounce(doSave, 1000) as DebouncedSave;
  }, [doSave]);

  const triggerDebouncedSave = useCallback(() => {
    debouncedSaveRef.current?.();
  }, []);

  const flushDebouncedSave = useCallback(() => {
    debouncedSaveRef.current?.flush();
  }, []);

  // --- Load ---
  // Keep old workspace visible until the new one is fully loaded.
  // We only touch React state once the fetch resolves, and guard
  // against stale responses if workspace changes again mid-load.

  const loadingWorkspaceRef = useRef<string | null>(null);

  // Grace period after load — suppresses false "edited" from post-load
  // viewport changes and node-count effects settling.
  const settledRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCurrentSession = useCallback(async () => {
    const target = workspace;
    loadingWorkspaceRef.current = target;
    settledRef.current = false;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    const session = await loadSession(target);
    // If workspace changed while we were fetching, discard this result.
    if (loadingWorkspaceRef.current !== target) return;
    clearContentHashes();
    const loadedNodes = session?.nodes ?? [];
    setNodes(loadedNodes);
    setEdges(session?.edges ?? []);
    const vp = session?.viewport ?? { x: 0, y: 0, zoom: 1 };
    setViewport(vp);
    viewportRef.current = vp;
    // Sync prevNodeCount so the node-count effect doesn't see a change on load
    prevNodeCount.current = loadedNodes.length;
    setLoaded(true);
    // Allow viewport saves after settling period
    settleTimerRef.current = setTimeout(() => { settledRef.current = true; }, 1500);
  }, [workspace, setNodes, setEdges, setViewport]);

  // Load on mount / workspace change
  useEffect(() => {
    // Flush any pending save for the previous workspace before loading the new one
    debouncedSaveRef.current?.flush();
    setLoaded(false);
    loadCurrentSession();
  }, [loadCurrentSession]);

  // --- Viewport tracking ---

  // Track viewport position without triggering save on every pan/zoom frame.
  // Viewport data is included in the next save triggered by a real change
  // (node move, content edit, etc.).  We use a separate trailing timer so
  // viewport-only changes (user just pans around) still persist eventually.
  const vpSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onViewportChange = useCallback(
    (vp: Viewport) => {
      viewportRef.current = vp;
      if (!loaded || !settledRef.current) return;
      if (vpSaveTimerRef.current) clearTimeout(vpSaveTimerRef.current);
      vpSaveTimerRef.current = setTimeout(() => {
        triggerDebouncedSave();
      }, 1000);
    },
    [triggerDebouncedSave, loaded],
  );

  // --- Trigger save when nodes are added (e.g. via paste) ---

  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (loaded && nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length; // eslint-disable-line react-hooks/immutability
      triggerDebouncedSave();
    }
  }, [nodes.length, triggerDebouncedSave, loaded]);

  return {
    saveStatus,
    loaded,
    nodesRef,
    edgesRef,
    viewportRef,
    triggerDebouncedSave,
    flushDebouncedSave,
    doSave,
    loadCurrentSession,
    onViewportChange,
  };
}
