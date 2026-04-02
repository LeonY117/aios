"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { clearPendingEditorFocus } from "@/lib/editor-focus-signal";
import { CustomTaskItem, ListBehaviorFix } from "./list-extensions";

// TODO(2026-07-01): Remove this once all users have opened their sessions at least once.
// After that date, all content files will have been auto-converted to markdown on first edit.
const IS_HTML = /^<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div)\b/i;

/**
 * Normalize markdown to preserve blank lines that would otherwise be lost
 * during parsing. The @tiptap/markdown parser drops empty paragraphs in
 * heading→paragraph and list→list transitions. We fix this by inserting
 * explicit `&nbsp;` paragraph markers for every extra blank line.
 */
function preserveBlankLines(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks — don't modify inside them
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Detect sequences of 3+ blank lines in a row (indicating empty paragraphs).
    // A normal paragraph break = 1 blank line = 2 consecutive \n.
    // Each additional blank line = 1 empty paragraph.
    // We replace extra blank lines with &nbsp; so the parser preserves them.
    if (
      line === "" &&
      result.length > 0 &&
      result[result.length - 1] === "" &&
      i + 1 < lines.length &&
      lines[i + 1] === ""
    ) {
      // This is a third-or-more consecutive empty line — insert &nbsp;
      result.push("&nbsp;");
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

type RichTextEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
  autoFocus?: boolean;
  selected?: boolean;
  onEditor?: (editor: Editor | null) => void;
};

/* ── Main editor ── */

export default function RichTextEditor({
  content,
  onChange,
  autoFocus = false,
  selected = false,
  onEditor,
}: RichTextEditorProps) {
  const isHtml = IS_HTML.test((content ?? "").trim());
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onEditorRef = useRef(onEditor);
  useEffect(() => {
    onEditorRef.current = onEditor;
  }, [onEditor]);

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
    content: isHtml ? content : preserveBlankLines(content ?? ""),
    contentType: isHtml ? "html" : "markdown",
    autofocus: autoFocus ? "end" : false,
    onCreate: ({ editor: e }) => {
      onEditorRef.current?.(e);
    },
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
