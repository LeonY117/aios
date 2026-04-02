"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { setPendingEditorFocus } from "@/lib/editor-focus-signal";

import SotCardNode from "./nodes/SotCardNode";
import ChatNode from "./nodes/ChatNode";
import ContextBlockNode from "./nodes/ContextBlockNode";
import LinkInputNode from "./nodes/LinkInputNode";
import GroupConnectorNode from "./nodes/GroupConnectorNode";
import CenterEdge from "./edges/CenterEdge";
import CenterConnectionLine from "./edges/CenterConnectionLine";
import CanvasToolbar from "./CanvasToolbar";
import GroupConnectorToolbar from "./GroupConnectorToolbar";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import CommandPalette from "@/components/CommandPalette";
import { useCanvasPaste } from "@/lib/hooks/useCanvasPaste";
import { useSpacePan } from "@/lib/hooks/useSpacePan";
import { usePersistence } from "@/lib/hooks/usePersistence";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useGroupSelection } from "@/lib/hooks/useGroupSelection";
import { useDragToAttach } from "@/lib/hooks/useDragToAttach";
import { GROUP_CONNECTOR_ID } from "@/lib/canvas/constants";
import { handleFileUpload } from "@/lib/hooks/useFileUpload";
import {
  viewportCenter,
  appendNode,
  createTextBlockNode,
  createChatWindowNode,
  createContextBlockNode,
  createLinkInputNode,
} from "@/lib/nodes";
import { useTheme } from "@/lib/themes";
import { selectAllSots } from "@/lib/canvas/actions";
import { cloneNodes } from "@/lib/canvas/clone-nodes";
import { setClipboard, getClipboard, incrementPasteCount } from "@/lib/canvas/internal-clipboard";
import { topZIndex } from "@/lib/nodes";
import { WorkspaceProvider } from "@/lib/ai/workspace-context";
import { useRouter } from "next/navigation";
import {
  saveSession,
  createSession,
  deleteNodeContent,
  deleteSession,
  renameSession,
  archiveSession,
} from "@/lib/persistence";

const nodeTypes = {
  sotCard: SotCardNode,
  chatWindow: ChatNode,
  contextBlock: ContextBlockNode,
  linkInput: LinkInputNode,
  groupConnector: GroupConnectorNode,
};

const edgeTypes = {
  center: CenterEdge,
};

