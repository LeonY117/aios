"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useRef } from "react";
import { clearPendingEditorFocus } from "@/lib/editor-focus-signal";
import { CustomTaskItem, ListBehaviorFix } from "./list-extensions";

// TODO(2026-07-01): Remove this once all users have opened their sessions at least once.
// After that date, all content files will have been auto-converted to markdown on first edit.
const IS_HTML = /^<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div)\b/i;

type RichTextEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
  autoFocus?: boolean;
  selected?: boolean;
};

/* ── Main editor ── */

export default function RichTextEditor({
  content,
  onChange,
  autoFocus = false,
  selected = false,
}: RichTextEditorProps) {
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
      ListBehaviorFix,
      Placeholder.configure({ placeholder: "Start writing..." }),
      Markdown,
    ],
    content,
    contentType: IS_HTML.test(content.trim()) ? "html" : "markdown",
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getMarkdown());
    },
    editorProps: {
      attributes: {
        class:
          "nodrag nokey prose prose-sm max-w-none min-h-[60px] px-4 py-2 outline-none focus:outline-none leading-normal",
      },
      clipboardTextSerializer: (slice) => {
        const texts: string[] = [];
        slice.content.forEach((node) => {
          texts.push(node.textContent);
        });
        return texts.join("\n");
      },
    },
  });

  // Safety net: ensure focus when autoFocus is set (Tiptap's autofocus can be unreliable with async React Flow rendering)
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus("end");
      clearPendingEditorFocus();
    }
  }, [autoFocus, editor]);

  if (!editor) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`min-h-0 flex-1 overflow-y-auto ${selected ? "nowheel" : ""}`}>
        <div className="mx-auto max-w-xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
