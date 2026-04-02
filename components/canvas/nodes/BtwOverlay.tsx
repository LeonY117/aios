"use client";

import BtwTooltip from "./BtwTooltip";
import BtwPanel from "./BtwPanel";
import type { BtwTooltipState } from "@/lib/canvas/useBtwSelection";
import type { ChatMessage } from "@/types";

type BtwOverlayProps = {
  btwTooltip: BtwTooltipState | null;
  btwPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  handleKeep: (messages: ChatMessage[]) => void;
  modelId?: string;
  nodeContent?: string;
  nodeTitle?: string;
};

/** Shared btw tooltip + panel rendering used by any node that supports text selection. */
export default function BtwOverlay({
  btwTooltip,
  btwPanelOpen,
  openPanel,
  closePanel,
  handleKeep,
  modelId,
  nodeContent,
  nodeTitle,
}: BtwOverlayProps) {
  if (!btwTooltip) return null;

  return (
    <>
      {!btwPanelOpen && (
        <BtwTooltip
          x={btwTooltip.x}
          y={btwTooltip.y}
          onClick={openPanel}
        />
      )}
      {btwPanelOpen && (
        <BtwPanel
          selectedText={btwTooltip.text}
          anchorX={btwTooltip.x}
          anchorY={btwTooltip.bottomY}
          modelId={modelId}
          nodeContent={nodeContent}
          nodeTitle={nodeTitle}
          onKeep={handleKeep}
          onClose={closePanel}
        />
      )}
    </>
  );
}
