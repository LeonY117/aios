"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionEntry } from "@/lib/persistence";
import { useTheme, themeList } from "@/lib/themes";
import { ChevronDownIcon } from "@/components/icons";

type WorkspaceSidebarProps = {
  currentSession: string;
  onSwitch: (name: string) => void;
  onCreated: (name: string) => void;
  onDeleted: (name: string) => void;
  onRenamed: (oldName: string, newName: string) => void;
};

export default function WorkspaceSidebar({
  currentSession,
  onSwitch,
  onCreated,
  onDeleted,
  onRenamed,
}: WorkspaceSidebarProps) {
  const { themeId, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [themeOpen, setThemeOpen] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/session/list");
    const { sessions: list }: { sessions: SessionEntry[] } = await res.json();
    setSessions(list);
  }, []);

  useEffect(() => {
    // Re-fetch session list each time sidebar opens so sort order is fresh
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSessions();
    }
  }, [open, currentSession, fetchSessions]);

  // Sidebar toggle — avoid Cmd+B as it conflicts with bold in text editor

  // Focus inputs when shown
  useEffect(() => {
    if (renamingSession) renameInputRef.current?.focus();
  }, [renamingSession]);
  useEffect(() => {
    if (showNewDialog) newInputRef.current?.focus();
  }, [showNewDialog]);

  const sessionNames = sessions.map((s) => s.name);

  const isInvalidName = (name: string) =>
    !name || name === "." || name === ".." || name.includes("/");

  const handleCreate = () => {
    const name = newName.trim();
    if (isInvalidName(name) || sessionNames.includes(name)) return;
    setShowNewDialog(false);
    setNewName("");
    onCreated(name);
    // Newest first — prepend
    const now = new Date().toISOString();
    setSessions((s) => [{ name, createdAt: now, updatedAt: now }, ...s]);
  };

  const handleDelete = (name: string) => {
    if (sessions.length <= 1) return;
    setDeletingSession(name);
  };

  const confirmDelete = () => {
    if (!deletingSession) return;
    onDeleted(deletingSession);
    setSessions((s) => s.filter((e) => e.name !== deletingSession));
    setDeletingSession(null);
  };

  const handleRename = (oldName: string) => {
    const name = renameValue.trim();
    if (isInvalidName(name) || name === oldName || sessionNames.includes(name)) {
      setRenamingSession(null);
      return;
    }
    setRenamingSession(null);
    onRenamed(oldName, name);
    setSessions((s) =>
      s.map((e) => (e.name === oldName ? { ...e, name } : e)),
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 left-3 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-surface/80 text-fg-muted shadow-sm border border-line hover:bg-surface hover:text-fg transition-colors"
        title="Open workspaces (Cmd+B)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 4h10M3 8h10M3 12h10" />
        </svg>
      </button>
    );
  }

  return (
    <>
      <div className="absolute top-0 left-0 z-50 flex h-full w-52 flex-col border-r border-line bg-surface/95 backdrop-blur-sm shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-line-subtle">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Workspaces
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-fg-muted hover:text-fg-dim transition-colors"
            title="Close (Cmd+B)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M10 4L4 10M4 4l6 6" />
            </svg>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-1">
          {sessions.map(({ name }) => (
            <div
              key={name}
              className={`group flex items-center gap-1 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                name === currentSession
                  ? "bg-accent-surface text-accent font-medium"
                  : "text-fg-dim hover:bg-surface-alt"
              }`}
            >
              {renamingSession === name ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(name);
                    if (e.key === "Escape") setRenamingSession(null);
                  }}
                  onBlur={() => handleRename(name)}
                  className="flex-1 min-w-0 rounded border border-accent-line bg-transparent px-1.5 py-0.5 text-sm text-fg outline-none focus:ring-1 focus:ring-accent"
                />
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (name !== currentSession) onSwitch(name);
                    }}
                    className="flex-1 min-w-0 truncate text-left"
                  >
                    {name}
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingSession(name);
                        setRenameValue(name);
                      }}
                      className="rounded p-0.5 text-fg-muted hover:text-fg-dim hover:bg-hover"
                      title="Rename"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8.5 1.5l2 2M1 11l.5-2L8.5 2l2 2-7 7-2 .5z" />
                      </svg>
                    </button>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(name);
                        }}
                        className="rounded p-0.5 text-fg-muted hover:text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 3h8M4.5 3V2h3v1M3 3v7.5h6V3M5 5.5v3M7 5.5v3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Theme picker */}
        <div className="border-t border-line-subtle px-3 py-2">
          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-alt hover:text-fg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Theme
            <ChevronDownIcon className={`ml-auto transition-transform ${themeOpen ? "rotate-180" : ""}`} />
          </button>
          {themeOpen && (
            <div className="mt-1 flex flex-col gap-0.5">
              {/* System option */}
              <button
                onClick={() => setTheme("system")}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  themeId === "system"
                    ? "bg-accent-surface text-accent font-medium"
                    : "text-fg-dim hover:bg-surface-alt"
                }`}
              >
                <span className="flex gap-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-900 border border-gray-700" />
                </span>
                System
              </button>
              {themeList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    themeId === t.id
                      ? "bg-accent-surface text-accent font-medium"
                      : "text-fg-dim hover:bg-surface-alt"
                  }`}
                >
                  <span className="flex gap-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10"
                      style={{ backgroundColor: t.colors.canvas }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10"
                      style={{ backgroundColor: t.colors.accent }}
                    />
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New workspace button */}
        <div className="border-t border-line-subtle px-3 py-2">
          <button
            onClick={() => setShowNewDialog(true)}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-alt hover:text-fg transition-colors"
          >
            + New workspace
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deletingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-surface p-5 shadow-2xl border border-line">
            <h3 className="text-sm font-semibold text-fg mb-2">
              Delete Workspace
            </h3>
            <p className="text-sm text-fg-muted mb-4">
              Are you sure you want to delete <span className="font-medium text-fg">{deletingSession}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingSession(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New workspace dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-surface p-5 shadow-2xl border border-line">
            <h3 className="text-sm font-semibold text-fg mb-3">
              New Workspace
            </h3>
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowNewDialog(false);
                  setNewName("");
                }
              }}
              placeholder="Workspace name"
              className="w-full rounded-lg border border-line-hover bg-transparent px-3 py-2 text-sm text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewDialog(false);
                  setNewName("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
