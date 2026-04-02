"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { SessionEntry } from "@/lib/persistence";
import {
  ChevronDownIcon,
  FolderIcon,
  RenameIcon,
  ArchiveBoxIcon,
  DeleteIcon,
  CurvedArrowIcon,
  MoreDotsIcon,
} from "@/components/icons";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

type WorkspaceSidebarProps = {
  currentSession: string;
  onSwitch: (name: string) => void;
  onCreated: (name: string) => void;
  onDeleted: (name: string) => void;
  onRenamed: (oldName: string, newName: string) => void;
  onArchived: (name: string, archived: boolean) => void;
};

// ── Recency bucketing ────────────────────────────────────────

function makeRecencyBucketer() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);
  const startOf30Days = new Date(startOfToday.getTime() - 29 * 86400000);

  return (iso: string): string => {
    const d = new Date(iso);
    if (d >= startOfToday) return "Today";
    if (d >= startOfYesterday) return "Yesterday";
    if (d >= startOfWeek) return "Past Week";
    if (d >= startOf30Days) return "Past 30 Days";
    return "Older";
  };
}

const SECTION_ORDER = ["Today", "Yesterday", "Past Week", "Past 30 Days", "Older"];

export default function WorkspaceSidebar({
  currentSession,
  onSwitch,
  onCreated,
  onDeleted,
  onRenamed,
  onArchived,
}: WorkspaceSidebarProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const archivedRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/session/list", { cache: "no-store" });
    const { sessions: list }: { sessions: SessionEntry[] } = await res.json();
    setSessions(list);
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSessions();
    }
  }, [open, currentSession, fetchSessions]);

  // Focus inputs when shown
  useEffect(() => {
    if (renamingSession) renameInputRef.current?.focus();
  }, [renamingSession]);
  useEffect(() => {
    if (showNewDialog) newInputRef.current?.focus();
  }, [showNewDialog]);

  const closeArchived = useCallback(() => setShowArchived(false), []);
  const closeMenu = useCallback(() => setMenuOpenFor(null), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  useClickOutside(archivedRef, closeArchived, showArchived);
  useClickOutside(menuRef, closeMenu, !!menuOpenFor);
  useClickOutside(sidebarRef, closeSidebar, open && !deletingSession && !showNewDialog);

  const sessionNames = useMemo(() => sessions.map((s) => s.name), [sessions]);
  const activeSessions = useMemo(() => sessions.filter((s) => !s.archived), [sessions]);
  const archivedSessions = useMemo(() => sessions.filter((s) => s.archived), [sessions]);

  // Group active sessions by recency
  const groupedSessions = useMemo(() => {
    const bucket = makeRecencyBucketer();
    const groups = new Map<string, SessionEntry[]>();
    for (const s of activeSessions) {
      const key = bucket(s.updatedAt);
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    return SECTION_ORDER
      .filter((key) => groups.has(key))
      .map((key) => ({ label: key, sessions: groups.get(key)! }));
  }, [activeSessions]);

  const isInvalidName = (name: string) =>
    !name || name === "." || name === ".." || name.includes("/");

  const handleCreate = () => {
    const name = newName.trim();
    if (isInvalidName(name) || sessionNames.includes(name)) return;
    setShowNewDialog(false);
    setNewName("");
    onCreated(name);
    const now = new Date().toISOString();
    setSessions((s) => [{ name, createdAt: now, updatedAt: now, archived: false }, ...s]);
  };

  const handleDelete = (name: string) => {
    const isArchived = sessions.find((s) => s.name === name)?.archived;
    if (!isArchived && activeSessions.length <= 1) return;
    setMenuOpenFor(null);
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

  const handleArchive = (name: string) => {
    setMenuOpenFor(null);
    onArchived(name, true);
    setSessions((s) =>
      s.map((e) => (e.name === name ? { ...e, archived: true } : e)),
    );
  };

  const handleUnarchive = (name: string) => {
    onArchived(name, false);
    setSessions((s) =>
      s.map((e) => (e.name === name ? { ...e, archived: false } : e)),
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

  const renderSessionItem = ({ name, archived: isArchived, emoji }: SessionEntry) => (
    <div
      key={name}
      className={`group flex items-center h-8 px-3 !cursor-pointer text-sm transition-colors ${
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
            className="flex-1 min-w-0 truncate text-left flex items-center gap-1.5"
          >
            {emoji ? (
              <span className="text-base shrink-0">{emoji}</span>
            ) : (
              <FolderIcon width={12} height={12} className="shrink-0 text-fg-faint" />
            )}
            <span className="truncate">{name}</span>
          </button>
          {isArchived ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnarchive(name);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-[5px] text-fg-faint hover:text-accent hover:bg-surface-alt transition-colors invisible group-hover:visible"
              title="Restore"
            >
              <CurvedArrowIcon />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenFor(menuOpenFor === name ? null : name);
                }}
                className={`flex items-center justify-center w-6 h-6 rounded-[5px] text-fg-muted hover:text-fg-dim hover:bg-hover transition-colors ${
                  menuOpenFor === name ? "visible" : "invisible group-hover:visible"
                }`}
                title="More"
              >
                <MoreDotsIcon />
              </button>
              {menuOpenFor === name && (
                <div
                  ref={menuRef}
                  className="absolute top-full right-0 w-[148px] bg-surface border border-line rounded-lg shadow-lg p-1 z-10"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenFor(null);
                      setRenamingSession(name);
                      setRenameValue(name);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-[5px] text-sm text-fg-dim hover:bg-hover transition-colors"
                  >
                    <RenameIcon />
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchive(name);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-[5px] text-sm text-fg-dim hover:bg-hover transition-colors"
                  >
                    <ArchiveBoxIcon />
                    Archive
                  </button>
                  <div className="h-px bg-line-subtle my-1 mx-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(name);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-[5px] text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <DeleteIcon />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <div ref={sidebarRef} className="absolute top-0 left-0 z-50 flex h-full w-52 flex-col border-r border-line bg-surface/95 backdrop-blur-sm shadow-lg !cursor-default [&_button]:!cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-line-subtle">
          <span className="text-sm text-fg-muted">
            Workspaces
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-6 h-6 rounded-[5px] text-fg-muted hover:text-fg-dim hover:bg-hover transition-colors"
            title="Close (Cmd+B)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            >
              <path d="M12 4L4 12M4 4l8 8" />
            </svg>
          </button>
        </div>

        {/* New workspace */}
        <button
          onClick={() => setShowNewDialog(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-fg-muted hover:text-fg-dim hover:bg-surface-alt transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          New workspace
        </button>

        {/* Active sessions grouped by recency */}
        <div className="flex-1 overflow-y-auto">
          {groupedSessions.map(({ label, sessions: group }, gi) => (
            <div key={label} className={gi > 0 ? "mt-1 border-t border-line-subtle" : ""}>
              <div className="text-[11px] uppercase tracking-wider text-fg-faint px-3 pt-2 pb-1">
                {label}
              </div>
              {group.map((session) => renderSessionItem(session))}
            </div>
          ))}
        </div>

        {/* Archived section */}
        {archivedSessions.length > 0 && (
          <div ref={archivedRef} className="border-t border-line-subtle">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex w-full items-center gap-1.5 h-8 px-3 text-sm text-fg-muted hover:text-fg-dim transition-colors"
            >
              <ChevronDownIcon className={`transition-transform ${showArchived ? "" : "-rotate-90"}`} />
              Archived ({archivedSessions.length})
            </button>
            {showArchived && (
              <div className="max-h-40 overflow-y-auto pb-1">
                {archivedSessions.map((session) => renderSessionItem(session))}
              </div>
            )}
          </div>
        )}
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
