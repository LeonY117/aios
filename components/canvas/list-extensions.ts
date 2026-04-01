/**
 * Tiptap extensions for list behaviour — Tab/Shift-Tab indentation,
 * Backspace lifting, and in-place list-type conversion.
 *
 * Pure ProseMirror / Tiptap — no React dependency so tests can import directly.
 */

import { Extension, InputRule, type Editor } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import {
  Plugin,
  PluginKey,
  Selection,
  type Transaction,
} from "@tiptap/pm/state";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { canJoin } from "@tiptap/pm/transform";

/* ── Constants & predicates ────────────────────────────────── */

const LIST_TYPES = ["bulletList", "orderedList", "taskList"] as const;
const ITEM_TYPES = ["taskItem", "listItem"] as const;

const isListType = (n: string): boolean =>
  (LIST_TYPES as readonly string[]).includes(n);
const isItemType = (n: string): boolean =>
  (ITEM_TYPES as readonly string[]).includes(n);

/* ── Depth-walking helpers ─────────────────────────────────── */

/** Innermost list-item type name at the cursor, or null. */
export function findListItem($from: ResolvedPos): string | null {
  for (let d = $from.depth; d > 0; d--) {
    if (isItemType($from.node(d).type.name)) return $from.node(d).type.name;
  }
  return null;
}

/** Depth of the innermost list wrapper at the cursor, or -1. */
function findListDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d > 0; d--) {
    if (isListType($from.node(d).type.name)) return d;
  }
  return -1;
}

/* ── Tab: sink into the list above ─────────────────────────── */

/**
 * When the standard sinkListItem fails (first item in its list),
 * try to move the current list into the previous list's last item.
 *
 * Same-type lists  → join then sink (single transaction).
 * Cross-type lists → nest a copy inside the previous item, delete the original.
 */
function sinkIntoListAbove(editor: Editor): boolean {
  const { state } = editor;
  const { $from } = state.selection;

  const listDepth = findListDepth($from);
  if (listDepth <= 0) return false;

  const listStart = $from.before(listDepth);
  const listEnd = $from.after(listDepth);
  const currentList = $from.node(listDepth);

  if (listStart === 0) return false;

  const nodeBefore = state.doc.resolve(listStart).nodeBefore;
  if (!nodeBefore || !isListType(nodeBefore.type.name)) return false;

  // Same-type: join into one list, then sink — single transaction for clean undo
  if (canJoin(state.doc, listStart)) {
    const tr = state.tr.join(listStart);
    // After the join the item is now the last child — sink it in the same tr
    const $post = tr.selection.$from;
    const itemName = findListItem($post);
    if (itemName) {
      // Use the command but within the already-open transaction by dispatching once
      editor.view.dispatch(tr);
      editor.commands.sinkListItem(itemName);
    } else {
      editor.view.dispatch(tr);
    }
    return true;
  }

  // Cross-type: nest the current (single-item) list inside the previous list's last item
  if (currentList.childCount > 1) return false;

  const insertPos = listStart - 2; // end of previous list's last item content
  const $insertPos = state.doc.resolve(insertPos);
  if (!isItemType($insertPos.parent.type.name)) return false;

  const tr = state.tr;
  const nested = currentList.copy(currentList.content);
  tr.insert(insertPos, nested);
  const shift = nested.nodeSize;
  tr.delete(listStart + shift, listEnd + shift);
  tr.setSelection(Selection.near(tr.doc.resolve(insertPos + 1)));
  editor.view.dispatch(tr);
  return true;
}

/* ── List-type conversion helpers ──────────────────────────── */

/**
 * After converting a list's type, join it with any adjacent same-type lists
 * so the document doesn't accumulate redundant wrapper nodes.
 */
function joinAdjacentList(tr: Transaction, listTypeName: string): void {
  const { $from } = tr.selection;

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== listTypeName) continue;

    // Join with list above
    const listStart = $from.before(d);
    if (listStart > 0 && canJoin(tr.doc, listStart)) {
      const $b = tr.doc.resolve(listStart);
      if ($b.nodeBefore?.type.name === listTypeName) {
        try { tr.join(listStart); } catch { /* nested structure edge case */ }
      }
    }

    // Re-resolve after potential join, then try joining below
    const $post = tr.selection.$from;
    for (let d2 = $post.depth; d2 > 0; d2--) {
      if ($post.node(d2).type.name !== listTypeName) continue;
      const listEnd = $post.after(d2);
      if (listEnd < tr.doc.content.size && canJoin(tr.doc, listEnd)) {
        const $b = tr.doc.resolve(listEnd);
        if ($b.nodeAfter?.type.name === listTypeName) {
          try { tr.join(listEnd); } catch { /* nested structure edge case */ }
        }
      }
      break;
    }
    break;
  }
}

/** Conversion rules: pattern → target list type. */
const LIST_CONVERSIONS: { pattern: RegExp; listType: string }[] = [
  { pattern: /^\s*\[([x ]?)\]$/, listType: "taskList" },
  { pattern: /^\s*[-+*]$/, listType: "bulletList" },
  { pattern: /^\s*\d+\.$/, listType: "orderedList" },
];

/**
 * Convert the current list item to a different list type in-place.
 *
 * Single-item list  → rebuild the whole list with new types.
 * Multi-item list   → split the current item out into its own list,
 *                     convert that, and leave siblings untouched.
 *
 * Nesting depth is always preserved.
 */
