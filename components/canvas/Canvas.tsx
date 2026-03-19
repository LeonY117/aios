"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type Viewport,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SotCardNode from "./nodes/SotCardNode";
import ChatNode from "./nodes/ChatNode";
import ContextBlockNode from "./nodes/ContextBlockNode";
import LinkInputNode from "./nodes/LinkInputNode";
import CenterEdge from "./edges/CenterEdge";
import CenterConnectionLine from "./edges/CenterConnectionLine";
import CanvasToolbar from "./CanvasToolbar";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { useCanvasPaste } from "@/lib/hooks/useCanvasPaste";
import { viewportCenter } from "@/lib/nodes";
import {
  loadSession,
  saveSession,
  deleteNodeContent,
  deleteSession,
  renameSession,
  setSessionName,
  getSessionName,
  debounce,
} from "@/lib/persistence";
import type { ContextBlockData, SotNodeData } from "@/types";

const nodeTypes = {
  sotCard: SotCardNode,
  chatWindow: ChatNode,
  contextBlock: ContextBlockNode,
  linkInput: LinkInputNode,
};

const edgeTypes = {
  center: CenterEdge,
};

type SaveStatus = "idle" | "saving" | "saved";

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);
  const [currentSession, setCurrentSession] = useState(getSessionName);

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

  useCanvasPaste(setNodes);

  // --- Persistence ---

  const doSave = useCallback((): void => {
    setSaveStatus("saving");
    void saveSession(nodesRef.current, edgesRef.current, viewportRef.current).then(
      () => {
        setSaveStatus("saved");
        setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
          2000,
        );
      },
    );
  }, []);

  type DebouncedSave = (() => void) & { flush: () => void };
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

  // Load session
  const loadCurrentSession = useCallback(async () => {
    setLoaded(false);
    const session = await loadSession();
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
  }, [setNodes, setEdges, setViewport]);

  // Load on mount
  useEffect(() => {
    // This mount-time load from an external system (the API) is fine.
    // The lint rule is overly strict for async data fetching here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrentSession();
  }, [loadCurrentSession]);

  // --- Workspace management ---

  const handleSwitch = useCallback(
    async (name: string) => {
      // Save current before switching
      flushDebouncedSave();
      await saveSession(nodesRef.current, edgesRef.current, viewportRef.current);

      setSessionName(name);
      setCurrentSession(name);
      await loadCurrentSession();
    },
    [flushDebouncedSave, loadCurrentSession],
  );

  const handleCreated = useCallback(
    async (name: string) => {
      // Save current before switching
      flushDebouncedSave();
      await saveSession(nodesRef.current, edgesRef.current, viewportRef.current);

      setSessionName(name);
      setCurrentSession(name);
      // New workspace starts empty — save empty state to create the directory
      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });
      viewportRef.current = { x: 0, y: 0, zoom: 1 };
      setLoaded(true);
      await saveSession([], [], { x: 0, y: 0, zoom: 1 });
    },
    [flushDebouncedSave, setNodes, setEdges, setViewport],
  );

  const handleDeleted = useCallback(
    async (name: string) => {
      await deleteSession(name);
      // If deleting the current session, switch to default
      if (name === currentSession) {
        setSessionName("default");
        setCurrentSession("default");
        await loadCurrentSession();
      }
    },
    [currentSession, loadCurrentSession],
  );

  const handleRenamed = useCallback(
    async (oldName: string, newName: string) => {
      await renameSession(oldName, newName);
      if (currentSession === oldName) {
        setCurrentSession(newName);
      }
    },
    [currentSession],
  );

  // Auto-save on node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          deleteNodeContent(change.id);
        }
      }
      onNodesChange(changes);
      if (loaded) triggerDebouncedSave();
    },
    [onNodesChange, triggerDebouncedSave, loaded],
  );

  // Auto-save on edge changes
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (loaded) triggerDebouncedSave();
    },
    [onEdgesChange, triggerDebouncedSave, loaded],
  );

  // Track viewport changes
  const onViewportChange = useCallback(
    (vp: Viewport) => {
      viewportRef.current = vp;
      if (loaded) triggerDebouncedSave();
    },
    [triggerDebouncedSave, loaded],
  );

  // Cmd+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flushDebouncedSave();
        doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doSave, flushDebouncedSave]);

  // Trigger save when nodes are added via paste
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (loaded && nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length;
      triggerDebouncedSave();
    }
  }, [nodes.length, triggerDebouncedSave, loaded]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      if (loaded) triggerDebouncedSave();
    },
    [setEdges, triggerDebouncedSave, loaded],
  );

  const addTextBlock = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    const data: SotNodeData = {
      title: "Untitled",
      content: "",
      sourceType: "manual",
      isRichText: true,
      isEditing: true,
    };
    const node: Node = {
      id: crypto.randomUUID(),
      type: "sotCard",
      position,
      data,
      style: { width: 280, height: 360 },
    };
    setNodes((nds) => [...nds, node]);
  }, [screenToFlowPosition, setNodes]);

  const addLinkNode = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    const node: Node = {
      id: crypto.randomUUID(),
      type: "linkInput",
      position,
      data: {},
      style: { width: 360, height: 140 },
    };
    setNodes((nds) => [...nds, node]);
  }, [screenToFlowPosition, setNodes]);

  const addContextBlock = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    const data: ContextBlockData = { title: "Context Block" };
    const node: Node = {
      id: crypto.randomUUID(),
      type: "contextBlock",
      position,
      data,
      style: { width: 280, height: 280 },
    };
    setNodes((nds) => [...nds, node]);
  }, [screenToFlowPosition, setNodes]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onViewportChange={onViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "center",
          style: { stroke: "#94a3b8" },
        }}
        connectionLineComponent={CenterConnectionLine}
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
      <CanvasToolbar onAddText={addTextBlock} onAddLink={addLinkNode} onAddContextBlock={addContextBlock} />
      <WorkspaceSidebar
        currentSession={currentSession}
        onSwitch={handleSwitch}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
        onRenamed={handleRenamed}
      />
      {saveStatus !== "idle" && (
        <div className="absolute bottom-6 left-6 text-xs text-slate-400 select-none">
          {saveStatus === "saving" ? "Saving..." : "Saved"}
        </div>
      )}
    </>
  );
}

export default function Canvas() {
  return (
    <div className="relative w-screen h-dvh">
      {/* Override library z-index so edges/connection line render behind nodes */}
      <style>{`
        svg.react-flow__connectionline { z-index: -1 !important; }
        .react-flow .react-flow__edges { z-index: -1 !important; }
        .react-flow__node:hover .connector-handle-visual {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .connector-handle:hover .connector-handle-visual {
          background-color: #eef2ff !important;
          border-color: #818cf8 !important;
        }
        .connector-handle:hover .connector-handle-visual svg {
          color: #6366f1 !important;
        }
        .context-drop-handle:hover + .context-drop-content {
          border-color: #818cf8 !important;
          background-color: #e0e7ff !important;
          box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25) !important;
        }
      `}</style>
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
