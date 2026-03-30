"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Extension, InputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";
import { useEffect, useRef } from "react";
import { clearPendingEditorFocus } from "@/lib/editor-focus-signal";

// Extend TaskItem: bare "[]" input rule + remove checkboxes from Tab order
const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    const parentNodeView = this.parent?.();
    if (!parentNodeView) return null;
    return (props: unknown) => {
      const result = parentNodeView(props as never);
      // Prevent Tab from focusing the checkbox
      const dom = (result as { dom?: Element | null }).dom;
      const cb =
        dom instanceof HTMLElement
          ? dom.querySelector('input[type="checkbox"]')
          : null;
      if (cb) (cb as HTMLElement).tabIndex = -1;
      return result;
    };
  },

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

/* ── List behaviour helpers ── */

function isInsideList($pos: ResolvedPos, listTypes: string[]): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    if (listTypes.includes($pos.node(d).type.name)) return true;
  }
  return false;
}

/**
 * Fixes list-editing bugs:
 * 1. Typing [] in a bullet (or - in a todo) converts the list type (single tx)
 * 2. Backspace on an empty list item lifts instead of undoing input rule / joining
 * 3. Tab inside a list never leaks focus to checkboxes (handleKeyDown)
 */
const ListBehaviorFix = Extension.create({
  name: "listBehaviorFix",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      // Backspace at start of a list item's first paragraph → lift out of list
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        if (!selection.empty || $from.parentOffset !== 0) return false;

        for (const itemType of ["listItem", "taskItem"] as const) {
          if (!editor.isActive(itemType)) continue;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name !== itemType) continue;
            // Only when cursor is in the item's first child (first paragraph)
            if ($from.index(depth) === 0) {
              return editor.commands.liftListItem(itemType);
            }
            break;
          }
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("listBehaviorFix"),
        props: {
          // Tab: use handleKeyDown so we intercept before any browser focus shift
          handleKeyDown(view, event) {
            if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) {
              return false;
            }
            const { $from } = view.state.selection;
            for (let d = $from.depth; d > 0; d--) {
              const name = $from.node(d).type.name;
              if (name === "taskItem" || name === "listItem") {
                if (event.shiftKey) {
                  editor.commands.liftListItem(name);
                } else {
                  editor.commands.sinkListItem(name);
                }
                return true; // always consume Tab inside a list
              }
            }
            return false;
          },

          // List-type conversion: intercept space after trigger patterns.
          // Only converts the current item (lift out, then toggle into new list type).
          handleTextInput(view, from, _to, text) {
            if (text !== " ") return false;

            const { state } = view;
            const $from = state.doc.resolve(from);
            const textBefore = state.doc.textBetween($from.start(), from, "\0", "\0");

            // [] / [ ] / [x] → convert current item to taskList if in bullet/ordered
            if (/^\s*\[([x ]?)\]$/.test(textBefore)) {
              if (isInsideList($from, ["bulletList", "orderedList"])) {
                editor
                  .chain()
                  .deleteRange({ from: $from.start(), to: from })
                  .liftListItem("listItem")
                  .toggleTaskList()
                  .run();
                return true;
              }
            }

            // - / + / * → convert current item to bulletList if in taskList
            if (/^\s*[-+*]$/.test(textBefore)) {
              if (isInsideList($from, ["taskList"])) {
                editor
                  .chain()
                  .deleteRange({ from: $from.start(), to: from })
                  .liftListItem("taskItem")
                  .toggleBulletList()
                  .run();
                return true;
              }
            }

            return false;
          },
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
  renderActions?: () => React.ReactNode;
};

/* ── Main editor ── */

export default function RichTextEditor({
  content,
  onChange,
  autoFocus = false,
  selected = false,
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
      ListBehaviorFix,
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

      {/* Bottom bar */}
      {renderActions && (
        <div className="flex h-[26px] shrink-0 items-center border-t border-line-subtle px-2">
          <div className="flex-1" />
          {renderActions()}
        </div>
      )}
    </div>
  );
}
