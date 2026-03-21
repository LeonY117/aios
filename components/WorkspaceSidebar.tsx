"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/session/list");
    const { sessions: list } = await res.json();
    setSessions(list.length > 0 ? list : ["default"]);
  }, []);

  useEffect(() => {
    // This is a mount-time load from an external system (the API).
    // The eslint rule here is overly strict for async data fetching, so we
    // explicitly allow it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessions();
  }, [fetchSessions]);

  // Sidebar toggle — avoid Cmd+B as it conflicts with bold in text editor

  // Focus inputs when shown
  useEffect(() => {
    if (renamingSession) renameInputRef.current?.focus();
  }, [renamingSession]);
  useEffect(() => {
    if (showNewDialog) newInputRef.current?.focus();
  }, [showNewDialog]);

  const isInvalidName = (name: string) =>
    !name || name === "." || name === ".." || name.includes("/");

  const handleCreate = () => {
    const name = newName.trim();
    if (isInvalidName(name) || sessions.includes(name)) return;
    setShowNewDialog(false);
    setNewName("");
    onCreated(name);
    setSessions((s) => [...s, name].sort());
  };

  const handleDelete = (name: string) => {
    if (sessions.length <= 1) return;
    setDeletingSession(name);
  };

  const confirmDelete = () => {
    if (!deletingSession) return;
    onDeleted(deletingSession);
    setSessions((s) => s.filter((n) => n !== deletingSession));
    setDeletingSession(null);
  };

  const handleRename = (oldName: string) => {
    const name = renameValue.trim();
    if (isInvalidName(name) || name === oldName || sessions.includes(name)) {
      setRenamingSession(null);
      return;
    }
    setRenamingSession(null);
    onRenamed(oldName, name);
    setSessions((s) => s.map((n) => (n === oldName ? name : n)).sort());
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 left-3 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-white/80 text-slate-500 shadow-sm border border-slate-200 hover:bg-white hover:text-slate-700 transition-colors"
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
      <div className="absolute top-0 left-0 z-50 flex h-full w-52 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-sm shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspaces
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
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
          {sessions.map((name) => (
            <div
              key={name}
              className={`group flex items-center gap-1 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                name === currentSession
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
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
                  className="flex-1 min-w-0 rounded border border-indigo-300 px-1.5 py-0.5 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
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
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
                        className="rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
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

        {/* New workspace button */}
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            onClick={() => setShowNewDialog(true)}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            + New workspace
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deletingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="w-80 rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Delete Workspace
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <span className="font-medium text-slate-700">{deletingSession}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingSession(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="w-80 rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewDialog(false);
                  setNewName("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
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
