"use client";

import { useState, useRef, useEffect, memo } from "react";
import { ViewportPortal, useStore } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ChatNodeData } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  selectedSots: Node[];
  chatNodes: Node[];
  onAttachToChat: (chatId: string) => void;
  onNewChatWithContext: () => void;
};

type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

// ---------------------------------------------------------------------------
// Store selector — bounding box of ALL selected nodes
// ---------------------------------------------------------------------------

const EMPTY_BOUNDS: SelectionBounds = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  zoom: 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectBounds(s: any): SelectionBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [, node] of s.nodeLookup) {
    if (!node.selected || node.type === "groupConnector") continue;
    const x: number = node.internals.positionAbsolute.x;
    const y: number = node.internals.positionAbsolute.y;
    const w: number = node.measured?.width ?? 0;
    const h: number = node.measured?.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!isFinite(minX)) return EMPTY_BOUNDS;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    zoom: s.transform[2],
  };
}

function boundsEqual(a: SelectionBounds, b: SelectionBounds) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.zoom === b.zoom
  );
}

/** Visual gap (in screen px) between the bottom of the selection box and the toolbar. */
const TOOLBAR_GAP_PX = 8;
/** Extra buffer (in screen px) for the selection rect's border / box-shadow. */
const SELECTION_RECT_PADDING_PX = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default memo(function GroupConnectorToolbar({
  selectedSots,
  chatNodes,
  onAttachToChat,
  onNewChatWithContext,
}: Props) {
  const bounds = useStore(selectBounds, boundsEqual);

  // -- Dropdown state -------------------------------------------------------
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as HTMLElement)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // -- Derived values -------------------------------------------------------
  const interactiveChats = chatNodes.filter(
    (n) => (n.data as ChatNodeData).source === "interactive",
  );
  const hasChats = interactiveChats.length > 0;

  const invZoom = Math.min(1 / bounds.zoom, 3);
  const toolbarX = bounds.x + bounds.width / 2;
  const gapFlow = (TOOLBAR_GAP_PX + SELECTION_RECT_PADDING_PX) / bounds.zoom;
  const toolbarY = bounds.y + bounds.height + gapFlow;

  // -- Render ---------------------------------------------------------------
  return (
    <ViewportPortal>
      {/* Toolbar below the group selection box */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="nopan nodrag nowheel"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: bounds.x,
          top: toolbarY,
          width: bounds.width,
          display: "flex",
          justifyContent: "center",
          zIndex: 10000,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            transform: `scale(${invZoom})`,
            transformOrigin: "top center",
            pointerEvents: "all",
          }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-lg whitespace-nowrap"
        >
          <span className="text-xs text-gray-500 font-medium">
            {selectedSots.length} source
            {selectedSots.length !== 1 ? "s" : ""}
          </span>

          <div className="h-4 w-px bg-gray-200" />

          {/* Add-to-chat button / dropdown */}
          {hasChats ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 transition-colors"
              >
                Add to chat
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute bottom-full left-0 mb-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-[10001]">
                  <button
                    onClick={() => {
                      onNewChatWithContext();
                      setDropdownOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 border-b border-gray-100"
                  >
                    + New chat
                  </button>
                  {interactiveChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        onAttachToChat(chat.id);
                        setDropdownOpen(false);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 truncate"
                    >
                      {(chat.data as ChatNodeData).title || "Untitled chat"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onNewChatWithContext}
              className="flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
});
