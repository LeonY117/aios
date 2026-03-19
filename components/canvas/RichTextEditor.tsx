"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { InputRule } from "@tiptap/core";
import { useEffect, useRef } from "react";

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
  renderActions?: () => React.ReactNode;
};

/* ── Main editor ── */

export default function RichTextEditor({
  content,
  onChange,
  autoFocus = false,
  renderActions,
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
      Placeholder.configure({ placeholder: "Start writing..." }),
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

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom bar */}
      {renderActions && (
        <div className="flex h-[26px] shrink-0 items-center border-t border-gray-100 px-2">
          <div className="flex-1" />
          {renderActions()}
        </div>
      )}
    </div>
  );
}
