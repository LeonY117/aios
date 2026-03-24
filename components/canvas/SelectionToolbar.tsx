"use client";

import { useState, useRef, useEffect, memo } from "react";
import type { Node } from "@xyflow/react";
import type { ChatNodeData } from "@/types";

type SelectionToolbarProps = {
  selectedCount: number;
  chatNodes: Node[];
  onAttachToChat: (chatId: string) => void;
  onNewChatWithContext: () => void;
};

export default memo(function SelectionToolbar({
  selectedCount,
  chatNodes,
  onAttachToChat,
  onNewChatWithContext,
}: SelectionToolbarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const interactiveChats = chatNodes.filter(
    (n) => (n.data as ChatNodeData).source === "interactive",
  );

  const hasChats = interactiveChats.length > 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <span className="text-sm text-gray-600">
        {selectedCount} source{selectedCount !== 1 ? "s" : ""} selected
      </span>

      <div className="h-5 w-px bg-gray-200" />

      {hasChats ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            Add to chat
            <svg
              width="12"
              height="12"
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

          {open && (
            <div className="absolute bottom-full left-0 mb-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  onNewChatWithContext();
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 border-b border-gray-100"
              >
                + New chat
              </button>
              {interactiveChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    onAttachToChat(chat.id);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 truncate"
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
          className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          New chat with context
        </button>
      )}
    </div>
  );
});
