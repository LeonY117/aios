/**
 * @vitest-environment jsdom
 *
 * Headless Tiptap editor tests for list behaviour.
 * Uses jsdom so ProseMirror has a DOM to work with.
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { CustomTaskItem, ListBehaviorFix } from "./list-extensions";

/* ── Test helpers ── */

function createEditor(content = ""): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      TaskList,
      CustomTaskItem.configure({ nested: true }),
      ListBehaviorFix,
    ],
    content,
  });
}

/** Dump the doc as a compact tree string for assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docTree(node: any, indent = 0): string {
  if (node.isText) return `${"  ".repeat(indent)}"${node.text}"`;
  const kids: string[] = [];
  for (let i = 0; i < node.childCount; i++) {
    kids.push(docTree(node.child(i), indent + 1));
  }
  const name = node.type.name;
  const attrs =
    name === "taskItem" ? ` checked=${node.attrs.checked}` : "";
  const content = kids.length ? "\n" + kids.join("\n") : "";
  return `${"  ".repeat(indent)}${name}${attrs}${content}`;
}

/** Get the node type name at the cursor's depth chain. */
function cursorPath(editor: Editor): string[] {
  const { $from } = editor.state.selection;
  const path: string[] = [];
  for (let d = 0; d <= $from.depth; d++) {
    path.push($from.node(d).type.name);
  }
  return path;
}

/** Simulate typing text character by character (triggers handleTextInput). */
function typeText(editor: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (f) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f as any)(editor.view, from, to, ch),
    );
    if (!handled) {
      editor.commands.insertContent(ch);
    }
  }
}

/** Simulate pressing Backspace via ProseMirror's handleKeyDown chain. */
function pressBackspace(editor: Editor): void {
  const event = new KeyboardEvent("keydown", {
    key: "Backspace",
    bubbles: true,
  });
  editor.view.someProp("handleKeyDown", (f) => f(editor.view, event));
}

/** Simulate pressing Tab / Shift-Tab via ProseMirror's handleKeyDown. */
function pressTab(editor: Editor, shift = false): void {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: shift,
    bubbles: true,
  });
  editor.view.someProp("handleKeyDown", (f) => f(editor.view, event));
}

/** Place cursor inside the Nth paragraph (1-indexed). */
function cursorInParagraph(editor: Editor, n: number, atEnd = false): void {
  let count = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      count++;
      if (count === n) {
        const target = atEnd ? pos + 1 + node.content.size : pos + 1;
        editor.commands.setTextSelection(target);
      }
    }
  });
}

/* ── Tests ── */

