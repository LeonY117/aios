"use client";

import { memo, useRef, useState, useCallback, useEffect } from "react";
import { FolderIcon, LinkIcon, UndoIcon } from "@/components/icons";
import EmojiPicker from "@/components/EmojiPicker";

type CanvasToolbarProps = {
  workspaceName: string;
  emoji?: string;
  archived?: boolean;
  onAddText: () => void;
  onAddLink: () => void;
  onAddChat: () => void;
  onAddContextBlock: () => void;
  onAddFile: (file: File) => void;
  onRename: (newName: string) => void;
  onEmojiChange: (emoji: string | null) => void;
  onRestore?: () => void;
};

export default memo(function CanvasToolbar({
  workspaceName,
  emoji,
  archived,
  onAddText,
  onAddLink,
  onAddChat,
  onAddContextBlock,
  onAddFile,
  onRename,
  onEmojiChange,
  onRestore,
}: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(workspaceName);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Keep nameValue in sync when workspace changes
  useEffect(() => {
    setNameValue(workspaceName);
  }, [workspaceName]);

  const commitRename = useCallback(() => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== workspaceName) {
      onRename(trimmed);
    } else {
      setNameValue(workspaceName);
    }
  }, [nameValue, workspaceName, onRename]);

  const startEditing = useCallback(() => {
    if (archived) return;
    setEditingName(true);
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  }, [archived]);

  const toolBtnClass = archived
    ? "nodrag flex items-center justify-center rounded-md px-2.5 py-1.5 text-fg-dim opacity-30 cursor-default"
    : "nodrag flex items-center justify-center rounded-md px-2.5 py-1.5 text-fg-dim hover:bg-hover hover:text-fg transition-colors";

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-lg border px-1 py-1 shadow-lg ${
        archived
          ? "border-line-hover bg-surface/90"
          : "border-line bg-surface"
      }`}
    >
      {/* Emoji icon / picker */}
      <div className="relative">
        <button
          onClick={() => !archived && setShowEmojiPicker((v) => !v)}
          className={`nodrag flex items-center justify-center w-8 h-8 rounded-md transition-colors -mr-1 ${
            archived
              ? "opacity-40 cursor-default"
              : "hover:bg-hover cursor-pointer"
          }`}
          title={archived ? undefined : "Change icon"}
        >
          {emoji ? (
            <span className="text-[20px] leading-none">{emoji}</span>
          ) : (
            <FolderIcon width={15} height={15} className="text-fg-dim" />
          )}
        </button>
        {showEmojiPicker && !archived && (
          <EmojiPicker
            onSelect={(e) => onEmojiChange(e)}
            onRemove={() => onEmojiChange(null)}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>

      {/* Workspace name — always an input to avoid layout shift */}
      <input
        ref={nameInputRef}
        value={editingName ? nameValue : workspaceName}
        readOnly={!editingName}
        onChange={(e) => setNameValue(e.target.value)}
        onClick={startEditing}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") {
            setNameValue(workspaceName);
            setEditingName(false);
            nameInputRef.current?.blur();
          }
        }}
        spellCheck={false}
        className={`nodrag text-sm font-semibold bg-transparent border rounded px-1 py-0.5 outline-none max-w-[200px] truncate transition-colors ${
          editingName
            ? "border-accent text-fg"
            : archived
              ? "border-transparent text-fg-dim cursor-default"
              : "border-transparent text-fg hover:border-line cursor-text"
        }`}
        style={{ width: `${Math.max((editingName ? nameValue : workspaceName).length + 1, 12)}ch` }}
      />

      {/* Archived badge */}
      {archived && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted bg-hover border border-line rounded px-1.5 py-0.5 ml-0.5">
          Archived
        </span>
      )}

      <div className="h-5 w-px bg-handle mx-0.5" />

      {/* Text button */}
      <button
        onClick={archived ? undefined : onAddText}
        title="Add text block (T)"
        className={toolBtnClass}
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

      <div className="h-5 w-px bg-handle" />

      {/* Upload button */}
      <button
        onClick={archived ? undefined : () => fileInputRef.current?.click()}
        title="Upload file (txt, md, pdf)"
        className={toolBtnClass}
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

      <div className="h-5 w-px bg-handle" />

      {/* Link button */}
      <button
        onClick={archived ? undefined : onAddLink}
        title="Add from link (L)"
        className={toolBtnClass}
      >
        <LinkIcon width={18} height={18} />
      </button>

      <div className="h-5 w-px bg-handle" />

      {/* Chat button */}
      <button
        onClick={archived ? undefined : onAddChat}
        title="New chat (C)"
        className={toolBtnClass}
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

      <div className="h-5 w-px bg-handle" />

      {/* Context block / Restore button */}
      {archived ? (
        <button
          onClick={onRestore}
          className="nodrag flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-fg-dim hover:bg-hover hover:text-fg transition-colors"
        >
          <UndoIcon />
          Restore
        </button>
      ) : (
        <button
          onClick={onAddContextBlock}
          title="Add context block (B)"
          className="nodrag flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          + Context
        </button>
      )}
    </div>
  );
});
