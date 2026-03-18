"use client";

import { useCallback } from "react";
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
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SotCardNode from "./nodes/SotCardNode";
import ChatNode from "./nodes/ChatNode";
import ContextBlockNode from "./nodes/ContextBlockNode";
import { useCanvasPaste } from "@/lib/hooks/useCanvasPaste";
import { viewportCenter } from "@/lib/nodes";
import type { ContextBlockData } from "@/types";

const nodeTypes = {
  sotCard: SotCardNode,
  chatWindow: ChatNode,
  contextBlock: ContextBlockNode,
};

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();

  useCanvasPaste(setNodes);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#94a3b8" },
        }}
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
      <button
        onClick={addContextBlock}
        className="absolute bottom-6 right-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-600 transition-colors"
      >
        + Context Block
      </button>
    </>
  );
}

export default function Canvas() {
  return (
    <div className="relative w-screen h-dvh">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