describe("List behaviour", () => {
  describe("Bug repro: [] XYZ, Enter, * , Tab", () => {
    it("traces each step of the user's sequence", () => {
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>XYZ</p></li></ul>',
      );

      // Put cursor at end of "XYZ" (inside the taskItem)
      cursorInParagraph(editor, 1, true);
      expect(cursorPath(editor)).toContain("taskItem");

      console.log("STEP 0 — initial");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      // --- Enter: split task item ---
      editor.commands.splitListItem("taskItem");
      console.log("\nSTEP 1 — after Enter");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
      expect(cursorPath(editor)).toContain("taskItem");

      // --- Type "* " to convert to bullet ---
      typeText(editor, "* ");
      console.log("\nSTEP 2 — after typing '* '");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
      console.log("HTML:", editor.getHTML());

      // --- Tab ---
      pressTab(editor);
      console.log("\nSTEP 3 — after Tab");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
      console.log("HTML:", editor.getHTML());

      // --- Assertions ---
      const path = cursorPath(editor);

      // Cursor should be inside: doc > taskList > taskItem > bulletList > listItem > paragraph
      expect(path).toContain("taskList");
      expect(path).toContain("bulletList");
      expect(path).toContain("listItem");

      // "XYZ" should still exist
      expect(editor.getHTML()).toContain("XYZ");

      // There should be exactly one taskItem containing both the paragraph and the nested bulletList
      let taskItemCount = 0;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "taskItem") taskItemCount++;
      });
      expect(taskItemCount).toBe(1);
    });
  });

  describe("Cross-type nesting: taskList above, bulletList below", () => {
    it("nests the bullet inside the task item on Tab", () => {
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>A</p></li></ul>' +
          "<ul><li><p>B</p></li></ul>",
      );
      cursorInParagraph(editor, 2); // cursor in "B"

      console.log("\nBEFORE Tab (cross-type):");
      console.log(docTree(editor.state.doc));

      pressTab(editor);

      console.log("\nAFTER Tab:");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
      console.log("HTML:", editor.getHTML());

      expect(cursorPath(editor)).toContain("bulletList");
      expect(cursorPath(editor)).toContain("taskItem");
    });
  });

  describe("Same-type join: two adjacent taskLists", () => {
    it("joins and sinks on Tab", () => {
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>A</p></li></ul>' +
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>B</p></li></ul>',
      );
      cursorInParagraph(editor, 2); // cursor in "B"

      console.log("\nBEFORE Tab (same-type):");
      console.log(docTree(editor.state.doc));

      pressTab(editor);

      console.log("\nAFTER Tab:");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      // B should now be nested under A
      const path = cursorPath(editor);
      expect(path.filter((n) => n === "taskItem").length).toBe(2);
    });
  });

  describe("Backspace on empty non-first paragraph in a list item", () => {
    it("lifts the empty paragraph out (removes one indent level)", () => {
      // State after lifting a nested bullet: taskItem has two paragraphs
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>this is a todo</p><p></p></li></ul>',
      );
      cursorInParagraph(editor, 2);

      console.log("\n=== BEFORE Backspace ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      pressBackspace(editor);

      console.log("\n=== AFTER Backspace ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
      console.log("HTML:", editor.getHTML());

      // taskItem and "this is a todo" must survive
      expect(editor.getHTML()).toContain("this is a todo");
      expect(editor.getHTML()).toContain("taskItem");

      // The empty paragraph should have been lifted OUT of the taskList
      // (it's now a standalone paragraph, no longer indented)
      expect(cursorPath(editor)).not.toContain("taskItem");
    });

    it("also works for listItem (bullet list)", () => {
      const editor = createEditor(
        "<ul><li><p>bullet text</p><p></p></li></ul>",
      );
      cursorInParagraph(editor, 2);

      pressBackspace(editor);

      console.log("\n=== AFTER Backspace (bullet) ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      expect(editor.getHTML()).toContain("bullet text");
      // "bullet text" should still be in a list
      expect(editor.getHTML()).toContain("<li>");
      // Cursor should NOT be in the list anymore (lifted out)
      expect(cursorPath(editor)).not.toContain("listItem");
    });
  });

  describe("Backspace on nested bullet inside task finds listItem before taskItem", () => {
    it("lifts the bullet (not deletes the paragraph)", () => {
      // taskItem > [paragraph, bulletList > listItem > paragraph ""]
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>todo</p><ul><li><p></p></li></ul></li></ul>',
      );
      cursorInParagraph(editor, 2);

      console.log("\n=== BEFORE Backspace on nested bullet ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      // Should find listItem (inner) first, not taskItem (outer)
      pressBackspace(editor);

      console.log("\n=== AFTER Backspace ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      // bulletList should be gone (lifted), but taskItem remains
      expect(editor.getHTML()).toContain("taskItem");
      expect(editor.getHTML()).toContain("todo");

      // Cursor should still be inside the taskItem
      expect(cursorPath(editor)).toContain("taskItem");
    });
  });

  describe("In-place conversion preserves nesting depth", () => {
    it("converts a nested task item to bullet without un-indenting", () => {
      // taskList > taskItem "A" > taskList > taskItem "" — cursor in nested item
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>A</p>' +
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>' +
          "</li></ul>",
      );
      cursorInParagraph(editor, 2, true);

      console.log("\n=== BEFORE conversion ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      // Type "* " to convert nested taskItem → bullet
      typeText(editor, "* ");

      console.log("\n=== AFTER conversion ===");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));

      const path = cursorPath(editor);
      // Should still be nested inside the outer taskItem
      expect(path).toContain("taskItem");
      // Should now be a bullet list
      expect(path).toContain("bulletList");
      expect(path).toContain("listItem");
      // "A" untouched
      expect(editor.getHTML()).toContain("A");
    });
  });

  describe("Shift-Tab outdents nested items", () => {
    it("lifts a nested bullet out of a task item", () => {
      const editor = createEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>A</p><ul><li><p>B</p></li></ul></li></ul>',
      );
      cursorInParagraph(editor, 2); // cursor in "B"

      console.log("\nBEFORE Shift-Tab:");
      console.log(docTree(editor.state.doc));

      pressTab(editor, true); // Shift-Tab

      console.log("\nAFTER Shift-Tab:");
      console.log(docTree(editor.state.doc));
      console.log("cursor:", cursorPath(editor));
    });
  });
});