function CanvasInner({ workspace }: { workspace: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [nodes, setNodesRaw, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Wrap setNodes so every node in state has dragHandle set.
  // This lets us pass `nodes` directly to ReactFlow, preserving reference
  // identity for unchanged nodes so React Flow can skip them with ===.
  const setNodes: typeof setNodesRaw = useCallback(
    (updater) => {
      setNodesRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (next.every((n) => n.dragHandle === ".custom-drag-handle"))
          return next;
        return next.map((n) =>
          n.dragHandle === ".custom-drag-handle"
            ? n
            : { ...n, dragHandle: ".custom-drag-handle" },
        );
      });
    },
    [setNodesRaw],
  );
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const { isSpaceHeld, onMoveStart, onMoveEnd } = useSpacePan();

  const {
    saveStatus,
    loaded,
    nodesRef,
    edgesRef,
    viewportRef,
    triggerDebouncedSave,
    flushDebouncedSave,
    doSave,
    onViewportChange,
  } = usePersistence(workspace, nodes, edges, setNodes, setEdges, setViewport);

  useGroupSelection(nodes, setNodesRaw);

  useCanvasPaste(setNodes);

  const {
    captureSelectionBeforeDeselect,
    onConnectStart,
    onConnect,
    onNodeClick,
    onNodeDragStart,
    onNodeDragStop,
    selectedSots,
    chatNodes,
    attachToChat,
    newChatWithContext,
  } = useDragToAttach(nodesRef, edgesRef, nodes, setNodes, setEdges, screenToFlowPosition, triggerDebouncedSave, loaded, workspace);

  // --- Workspace management ---

  async function handleSwitch(name: string) {
    flushDebouncedSave();
    await saveSession(workspace, nodesRef.current.filter((n) => n.id !== GROUP_CONNECTOR_ID), edgesRef.current, viewportRef.current);
    router.push("/" + encodeURIComponent(name));
  }

  async function handleCreated(name: string) {
    flushDebouncedSave();
    await saveSession(workspace, nodesRef.current.filter((n) => n.id !== GROUP_CONNECTOR_ID), edgesRef.current, viewportRef.current);
    await createSession(name);
    router.push("/" + encodeURIComponent(name));
  }

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

  const handleArchived = useCallback(
    async (name: string, archived: boolean) => {
      try {
        await archiveSession(name, archived);
        if (archived && name === workspace) {
          router.push("/");
        }
      } catch {
        // archiveSession throws on failure — sidebar will re-fetch on next open
      }
    },
    [workspace, router],
  );

  // Auto-save on node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // Snapshot selected SOTs before deselection for drag-to-attach
      captureSelectionBeforeDeselect(changes);

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
    [workspace, onNodesChange, triggerDebouncedSave, loaded, captureSelectionBeforeDeselect],
  );

  // Auto-save on edge changes
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (loaded) triggerDebouncedSave();
    },
    [onEdgesChange, triggerDebouncedSave, loaded],
  );

  // Allow pinch / Cmd+scroll zoom even over .nowheel elements.
  // React Flow blocks ALL wheel events inside .nowheel; we strip the class
  // for zoom gestures so they reach the d3 zoom handler.
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      let el = e.target as HTMLElement | null;
      const stripped: HTMLElement[] = [];
      while (el) {
        if (el.classList.contains("nowheel")) {
          el.classList.remove("nowheel");
          stripped.push(el);
        }
        el = el.parentElement;
      }
      if (stripped.length > 0) {
        requestAnimationFrame(() => {
          for (const s of stripped) s.classList.add("nowheel");
        });
      }
    };
    document.addEventListener("wheel", handler, { capture: true, passive: true });
    return () => document.removeEventListener("wheel", handler, { capture: true });
  }, []);


  const addTextBlock = useCallback(() => {
    const active = document.activeElement;
    const chatHasFocus = active instanceof HTMLTextAreaElement;
    if (!chatHasFocus) setPendingEditorFocus();
    const position = viewportCenter(screenToFlowPosition);
    setNodes((nds) => appendNode(nds, createTextBlockNode(position, { isEditing: !chatHasFocus })));
  }, [screenToFlowPosition, setNodes]);

  const addLinkNode = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    setNodes((nds) => appendNode(nds, createLinkInputNode(position)));
  }, [screenToFlowPosition, setNodes]);

  const addChatNode = useCallback(() => {
    const position = viewportCenter(screenToFlowPosition);
    setNodes((nds) => appendNode(nds, createChatWindowNode(position)));
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
    setNodes((nds) => appendNode(nds, createContextBlockNode(position)));
  }, [screenToFlowPosition, setNodes]);

  const selectAll = useCallback(() => {
    setNodes((nds) => selectAllSots(nds));
  }, [setNodes]);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((o) => !o);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const triggerFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.pdf";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) addFileNode(file);
    };
    input.click();
  }, [addFileNode]);

  const copyNodes = useCallback(() => {
    const selected = nodesRef.current.filter(
      (n) => n.selected && n.id !== GROUP_CONNECTOR_ID && n.type !== "linkInput",
    );
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const relevantEdges = edgesRef.current.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
    );
    setClipboard(selected, relevantEdges);
  }, [nodesRef, edgesRef]);

  const cutNodes = useCallback(() => {
    copyNodes();
    const selected = nodesRef.current.filter(
      (n) => n.selected && n.id !== GROUP_CONNECTOR_ID,
    );
    if (selected.length === 0) return;
    const changes: NodeChange<Node>[] = selected.map((n) => ({ type: "remove" as const, id: n.id }));
    handleNodesChange(changes);
    const removedIds = new Set(selected.map((n) => n.id));
    setEdges((eds) => eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)));
    if (loaded) triggerDebouncedSave();
  }, [copyNodes, nodesRef, handleNodesChange, setEdges, loaded, triggerDebouncedSave]);

  const pasteNodes = useCallback((): boolean => {
    const clip = getClipboard();
    if (!clip) return false;
    incrementPasteCount();
    const offset = clip.pasteCount * 40;
    const { nodes: clonedNodes, edges: clonedEdges } = cloneNodes(
      clip.nodes, clip.edges, { x: offset, y: offset },
    );
    setNodes((nds) => {
      const deselected = nds.map((n) => (n.selected ? { ...n, selected: false } : n));
      const z = topZIndex(deselected);
      return [...deselected, ...clonedNodes.map((n, i) => ({ ...n, zIndex: z + i + 1 }))];
    });
    setEdges((eds) => [...eds, ...clonedEdges]);
    if (loaded) triggerDebouncedSave();
    return true;
  }, [setNodes, setEdges, loaded, triggerDebouncedSave]);

  useKeyboardShortcuts(
    useMemo(
      () => ({
        addTextBlock,
        addLinkNode,
        addChatNode,
        addContextBlock,
        doSave,
        flushDebouncedSave,
        selectAll,
        toggleCommandPalette,
        copyNodes,
        cutNodes,
        pasteNodes,
      }),
      [addTextBlock, addLinkNode, addChatNode, addContextBlock, doSave, flushDebouncedSave, selectAll, toggleCommandPalette, copyNodes, cutNodes, pasteNodes],
    ),
  );

  return (
    <WorkspaceProvider value={{ sessionName: workspace }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnectStart={onConnectStart}
        onConnectEnd={() => document.body.classList.remove("connecting-edge")}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onViewportChange={onViewportChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme.type}
        defaultEdgeOptions={{
          type: "center",
          style: { stroke: "var(--edge)" },
        }}
        connectionLineComponent={CenterConnectionLine}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionOnDrag={!isSpaceHeld}
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
        panOnDrag={isSpaceHeld ? [0, 1, 2] : [1, 2]}
        selectionMode={SelectionMode.Partial}
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Meta"
        panOnScroll
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} />
        {selectedSots.length >= 2 && (
          <GroupConnectorToolbar
            selectedSots={selectedSots}
            chatNodes={chatNodes}
            onAttachToChat={attachToChat}
            onNewChatWithContext={newChatWithContext}
          />
        )}
      </ReactFlow>
      <CanvasToolbar onAddText={addTextBlock} onAddLink={addLinkNode} onAddChat={addChatNode} onAddContextBlock={addContextBlock} onAddFile={addFileNode} />
      <WorkspaceSidebar
        currentSession={workspace}
        onSwitch={handleSwitch}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
        onRenamed={handleRenamed}
        onArchived={handleArchived}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        currentSession={workspace}
        onSwitchWorkspace={handleSwitch}
        onCreateWorkspace={handleCreated}
        onAddTextBlock={addTextBlock}
        onAddChatNode={addChatNode}
        onAddLinkNode={addLinkNode}
        onAddContextBlock={addContextBlock}
        onAddFile={triggerFileUpload}
      />
      {saveStatus !== "idle" && (
        <div className="absolute bottom-6 left-6 text-xs text-fg-muted select-none">
          {saveStatus === "saving" ? "Saving..." : "Saved"}
        </div>
      )}
    </WorkspaceProvider>
  );
}

