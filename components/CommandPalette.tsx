"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type { SessionEntry } from "@/lib/persistence";
import { ArchiveBoxIcon, DeleteIcon, FolderIcon, RenameIcon } from "@/components/icons";
import { useTheme, themeList } from "@/lib/themes";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  currentSession: string;
  onSwitchWorkspace: (name: string) => void;
  onCreateWorkspace: (name: string) => void;
  onAddTextBlock: () => void;
  onAddChatNode: () => void;
  onAddLinkNode: () => void;
  onAddContextBlock: () => void;
  onAddFile: () => void;
  onArchiveWorkspace: (name: string, archived: boolean) => void;
  onDeleteWorkspace: (name: string) => void;
  onRenameWorkspace: (oldName: string, newName: string) => void;
};

type View = "main" | "theme" | "shortcuts" | "create" | "rename" | "confirm-delete";

type PaletteItem = {
  id: string;
  type: "workspace" | "action" | "setting";
  title: string;
  meta?: string;
  section: string;
  icon: React.ReactNode;
  badge?: string;
  shortcutKeys?: string[];
  chevron?: boolean;
  onSelect: () => void;
};

// ── Icons ─────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const TextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 6.1H3" /><path d="M21 12.1H3" /><path d="M15.1 18H3" />
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const KeyboardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
  </svg>
);

const BackIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Compute recency boundaries once, then bucket each timestamp. */
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

// ── Component ────────────────────────────────────────────────

