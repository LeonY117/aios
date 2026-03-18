"use client";

import { useState } from "react";

type CanvasToolbarProps = {
  onAddText: () => void;
  onAddLink: (url: string) => void;
};

export default function CanvasToolbar({
  onAddText,
  onAddLink,
}: CanvasToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const handleLinkSubmit = () => {
    const trimmed = linkUrl.trim();
    if (trimmed) {
      onAddLink(trimmed);
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-1 shadow-lg">
      {/* Text button */}
      <button
        onClick={onAddText}
        title="Add text block"
        className="nodrag flex items-center justify-center rounded-md px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>

      <div className="h-5 w-px bg-gray-200" />

      {/* Link button */}
      <div className="relative">
        <button
          onClick={() => setShowLinkInput(!showLinkInput)}
          title="Add from link"
          className={`nodrag flex items-center justify-center rounded-md px-2.5 py-1.5 transition-colors ${
            showLinkInput
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>

        {showLinkInput && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Paste a link (Notion, GitHub, Slack, or any URL)
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLinkSubmit();
                  if (e.key === "Escape") {
                    setShowLinkInput(false);
                    setLinkUrl("");
                  }
                }}
                placeholder="https://..."
                autoFocus
                className="nodrag flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={handleLinkSubmit}
                disabled={!linkUrl.trim()}
                className="nodrag rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
