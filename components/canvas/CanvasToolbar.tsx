"use client";

import { useRef } from "react";

type CanvasToolbarProps = {
  onAddText: () => void;
  onAddLink: () => void;
  onAddChat: () => void;
  onAddContextBlock: () => void;
  onAddFile: (file: File) => void;
};

export default function CanvasToolbar({
  onAddText,
  onAddLink,
  onAddChat,
  onAddContextBlock,
  onAddFile,
}: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Upload file (txt, md, pdf)"
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
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAddFile(file);
          e.target.value = "";
        }}
      />

      <div className="h-5 w-px bg-gray-200" />

      {/* Link button */}
      <button
        onClick={onAddLink}
        title="Add from link"
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
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      <div className="h-5 w-px bg-gray-200" />

      {/* Chat button */}
      <button
        onClick={onAddChat}
        title="New chat"
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <div className="h-5 w-px bg-gray-200" />

      {/* Context block button */}
      <button
        onClick={onAddContextBlock}
        title="Add context block"
        className="nodrag flex items-center gap-1.5 rounded-md bg-indigo-500 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
      >
        + Context
      </button>
    </div>
  );
}
