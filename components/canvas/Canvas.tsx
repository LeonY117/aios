"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
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
import { setPendingEditorFocus } from "@/lib/editor-focus-signal";

import SotCardNode from "./nodes/SotCardNode";
import ChatNode from "./nodes/ChatNode";
import ContextBlockNode from "./nodes/ContextBlockNode";
import LinkInputNode from "./nodes/LinkInputNode";
import CenterEdge from "./edges/CenterEdge";
import CenterConnectionLine from "./edges/CenterConnectionLine";
import CanvasToolbar from "./CanvasToolbar";
import SelectionToolbar from "./SelectionToolbar";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import { useCanvasPaste } from "@/lib/hooks/useCanvasPaste";
import { handleFileUpload } from "@/lib/hooks/useFileUpload";
import { viewportCenter, topZIndex } from "@/lib/nodes";
import { useRouter } from "next/navigation";
import {
  loadSession,
  saveSession,
  createSession,
  deleteNodeContent,
  clearContentHashes,
  deleteSession,
  renameSession,
  debounce,
} from "@/lib/persistence";
import type { ChatNodeData, ContextBlockData, SotNodeData } from "@/types";

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

function CanvasInner({ workspace }: { workspace: string }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);

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
    void saveSession(workspace, nodesRef.current, edgesRef.current, viewportRef.current).then(
      () => {
        setSaveStatus("saved");
        setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
          2000,
        );
      },
    );
  }, [workspace]);

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

  // --- Workspace management ---

  const handleSwitch = useCallback(
    async (name: string) => {
      flushDebouncedSave();
      await saveSession(workspace, nodesRef.current, edgesRef.current, viewportRef.current);
      router.push("/" + encodeURIComponent(name));
    },
    [workspace, flushDebouncedSave, router],
  );

  const handleCreated = useCallback(
    async (name: string) => {
      flushDebouncedSave();
      await saveSession(workspace, nodesRef.current, edgesRef.current, viewportRef.current);
      await createSession(name);
      router.push("/" + encodeURIComponent(name));
    },
    [workspace, flushDebouncedSave, router],
  );

  const handleDeleted = useCallback(
    async (name: string) => {
      await deleteSession(name);
      if (name === workspace) {
        // Redirect to root — it will pick the newest remaining workspace
        router.push("/");
      }
    },
    [workspace, router],
  );

  const handleRenamed = useCallback(
    async (oldName: string, newName: string) => {
      await renameSession(oldName, newName);
      if (workspace === oldName) {
        router.replace("/" + encodeURIComponent(newName));
      }
    },
    [workspace, router],
  );

  // Snapshot of selected SOTs — captured before deselection so drag-to-attach works
  const dragSelectionRef = useRef<Node[]>([]);

  // Auto-save on node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // Before applying deselection, snapshot currently-selected SOTs so
      // drag-to-attach can use the full set even after React Flow deselects.
      const isDeselecting = changes.some(
        (c) => c.type === "select" && !c.selected,
      );
      if (isDeselecting) {
        const selected = nodes.filter(
          (n) =>
            n.selected && (n.type === "sotCard" || n.type === "contextBlock"),
        );
        if (selected.length > 0) dragSelectionRef.current = selected;
      }

      for (const change of changes) {
        if (change.type === "remove") {
          deleteNodeContent(workspace, change.id);
        }
      }
      onNodesChange(changes);
      // Skip save for selection-only changes (fired rapidly during marquee drag)
      const hasPersistableChange = changes.some((c) => c.type !== "select");
      if (loaded && hasPersistableChange) triggerDebouncedSave();
    },
    [workspace, nodes, onNodesChange, triggerDebouncedSave, loaded],
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;

      // Cmd+S — save
      if (e.key === "s") {
        e.preventDefault();
        flushDebouncedSave();
        doSave();
        return;
      }

      // Cmd+A — select all SOT nodes (skip if input is focused)
      if (e.key === "a") {
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.type === "sotCard" || n.type === "contextBlock",
          })),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doSave, flushDebouncedSave, setNodes]);

  // Trigger save when nodes are added via paste
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (loaded && nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length;
      triggerDebouncedSave();
    }
  }, [nodes.length, triggerDebouncedSave, loaded]);

  // Snapshot selected SOTs when a connection drag starts (before deselection)
  const connectSelectionRef = useRef<Node[]>([]);
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
      document.body.classList.add("connecting-edge");
      connectSelectionRef.current = nodes.filter(
        (n) =>
          n.selected &&
          n.id !== params.nodeId &&
          (n.type === "sotCard" || n.type === "contextBlock"),
      );
    },
    [nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const selectedSots = connectSelectionRef.current;
      connectSelectionRef.current = [];

      setEdges((eds) => {
        let next = addEdge(connection, eds);
        for (const sot of selectedSots) {
          if (
            !next.some(
              (e) => e.source === sot.id && e.target === connection.target,
            )
          ) {
            next = addEdge(
              {
                source: sot.id,
                target: connection.target!,
                sourceHandle: null,
                targetHandle: null,
              },
              next,
            );
          }
        }
        return next;
      });
      if (loaded) triggerDebouncedSave();
    },
    [setEdges, triggerDebouncedSave, loaded],
  );

  const addTextBlock = useCallback(() => {
    const active = document.activeElement;
    const chatHasFocus = active instanceof HTMLTextAreaElement;

    if (!chatHasFocus) {
      setPendingEditorFocus();
    }

    const position = viewportCenter(screenToFlowPosition);
    const data: SotNodeData = {
      title: "Untitled",
      content: "",
      sourceType: "manual",
      isRichText: true,
      isEditing: !chatHasFocus,
    };
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id: crypto.randomUUID(),
        type: "sotCard",
        position,
        data,
        style: { width: 280, height: 360 },
        zIndex: topZIndex(nds),
        selected: true,
      },
    ]);
  }, [screenToFlowPosition, setNodes]);

  const addLinkNode = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id: crypto.randomUUID(),
        type: "linkInput",
        position,
        data: {},
        style: { width: 360, height: 140 },
        zIndex: topZIndex(nds),
        selected: true,
      },
    ]);
  }, [screenToFlowPosition, setNodes]);

  const addChatNode = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    const data: ChatNodeData = {
      title: "New conversation",
      source: "interactive",
      messages: [],
      webSearch: false,
    };
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id: crypto.randomUUID(),
        type: "chatWindow",
        position,
        data,
        style: { width: 380, height: 500 },
        zIndex: topZIndex(nds),
        selected: true,
      },
    ]);
  }, [screenToFlowPosition, setNodes]);

  const addFileNode = useCallback(
    (file: File, position?: { x: number; y: number }) => {
      const pos = position ?? viewportCenter(screenToFlowPosition);
      handleFileUpload(file, pos, setNodes, workspace);
    },
    [screenToFlowPosition, setNodes, workspace],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["txt", "md", "pdf"].includes(ext)) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addFileNode(file, position);
    },
    [screenToFlowPosition, addFileNode],
  );

  const addContextBlock = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    const data: ContextBlockData = { title: "Context Block" };
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id: crypto.randomUUID(),
        type: "contextBlock",
        position,
        data,
        style: { width: 280, height: 280 },
        zIndex: topZIndex(nds),
        selected: true,
      },
    ]);
  }, [screenToFlowPosition, setNodes]);

  // Refresh the snapshot at drag start as a fallback (e.g. single-node drag
  // without prior deselection).
  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: Node, _draggedNodes: Node[]) => {
      if (dragSelectionRef.current.length === 0) {
        dragSelectionRef.current = nodes.filter(
          (n) => n.selected && (n.type === "sotCard" || n.type === "contextBlock"),
        );
      }
    },
    [nodes],
  );

  // When dragged SOT nodes are dropped onto a chat, create edges for all of them
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node, draggedNodes: Node[]) => {
      // Use the selection captured at drag start, falling back to draggedNodes
      const sotNodes =
        dragSelectionRef.current.length > 0
          ? dragSelectionRef.current
          : draggedNodes.filter(
              (n) => n.type === "sotCard" || n.type === "contextBlock",
            );
      dragSelectionRef.current = [];
      if (sotNodes.length === 0) return;

      // Use the dragged node's current position to find which SOT positions to check
      // (draggedNodes have updated positions, but dragSelectionRef may have stale positions)
      const positionMap = new Map(
        draggedNodes.map((n) => [n.id, n.position]),
      );

      // Find chat nodes that overlap with any dragged SOT center
      const chatNodes = nodes.filter((n) => n.type === "chatWindow");
      for (const chat of chatNodes) {
        const cw = chat.measured?.width ?? (chat.style?.width as number) ?? 380;
        const ch = chat.measured?.height ?? (chat.style?.height as number) ?? 500;

        const overlaps = sotNodes.some((sot) => {
          const pos = positionMap.get(sot.id) ?? sot.position;
          const sw = sot.measured?.width ?? (sot.style?.width as number) ?? 280;
          const sh = sot.measured?.height ?? (sot.style?.height as number) ?? 360;
          const cx = pos.x + sw / 2;
          const cy = pos.y + sh / 2;
          return (
            cx >= chat.position.x &&
            cx <= chat.position.x + cw &&
            cy >= chat.position.y &&
            cy <= chat.position.y + ch
          );
        });

        if (overlaps) {
          setEdges((eds) => {
            let next = [...eds];
            for (const sot of sotNodes) {
              if (!next.some((e) => e.source === sot.id && e.target === chat.id)) {
                next = addEdge({ source: sot.id, target: chat.id, sourceHandle: null, targetHandle: null }, next);
              }
            }
            return next;
          });
          if (loaded) triggerDebouncedSave();
          break; // attach to the first overlapping chat only
        }
      }
    },
    [nodes, setEdges, triggerDebouncedSave, loaded],
  );

  const draggableNodes = useMemo(
    () => nodes.map((n) => (n.dragHandle === ".custom-drag-handle" ? n : { ...n, dragHandle: ".custom-drag-handle" })),
    [nodes],
  );

  return (
    <>
      <ReactFlow
        nodes={draggableNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnectStart={onConnectStart}
        onConnectEnd={() => document.body.classList.remove("connecting-edge")}
        onViewportChange={onViewportChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "center",
          style: { stroke: "#94a3b8" },
        }}
        connectionLineComponent={CenterConnectionLine}
        selectionOnDrag
        panOnDrag={[1, 2]}
        selectionMode={SelectionMode.Partial}
        zoomOnScroll={false}
        panOnScroll
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
      <CanvasToolbar onAddText={addTextBlock} onAddLink={addLinkNode} onAddChat={addChatNode} onAddContextBlock={addContextBlock} onAddFile={addFileNode} />
      {(() => {
        const selectedSots = nodes.filter(
          (n) => n.selected && (n.type === "sotCard" || n.type === "contextBlock"),
        );
        const chatNodes = nodes.filter((n) => n.type === "chatWindow");

        const attachToChat = (chatId: string) => {
          setEdges((eds) => {
            let next = [...eds];
            for (const sot of selectedSots) {
              if (!next.some((e) => e.source === sot.id && e.target === chatId)) {
                next = addEdge({ source: sot.id, target: chatId, sourceHandle: null, targetHandle: null }, next);
              }
            }
            return next;
          });
          if (loaded) triggerDebouncedSave();
        };

        const newChatWithContext = () => {
          const chatId = crypto.randomUUID();
          const position = viewportCenter(screenToFlowPosition);
          const chatData: ChatNodeData = {
            title: "New conversation",
            source: "interactive",
            messages: [],
            webSearch: false,
          };
          setNodes((nds) => [
            ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
            {
              id: chatId,
              type: "chatWindow",
              position: { x: position.x + 200, y: position.y },
              data: chatData,
              style: { width: 380, height: 500 },
              zIndex: topZIndex(nds),
              selected: true,
            },
          ]);
          // Attach after creating the node
          setTimeout(() => attachToChat(chatId), 0);
        };

        return selectedSots.length >= 2 ? (
          <SelectionToolbar
            selectedCount={selectedSots.length}
            chatNodes={chatNodes}
            onAttachToChat={attachToChat}
            onNewChatWithContext={newChatWithContext}
          />
        ) : null;
      })()}
      <WorkspaceSidebar
        currentSession={workspace}
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

export default function Canvas({ workspace }: { workspace: string }) {
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
        .chat-drop-handle:hover + .chat-drop-content {
          border-color: #93c5fd !important;
          background-color: #eff6ff !important;
          box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.3) !important;
        }
      `}</style>
      <ReactFlowProvider>
        <CanvasInner workspace={workspace} />
      </ReactFlowProvider>
    </div>
  );
}