export default function Canvas({ workspace }: { workspace: string }) {
  return (
    <div className="relative w-screen h-dvh">
      {/* Override library z-index so edges/connection line render behind nodes */}
      <style>{`
        svg.react-flow__connectionline { z-index: -1 !important; }
        .react-flow .react-flow__edges { z-index: -1 !important; }
        .react-flow__node[data-id="${GROUP_CONNECTOR_ID}"] .connector-handle-visual {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .react-flow__node:hover .connector-handle-visual {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .connector-handle:hover .connector-handle-visual {
          background-color: var(--connector-hover-bg) !important;
          border-color: var(--connector-hover-border) !important;
        }
        .connector-handle:hover .connector-handle-visual svg {
          color: var(--connector-hover-icon) !important;
        }
        .context-drop-handle:hover + .context-drop-content {
          border-color: var(--context-drop-border) !important;
          background-color: var(--context-drop-bg) !important;
          box-shadow: 0 0 0 3px var(--context-drop-shadow) !important;
        }
        .chat-drop-handle:hover + .chat-drop-content {
          border-color: var(--chat-drop-border) !important;
          background-color: var(--chat-drop-bg) !important;
          box-shadow: 0 0 0 3px var(--chat-drop-shadow) !important;
        }
      `}</style>
      <ReactFlowProvider>
        <CanvasInner workspace={workspace} />
      </ReactFlowProvider>
    </div>
  );
}
