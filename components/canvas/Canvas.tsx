"use client";

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SotCardNode from "./nodes/SotCardNode";
import type { SotNodeData } from "@/types";

const nodeTypes = { sotCard: SotCardNode };

const initialNodes = [
  {
    id: "1",
    type: "sotCard",
    position: { x: 100, y: 100 },
    data: {
      title: "Project Requirements",
      content:
        "AIOS is a canvas-based context management tool for LLM conversations. Users can collect sources of truth (SOTs) and wire them into AI chat sessions. The goal is to give users visual transparency over what context their LLM has access to.",
      sourceType: "notion",
      sourceUrl: "https://notion.so/example",
    } satisfies SotNodeData,
  },
  {
    id: "2",
    type: "sotCard",
    position: { x: 450, y: 80 },
    data: {
      title: "API Design Notes",
      content:
        "The REST API should expose endpoints for managing SOT nodes and chat sessions. Each SOT node has a title, content body, source type, and optional source URL. Chat nodes maintain a message history and a list of attached SOT references.",
      sourceType: "github",
    } satisfies SotNodeData,
  },
  {
    id: "3",
    type: "sotCard",
    position: { x: 250, y: 350 },
    data: {
      title: "Meeting Notes — Kickoff",
      content:
        "Decided to start with manual text SOTs before building integrations. Phase 1 focuses on canvas rendering and node display. Phase 2 adds persistence with localStorage. Integrations (Notion, Slack) come in v1+.",
      sourceType: "manual",
    } satisfies SotNodeData,
  },
];

export default function Canvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState([]);

  return (
    <div className="w-screen h-dvh">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          minZoom={0.25}
          maxZoom={2}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
