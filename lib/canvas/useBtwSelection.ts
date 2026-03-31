"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { createChatWindowNode, appendNode } from "@/lib/nodes";
import type { ChatMessage, ChatNodeData } from "@/types";

export type BtwTooltipState = {
  text: string;
  x: number; // viewport center-X of selection
  y: number; // viewport top-Y of selection
  bottomY: number; // viewport bottom-Y of selection (panel anchor)
};

/**
 * Hook that manages the full btw quick-ask lifecycle:
 * text selection detection → tooltip → panel → keep-as-chat-node.
 *
 * Attach `containerRef` to the element to monitor and `handleMouseUp` to its onMouseUp.
 */
export function useBtwSelection(nodeId: string) {
  const { getNodes, setNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [btwTooltip, setBtwTooltip] = useState<BtwTooltipState | null>(null);
  const [btwPanelOpen, setBtwPanelOpen] = useState(false);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 3) return;

    const container = containerRef.current;
    if (!container) return;
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !container.contains(anchorNode)) return;

    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setBtwTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
      bottomY: rect.bottom,
    });
    setBtwPanelOpen(false);
  }, []);

  // Hide tooltip when selection is cleared (unless panel is open)
  useEffect(() => {
    if (!btwTooltip || btwPanelOpen) return;
    const onSelChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setBtwTooltip(null);
      }
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, [btwTooltip, btwPanelOpen]);

  const openPanel = useCallback(() => setBtwPanelOpen(true), []);

  const closePanel = useCallback(() => {
    setBtwPanelOpen(false);
    setBtwTooltip(null);
  }, []);

  /** Promote a btw conversation into a full chat window node. */
  const handleKeep = useCallback(
    (btwMessages: ChatMessage[]) => {
      const firstUser = btwMessages.find((m) => m.role === "user");
      const title = firstUser
        ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "")
        : "Quick ask";

      const currentNode = getNodes().find((n) => n.id === nodeId);
      const currentWidth =
        (currentNode?.measured?.width) ??
        (currentNode?.style?.width as number | undefined) ??
        380;
      const currentPos = currentNode?.position ?? { x: 0, y: 0 };

      const newNode = createChatWindowNode({
        x: currentPos.x + currentWidth + 40,
        y: currentPos.y,
      });
      (newNode.data as ChatNodeData).title = title;
      (newNode.data as ChatNodeData).messages = btwMessages;

      setNodes((nds) => appendNode(nds, newNode));
      setBtwPanelOpen(false);
      setBtwTooltip(null);
    },
    [nodeId, getNodes, setNodes],
  );

  return {
    containerRef,
    btwTooltip,
    btwPanelOpen,
    handleMouseUp,
    openPanel,
    closePanel,
    handleKeep,
  };
}
