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

  const loadCurrentSession = useCallback(async () => {
    setLoaded(false);
    clearContentHashes();
    const session = await loadSession(workspace);
    if (session) {
      setNodes(session.nodes);
      setEdges(session.edges);
      setViewport(session.viewport);
      viewportRef.current = session.viewport;
    } else {
      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });
      viewportRef.current = { x: 0, y: 0, zoom: 1 };
    }
    setLoaded(true);
  }, [workspace, setNodes, setEdges, setViewport]);

  // Load on mount
  useEffect(() => {
    // This mount-time load from an external system (the API) is fine.
    // The lint rule is overly strict for async data fetching here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      if (!loaded) return;
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
      prevNodeCount.current = nodes.length;
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