function convertListInPlace(
  tr: Transaction,
  deleteFrom: number,
  deleteTo: number,
  cursorPos: number,
  targetListType: string,
): boolean {
  const schema = tr.doc.type.schema;

  // Delete trigger text
  tr.deleteRange(deleteFrom, deleteTo);

  // Re-resolve cursor after deletion
  const $cursor = tr.doc.resolve(tr.mapping.map(cursorPos));

  // Find innermost list
  const listDepth = findListDepth($cursor);
  if (listDepth < 0) return false;

  const listNode = $cursor.node(listDepth);
  if (listNode.type.name === targetListType) return true;

  const listPos = $cursor.before(listDepth);
  const targetListNodeType = schema.nodes[targetListType];
  const targetItemName = targetListType === "taskList" ? "taskItem" : "listItem";
  const targetItemNodeType = schema.nodes[targetItemName];

  const itemIndex = $cursor.index(listDepth);

  /** Convert a single item node to the target type. */
  function convertItem(child: PMNode): PMNode {
    if (child.type.name === targetItemName) return child;
    const attrs = targetItemName === "taskItem" ? { checked: false } : null;
    return targetItemNodeType.create(attrs, child.content, child.marks);
  }

  let convertedListPos: number;

  if (listNode.childCount === 1) {
    // Single item → convert the whole list
    const newList = targetListNodeType.create(null, [convertItem(listNode.child(0))]);
    tr.replaceWith(listPos, listPos + listNode.nodeSize, newList);
    convertedListPos = listPos;
  } else {
    // Multi-item → split current item into its own converted list,
    // keep siblings in their original list type
    const origType = listNode.type;
    const fragments: PMNode[] = [];

    // Items before
    if (itemIndex > 0) {
      const before: PMNode[] = [];
      for (let i = 0; i < itemIndex; i++) before.push(listNode.child(i));
      fragments.push(origType.create(null, before));
    }

    // The converted item
    const convertedList = targetListNodeType.create(null, [convertItem(listNode.child(itemIndex))]);
    fragments.push(convertedList);

    // Items after
    if (itemIndex < listNode.childCount - 1) {
      const after: PMNode[] = [];
      for (let i = itemIndex + 1; i < listNode.childCount; i++) after.push(listNode.child(i));
      fragments.push(origType.create(null, after));
    }

    tr.replaceWith(listPos, listPos + listNode.nodeSize, fragments);
    // Converted list starts after the "before" fragment
    convertedListPos = listPos + (itemIndex > 0 ? fragments[0].nodeSize : 0);
  }

  // Place cursor inside the converted item's content
  tr.setSelection(Selection.near(tr.doc.resolve(convertedListPos + 2)));
  return true;
}

/* ── Extensions ────────────────────────────────────────────── */

/** TaskItem with a bare `[]` input rule and checkboxes removed from Tab order. */
export const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    const parentNodeView = this.parent?.();
    if (!parentNodeView) return null;
    return (props: unknown) => {
      const result = parentNodeView(props as never);
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

/**
 * Keyboard & input fixes for lists:
 * - Tab / Shift-Tab stay inside the editor (never leak focus)
 * - Tab indents, including first-items by joining with the list above
 * - Backspace on empty list items lifts instead of undoing input rules
 * - Typing trigger patterns ([], -, 1.) converts between list types in-place
 */
export const ListBehaviorFix = Extension.create({
  name: "listBehaviorFix",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const itemName = findListItem(editor.state.selection.$from);
        if (itemName) {
          if (!editor.commands.sinkListItem(itemName)) {
            sinkIntoListAbove(editor);
          }
        }
        return true; // always consume — never leak focus
      },

      "Shift-Tab": ({ editor }) => {
        const itemName = findListItem(editor.state.selection.$from);
        if (itemName) editor.commands.liftListItem(itemName);
        return true; // always consume
      },

      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        if (!selection.empty || $from.parentOffset !== 0) return false;

        // Walk innermost-first so nested cross-type lists resolve correctly
        for (let depth = $from.depth; depth > 0; depth--) {
          const name = $from.node(depth).type.name;
          if (name !== "taskItem" && name !== "listItem") continue;

          // First child → lift out of the list
          if ($from.index(depth) === 0) {
            return editor.commands.liftListItem(name);
          }

          // Empty non-first block → split to isolate, then lift one indent level
          if ($from.parent.content.size === 0) {
            const splitPos = $from.before($from.depth);
            const { tr } = editor.state;
            tr.split(splitPos, 1);
            editor.view.dispatch(tr);
            return editor.commands.liftListItem(name);
          }

          break;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("listBehaviorFix"),
        props: {
          /**
           * Typing a trigger pattern + space inside a list converts the item
           * to a different list type:  [] → task,  -/+/* → bullet,  1. → ordered
           */
          handleTextInput(view, from, _to, text) {
            if (text !== " ") return false;

            const { state } = view;
            const $from = state.doc.resolve(from);
            const textBefore = state.doc.textBetween($from.start(), from, "\0", "\0");

            // Must be inside a list for conversion to apply
            const listDepth = findListDepth($from);
            if (listDepth < 0) return false;
            const currentListType = $from.node(listDepth).type.name;

            // Try each conversion rule
            for (const { pattern, listType } of LIST_CONVERSIONS) {
              if (pattern.test(textBefore) && currentListType !== listType) {
                const { tr } = state;
                convertListInPlace(tr, $from.start(), from, $from.pos, listType);
                joinAdjacentList(tr, listType);
                view.dispatch(tr);
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