export default function CommandPalette({
  open,
  onClose,
  currentSession,
  onSwitchWorkspace,
  onCreateWorkspace,
  onAddTextBlock,
  onAddChatNode,
  onAddLinkNode,
  onAddContextBlock,
  onAddFile,
  onArchiveWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
}: CommandPaletteProps) {
  const { themeId, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("main");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state and fetch sessions when palette opens
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on open
    setQuery("");
    setView("main");
    setSelectedIndex(0);
    setNewName("");
    fetch("/api/session/list")
      .then((r) => r.json())
      .then(({ sessions: list }: { sessions: SessionEntry[] }) => setSessions(list));
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, view]);

  // ── Build items ──────────────────────────────────────────

  const items: PaletteItem[] = useMemo(() => {
    if (view !== "main") return [];

    const recencyBucket = makeRecencyBucketer();
    const workspaceItems: PaletteItem[] = sessions.map((s) => ({
      id: `ws-${s.name}`,
      type: "workspace",
      title: s.name,
      meta: `Edited ${timeAgo(s.updatedAt)}`,
      section: recencyBucket(s.updatedAt),
      icon: s.emoji ? <span className="text-xl">{s.emoji}</span> : <FolderIcon />,
      badge: s.name === currentSession ? "Current" : undefined,
      onSelect: () => {
        if (s.name !== currentSession) {
          onSwitchWorkspace(s.name);
        }
        onClose();
      },
    }));

    const actionItems: PaletteItem[] = [
      { id: "add-text", title: "Add Text Block", shortcutKeys: ["T"], icon: <TextIcon />, onSelect: () => { onAddTextBlock(); onClose(); } },
      { id: "add-chat", title: "Add Chat Window", shortcutKeys: ["C"], icon: <ChatIcon />, onSelect: () => { onAddChatNode(); onClose(); } },
      { id: "add-link", title: "Add Link", shortcutKeys: ["L"], icon: <LinkIcon />, onSelect: () => { onAddLinkNode(); onClose(); } },
      { id: "add-context", title: "Add Context Block", shortcutKeys: ["B"], icon: <GridIcon />, onSelect: () => { onAddContextBlock(); onClose(); } },
      { id: "add-file", title: "Upload File", icon: <FileIcon />, onSelect: () => { onAddFile(); onClose(); } },
    ].map((a) => ({ ...a, type: "action" as const, section: "Canvas Actions" }));

    const workspaceActionItems: PaletteItem[] = [
      {
        id: "new-workspace",
        type: "action",
        title: "New Workspace",
        section: "Workspace",
        icon: <PlusCircleIcon />,
        onSelect: () => { setView("create"); setNewName(""); },
      },
      {
        id: "archive-workspace",
        type: "action",
        title: "Archive Current Workspace",
        meta: currentSession,
        section: "Workspace",
        icon: <ArchiveBoxIcon width={14} height={14} />,
        onSelect: () => { onArchiveWorkspace(currentSession, true); onClose(); },
      },
      {
        id: "rename-workspace",
        type: "action",
        title: "Rename Current Workspace",
        meta: currentSession,
        section: "Workspace",
        icon: <RenameIcon width={14} height={14} />,
        chevron: true,
        onSelect: () => { setView("rename"); setNewName(currentSession); setSelectedIndex(0); },
      },
      {
        id: "delete-workspace",
        type: "action",
        title: "Delete Current Workspace",
        meta: currentSession,
        section: "Workspace",
        icon: <DeleteIcon width={14} height={14} />,
        chevron: true,
        onSelect: () => { setView("confirm-delete"); setSelectedIndex(0); },
      },
    ];

    const settingItems: PaletteItem[] = [
      {
        id: "theme",
        type: "setting",
        title: "Change Theme",
        meta: themeId === "system" ? "System" : themeList.find((t) => t.id === themeId)?.name ?? themeId,
        section: "Settings",
        icon: <SunIcon />,
        chevron: true,
        onSelect: () => { setView("theme"); setQuery(""); setSelectedIndex(0); },
      },
      {
        id: "shortcuts",
        type: "setting",
        title: "Keyboard Shortcuts",
        section: "Settings",
        icon: <KeyboardIcon />,
        chevron: true,
        onSelect: () => { setView("shortcuts"); setQuery(""); setSelectedIndex(0); },
      },
    ];

    return [...workspaceItems, ...actionItems, ...workspaceActionItems, ...settingItems];
  }, [view, sessions, currentSession, themeId, onSwitchWorkspace, onClose, onAddTextBlock, onAddChatNode, onAddLinkNode, onAddContextBlock, onAddFile, onArchiveWorkspace, onDeleteWorkspace, onRenameWorkspace]);

  // ── Filter items ─────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.meta?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  // Clamp selected index when list shrinks
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex((i) => Math.min(i, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  // ── Sections ─────────────────────────────────────────────

  const sections = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return map;
  }, [filteredItems]);

  // ── Theme items ──────────────────────────────────────────

  const themeItems = useMemo(() => {
    const q = query.toLowerCase();
    const all = [
      { id: "system", name: "System", type: "auto" as const, canvasBg: "#ffffff", accentBg: "#0f172a" },
      ...themeList.map((t) => ({ id: t.id, name: t.name, type: t.type, canvasBg: t.colors.canvas, accentBg: t.colors.accent })),
    ];
    if (!q) return all;
    return all.filter((t) => t.name.toLowerCase().includes(q));
  }, [query]);

  // ── Keyboard ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "main") {
          setView("main");
          setQuery("");
          setSelectedIndex(0);
        } else {
          onClose();
        }
        return;
      }

      if (view === "shortcuts" || view === "confirm-delete") return;

      if (view === "create") {
        if (e.key === "Enter" && newName.trim()) {
          onCreateWorkspace(newName.trim());
          onClose();
        }
        return;
      }

      if (view === "rename") {
        if (e.key === "Enter" && newName.trim() && newName.trim() !== currentSession) {
          onRenameWorkspace(currentSession, newName.trim());
          onClose();
        }
        return;
      }

      const maxIndex = view === "theme" ? themeItems.length - 1 : filteredItems.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (view === "theme") {
          const t = themeItems[selectedIndex];
          if (t) setTheme(t.id);
        } else {
          filteredItems[selectedIndex]?.onSelect();
        }
      }
    },
    [view, filteredItems, themeItems, selectedIndex, onClose, setTheme, newName, onCreateWorkspace, onRenameWorkspace, currentSession],
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-[560px] max-h-[480px] bg-surface border border-line rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Search bar */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-line shrink-0">
          <span className="text-fg-muted shrink-0"><SearchIcon /></span>
          <input
            ref={inputRef}
            value={view === "create" || view === "rename" ? newName : query}
            onChange={(e) => {
              if (view === "create" || view === "rename") {
                setNewName(e.target.value);
              } else {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }
            }}
            placeholder={
              view === "create"
                ? "Workspace name..."
                : view === "rename"
                  ? "New workspace name..."
                  : view === "theme"
                    ? "Filter themes..."
                  : "Search workspaces, actions, settings..."
            }
            className="flex-1 bg-transparent border-none outline-none text-fg text-[15px] placeholder:text-fg-muted"
          />
        </div>

        {/* Content area */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">

          {/* ─ Main view ─ */}
          {view === "main" && (
            <>
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-fg-muted text-sm">
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}
              {[...sections.entries()].map(([section, sectionItems]) => {
                // Compute flat index offset for this section
                let offset = 0;
                for (const [s, list] of sections) {
                  if (s === section) break;
                  offset += list.length;
                }
                return (
                  <div key={section}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted px-2.5 pt-2.5 pb-1">
                      {section}
                    </div>
                    {sectionItems.map((item, i) => {
                      const flatIndex = offset + i;
                      return (
                        <button
                          key={item.id}
                          data-selected={flatIndex === selectedIndex}
                          onClick={item.onSelect}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-left ${
                            flatIndex === selectedIndex ? "bg-accent-surface/60" : "hover:bg-hover"
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-sm -ml-0.5 ${
                              item.type === "action"
                                ? "bg-accent-surface border border-accent-line text-accent"
                                : item.type === "setting"
                                  ? "bg-surface-alt border border-line text-fg-dim"
                                  : "text-fg-muted"
                            }`}
                          >
                            {item.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-fg truncate">{item.title}</div>
                            {item.meta && <div className="text-xs text-fg-muted truncate">{item.meta}</div>}
                          </div>
                          {item.badge && (
                            <span className="text-[10px] font-semibold text-accent bg-accent-surface border border-accent-line rounded px-1.5 py-0.5 shrink-0">
                              {item.badge}
                            </span>
                          )}
                          {item.shortcutKeys && (
                            <span className="flex gap-0.5 shrink-0">
                              {item.shortcutKeys.map((k) => (
                                <kbd key={k} className="text-[11px] text-fg-muted bg-surface-alt border border-line rounded px-1.5 py-0.5">{k}</kbd>
                              ))}
                            </span>
                          )}
                          {item.chevron && (
                            <span className="text-fg-muted text-sm">&#8250;</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* ─ Theme view ─ */}
          {view === "theme" && (
            <>
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
                <button
                  onClick={() => { setView("main"); setQuery(""); setSelectedIndex(0); }}
                  className="flex items-center gap-1 text-xs text-fg-muted px-2 py-1 rounded-md hover:bg-hover hover:text-fg transition-colors"
                >
                  <BackIcon /> Back
                </button>
                <span className="text-[13px] font-semibold text-fg-dim">Theme</span>
              </div>
              {themeItems.map((t, i) => (
                <button
                  key={t.id}
                  data-selected={i === selectedIndex}
                  onClick={() => setTheme(t.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                    i === selectedIndex ? "bg-accent-surface/60" : "hover:bg-hover"
                  }`}
                >
                  <span className="w-7 h-7 rounded-md border border-line overflow-hidden flex shrink-0">
                    <span className="w-1/2 h-full" style={{ backgroundColor: t.canvasBg }} />
                    <span className="w-1/2 h-full" style={{ backgroundColor: t.accentBg }} />
                  </span>
                  <span className="flex-1 text-sm text-fg">{t.name}</span>
                  <span className="text-[10px] text-fg-muted bg-surface-alt border border-line rounded px-1.5 py-0.5">{t.type}</span>
                  {themeId === t.id && <span className="text-accent text-sm">✓</span>}
                </button>
              ))}
            </>
          )}

          {/* ─ Shortcuts view ─ */}
          {view === "shortcuts" && (
            <>
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
                <button
                  onClick={() => { setView("main"); setQuery(""); setSelectedIndex(0); }}
                  className="flex items-center gap-1 text-xs text-fg-muted px-2 py-1 rounded-md hover:bg-hover hover:text-fg transition-colors"
                >
                  <BackIcon /> Back
                </button>
                <span className="text-[13px] font-semibold text-fg-dim">Keyboard Shortcuts</span>
              </div>

              <ShortcutSection title="Canvas" shortcuts={[
                ["Add Text Block", ["T"]],
                ["Add Chat", ["C"]],
                ["Add Link", ["L"]],
                ["Add Context Block", ["B"]],
              ]} />
              <ShortcutSection title="Navigation" shortcuts={[
                ["Command Palette", ["⌘", "K"]],
                ["Save", ["⌘", "S"]],
                ["Select All SOTs", ["⌘", "A"]],
                ["Pan Canvas", ["Space"]],
              ]} />
              <ShortcutSection title="Chat" shortcuts={[
                ["Send Message", ["⏎"]],
                ["New Line", ["⇧", "⏎"]],
              ]} />
            </>
          )}

          {/* ─ Create workspace view ─ */}
          {view === "create" && (
            <div className="px-4 py-6">
              <p className="text-sm text-fg-dim mb-4">Enter a name for the new workspace:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setView("main"); setQuery(""); }}
                  className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newName.trim()) {
                      onCreateWorkspace(newName.trim());
                      onClose();
                    }
                  }}
                  disabled={!newName.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* ─ Rename workspace view ─ */}
          {view === "rename" && (
            <div className="px-4 py-6">
              <p className="text-sm text-fg-dim mb-4">Rename &ldquo;{currentSession}&rdquo; to:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setView("main"); setQuery(""); }}
                  className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newName.trim() && newName.trim() !== currentSession) {
                      onRenameWorkspace(currentSession, newName.trim());
                      onClose();
                    }
                  }}
                  disabled={!newName.trim() || newName.trim() === currentSession}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
                >
                  Rename
                </button>
              </div>
            </div>
          )}

          {/* ─ Confirm delete view ─ */}
          {view === "confirm-delete" && (
            <div className="px-4 py-6">
              <p className="text-sm text-fg-dim mb-4">
                Are you sure you want to delete <span className="font-medium text-fg">&ldquo;{currentSession}&rdquo;</span>? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setView("main"); setQuery(""); }}
                  className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onDeleteWorkspace(currentSession); onClose(); }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center px-3.5 py-2 border-t border-line shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-fg-faint">
            <kbd className="bg-surface-alt border border-line rounded px-1 py-px text-[10px] text-fg-muted">⌘</kbd>
            <kbd className="bg-surface-alt border border-line rounded px-1 py-px text-[10px] text-fg-muted">⏎</kbd>
            Open in new tab
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Shortcut section sub-component ───────────────────────────

function ShortcutSection({ title, shortcuts }: { title: string; shortcuts: [string, string[]][] }) {
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted px-2.5 pt-2.5 pb-1">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-2.5">
        {shortcuts.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between py-1.5 px-2 rounded-md">
            <span className="text-[13px] text-fg-dim">{label}</span>
            <span className="flex gap-0.5">
              {keys.map((k, i) => (
                <kbd key={i} className="bg-surface-alt border border-line rounded px-1.5 py-0.5 text-[11px] text-fg-muted min-w-[22px] text-center">
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
