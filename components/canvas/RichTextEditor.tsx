"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { InputRule } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

// Extend TaskItem to also trigger on bare "[]" (not just "[ ]")
const CustomTaskItem = TaskItem.extend({
  addInputRules() {
    const parentRules = this.parent?.() ?? [];
    return [
      ...parentRules,
      new InputRule({
        find: /^\[]\s$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.deleteRange(range.from, range.to);
          const taskList = state.schema.nodes.taskList.create(null, [
            state.schema.nodes.taskItem.create({ checked: false }),
          ]);
          tr.replaceSelectionWith(taskList);
        },
      }),
    ];
  },
});

type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
  selected?: boolean;
};

/* ── Toolbar contents (inline, not floating) ── */

function ToolbarContent({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [headingOpen, setHeadingOpen] = useState(false);

  const btn = (
    active: boolean,
    onClick: () => void,
    children: React.ReactNode,
    title: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`nodrag rounded p-1 transition-colors ${
        active
          ? "bg-gray-200 text-gray-900"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        title="Close toolbar"
        className="nodrag rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="mx-0.5 h-3 w-px bg-gray-200" />

      {/* Heading dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setHeadingOpen(!headingOpen)}
          title="Heading"
          className={`nodrag flex items-center gap-0.5 rounded p-1 text-[11px] font-medium leading-none transition-colors ${
            editor.isActive("heading")
              ? "bg-gray-200 text-gray-900"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          H
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 3l3 3 3-3z" />
          </svg>
        </button>
        {headingOpen && (
          <div className="absolute bottom-full left-0 mb-1 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {([1, 2, 3] as const).map((level) => (
              <button
                key={level}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level }).run();
                  setHeadingOpen(false);
                }}
                className={`nodrag block w-full px-3 py-1 text-left text-[11px] leading-none transition-colors ${
                  editor.isActive("heading", { level })
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                H{level}
              </button>
            ))}
          </div>
        )}
      </div>

      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        <span className="flex h-3 items-center text-[11px] font-bold leading-none">B</span>,
        "Bold",
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <span className="flex h-3 items-center text-[11px] italic leading-none">I</span>,
        "Italic",
      )}
      {btn(
        editor.isActive("strike"),
        () => editor.chain().focus().toggleStrike().run(),
        <span className="flex h-3 items-center text-[11px] line-through leading-none">S</span>,
        "Strikethrough",
      )}
      {btn(
        editor.isActive("underline"),
        () => editor.chain().focus().toggleUnderline().run(),
        <span className="flex h-3 items-center text-[11px] underline leading-none">U</span>,
        "Underline",
      )}

      <div className="mx-0.5 h-3 w-px bg-gray-200" />

      {btn(
        editor.isActive("codeBlock"),
        () => editor.chain().focus().toggleCodeBlock().run(),
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>,
        "Code block",
      )}

      <div className="mx-0.5 h-3 w-px bg-gray-200" />

      {btn(
        editor.isActive("blockquote"),
        () => editor.chain().focus().toggleBlockquote().run(),
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>,
        "Blockquote",
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4" />
          <path d="M4 10h2" />
          <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </svg>,
        "Ordered list",
      )}
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>,
        "Bullet list",
      )}
      {btn(
        editor.isActive("taskList"),
        () => editor.chain().focus().toggleList("taskList", "taskItem").run(),
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="6" height="6" rx="1" />
          <path d="m3.5 15.5 2 2 4-4" />
          <line x1="13" y1="8" x2="21" y2="8" />
          <line x1="13" y1="16" x2="21" y2="16" />
        </svg>,
        "Todo list",
      )}

    </>
  );
}

/* ── Main editor ── */

export default function RichTextEditor({
  content,
  onChange,
  autoFocus = false,
  selected = false,
}: RichTextEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [hovered, setHovered] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      CustomTaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start typing..." }),
    ],
    content,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "nodrag nowheel prose prose-sm prose-gray max-w-none min-h-[60px] px-4 py-2 outline-none focus:outline-none leading-normal",
      },
      handleDOMEvents: {
        wheel: (_view, event) => {
          event.stopPropagation();
          return false;
        },
      },
    },
  });

  const toolbarVisible = selected && showToolbar;
  const showFormatBarHint = selected && hovered && !showToolbar;

  // Toggle toolbar on Cmd+/ or Ctrl+/
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShowToolbar((v) => !v);
      }
    };
    const el = editor.view.dom;
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Reserved bottom bar — always takes up space */}
      <div className="flex h-[26px] shrink-0 items-center border-t border-gray-100 px-2">
        {toolbarVisible ? (
          <div className="flex w-full items-center gap-0.5 animate-[fadeIn_150ms_ease-out]">
            <ToolbarContent
              editor={editor}
              onClose={() => setShowToolbar(false)}
            />
          </div>
        ) : showFormatBarHint ? (
          <div className="flex w-full justify-start animate-[fadeIn_150ms_ease-out]">
            <button
              type="button"
              onClick={() => setShowToolbar(true)}
              title="Show formatting toolbar (⌘/)"
              className="nodrag rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
