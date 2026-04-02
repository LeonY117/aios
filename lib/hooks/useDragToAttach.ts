"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import { GROUP_CONNECTOR_ID } from "@/lib/canvas/constants";
import { viewportCenter, topZIndex } from "@/lib/nodes";
import { soloSelect, addEdgesFromSots } from "@/lib/canvas/actions";
import { cloneNodes } from "@/lib/canvas/clone-nodes";
import type { ChatNodeData } from "@/types";

type MutableRef<T> = { current: T };

/**
 * Extracts all drag-to-attach, connection, and selection-related logic
 * from the canvas: node click, drag start/stop, connect start/end,
 * the deselection snapshot, derived selection lists, and toolbar actions.
 */
export function useDragToAttach(
  nodesRef: MutableRef<Node[]>,
  edgesRef: MutableRef<Edge[]>,
  nodes: Node[],
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  triggerDebouncedSave: () => void,
  loaded: boolean,
  sessionName: string,
) {
  // Snapshot of selected SOTs -- captured before deselection so drag-to-attach works
  const dragSelectionRef = useRef<Node[]>([]);

  // Snapshot selected SOTs when a connection drag starts (before deselection)
  const connectSelectionRef = useRef<Node[]>([]);

  // Called by Canvas BEFORE onNodesChange to snapshot selected SOTs
  // before React Flow deselects them.
  const captureSelectionBeforeDeselect = useCallback(
    (changes: NodeChange<Node>[]) => {
      const isDeselecting = changes.some(
        (c) => c.type === "select" && !c.selected,
      );
      if (isDeselecting) {
        const selected = nodesRef.current.filter(
          (n) =>
            n.selected &&
            (n.type === "sotCard" || n.type === "contextBlock"),
        );
        if (selected.length > 0) dragSelectionRef.current = selected;
      }
    },
    [nodesRef],
  );

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
      document.body.classList.add("connecting-edge");
      connectSelectionRef.current = nodesRef.current.filter(
        (n) =>
          n.selected &&
          n.id !== params.nodeId &&
          (n.type === "sotCard" || n.type === "contextBlock"),
      );
    },
    [nodesRef],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const selectedSots = connectSelectionRef.current;
      connectSelectionRef.current = [];

      setEdges((eds) => {
        // Skip edge from the group-connector proxy -- it's not a real source
        const base =
          connection.source === GROUP_CONNECTOR_ID
            ? eds
            : addEdge(connection, eds);
        return addEdgesFromSots(
          base,
          selectedSots.map((s) => s.id),
          connection.target!,
        );
      });
      if (loaded) triggerDebouncedSave();
    },
    [setEdges, triggerDebouncedSave, loaded],
  );

  // Figma-like solo-select: clicking an already-selected node in a group
  // should deselect all others. React Flow skips this case by default.
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, clickedNode: Node) => {
      if (
        clickedNode.selected &&
        !_event.shiftKey &&
        nodesRef.current.filter((n) => n.selected).length > 1
      ) {
        setNodes((nds) => soloSelect(nds, clickedNode.id));
      }
    },
    [nodesRef, setNodes],
  );

  // Refresh the snapshot at drag start as a fallback (e.g. single-node drag
  // without prior deselection). Alt+drag clones selected nodes in-place.
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, _node: Node, _draggedNodes: Node[]) => {
      if (dragSelectionRef.current.length === 0) {
        dragSelectionRef.current = nodesRef.current.filter(
          (n) =>
            n.selected &&
            (n.type === "sotCard" || n.type === "contextBlock"),
        );
      }

      // Alt+drag: clone selected nodes (or just the dragged node) at their current positions
      if (event.altKey) {
        const dragged = nodesRef.current.find((n) => n.id === _node.id);
        const selected = nodesRef.current.filter(
          (n) => n.selected && n.id !== GROUP_CONNECTOR_ID && n.type !== "linkInput",
        );
        // If the dragged node isn't in the selection, duplicate just that node
        const toCopy = selected.length > 0 && selected.some((n) => n.id === _node.id)
          ? selected
          : dragged && dragged.type !== "linkInput" ? [dragged] : [];
        if (toCopy.length === 0) return;
        const copyIds = new Set(toCopy.map((n) => n.id));
        const relevantEdges = edgesRef.current.filter(
          (e) => copyIds.has(e.source) && copyIds.has(e.target),
        );
        const { nodes: clonedNodes, edges: clonedEdges } = cloneNodes(
          toCopy, relevantEdges, { x: 0, y: 0 },
        );
        // Insert clones unselected at original positions — user drags originals away
        setNodes((nds) => [...nds, ...clonedNodes.map((n) => ({ ...n, selected: false }))]);
        setEdges((eds) => [...eds, ...clonedEdges]);
        if (loaded) triggerDebouncedSave();
      }
    },
    [nodesRef, edgesRef, setNodes, setEdges, loaded, triggerDebouncedSave],
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
      const chats = nodesRef.current.filter((n) => n.type === "chatWindow");
      for (const chat of chats) {
        const cw =
          chat.measured?.width ?? (chat.style?.width as number) ?? 380;
        const ch =
          chat.measured?.height ?? (chat.style?.height as number) ?? 500;

        const overlaps = sotNodes.some((sot) => {
          const pos = positionMap.get(sot.id) ?? sot.position;
          const sw =
            sot.measured?.width ?? (sot.style?.width as number) ?? 280;
          const sh =
            sot.measured?.height ?? (sot.style?.height as number) ?? 360;
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
          setEdges((eds) =>
            addEdgesFromSots(
              eds,
              sotNodes.map((n) => n.id),
              chat.id,
            ),
          );
          if (loaded) triggerDebouncedSave();
          break; // attach to the first overlapping chat only
        }
      }
    },
    [nodesRef, setEdges, triggerDebouncedSave, loaded],
  );

  // Derived lists for selection toolbar
  const selectedSots = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.selected &&
          (n.type === "sotCard" || n.type === "contextBlock"),
      ),
    [nodes],
  );

  const chatNodes = useMemo(
    () => nodes.filter((n) => n.type === "chatWindow"),
    [nodes],
  );

  const attachToChat = useCallback(
    (chatId: string) => {
      const sots = nodesRef.current.filter(
        (n) =>
          n.selected &&
          (n.type === "sotCard" || n.type === "contextBlock"),
      );
      setEdges((eds) =>
        addEdgesFromSots(
          eds,
          sots.map((n) => n.id),
          chatId,
        ),
      );
      if (loaded) triggerDebouncedSave();
    },
    [nodesRef, setEdges, triggerDebouncedSave, loaded],
  );

  const newChatWithContext = useCallback(() => {
    const chatId = crypto.randomUUID();
    const position = viewportCenter(screenToFlowPosition);
    const sots = nodesRef.current.filter(
      (n) =>
        n.selected &&
        (n.type === "sotCard" || n.type === "contextBlock"),
    );
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
    setEdges((eds) =>
      addEdgesFromSots(
        eds,
        sots.map((n) => n.id),
        chatId,
      ),
    );
    if (loaded) triggerDebouncedSave();
  }, [nodesRef, screenToFlowPosition, setNodes, setEdges, triggerDebouncedSave, loaded]);

  return {
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
  };
}
