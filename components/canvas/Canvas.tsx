"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SotCardNode from "./nodes/SotCardNode";
import { detectSource } from "@/lib/sources/detect";
import { createSotNode, viewportCenter } from "@/lib/nodes";
import type { SotNodeData } from "@/types";

const nodeTypes = { sotCard: SotCardNode };

const SOURCE_ENDPOINT: Record<string, string> = {
  github: "/api/sources/github",
  notion: "/api/sources/notion",
  url: "/api/sources/url",
  chatgpt: "/api/sources/url", // Phase 4 adds dedicated handler
};

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;

      e.preventDefault();

      const detection = detectSource(text);
      const position = viewportCenter(screenToFlowPosition);

      if (detection.type === "manual") {
        const title =
          detection.text.length > 50
            ? detection.text.slice(0, 50) + "…"
            : detection.text;
        const data: SotNodeData = {
          title,
          content: detection.text,
          sourceType: "manual",
        };
        setNodes((nds) => [...nds, createSotNode(data, position)]);
      } else {
        const nodeId = crypto.randomUUID();
        const sourceType: SotNodeData["sourceType"] =
          detection.type === "chatgpt" ? "url" : detection.type;
        const endpoint = SOURCE_ENDPOINT[detection.type] ?? "/api/sources/url";
        const loadingData: SotNodeData = {
          title: detection.url,
          content: "",
          sourceType,
          sourceUrl: detection.url,
          isLoading: true,
        };
        setNodes((nds) => [
          ...nds,
          { id: nodeId, type: "sotCard", position, data: loadingData, style: { width: 288, height: 320 } },
        ]);

        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: detection.url }),
        })
          .then((res) => res.json())
          .then((result) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      data: {
                        title: result.title,
                        content: result.content,
                        sourceType: result.sourceType,
                        sourceUrl: result.sourceUrl,
                        isLoading: false,
                      } satisfies SotNodeData,
                    }
                  : n,
              ),
            );
          })
          .catch(() => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      data: {
                        title: detection.url,
                        content:
                          "Failed to fetch or extract content from this URL.",
                        sourceType,
                        sourceUrl: detection.url,
                        isLoading: false,
                      } satisfies SotNodeData,
                    }
                  : n,
              ),
            );
          });
      }
    },
    [screenToFlowPosition, setNodes],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      minZoom={0.25}
      maxZoom={2}
    >
      <Background variant={BackgroundVariant.Dots} />
    </ReactFlow>
  );
}

export default function Canvas() {
  return (
    <div className="w-screen h-dvh">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
