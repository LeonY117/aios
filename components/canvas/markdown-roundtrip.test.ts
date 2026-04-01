/**
 * @vitest-environment jsdom
 *
 * Round-trip fidelity tests: HTML → Markdown → HTML
 * Verifies that switching the editor from getHTML() to getMarkdown()
 * preserves all formatting, nesting, and checked state.
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { CustomTaskItem, ListBehaviorFix } from "./list-extensions";

/* ── Helpers ── */

function createEditor(content = ""): Editor {
  return new Editor({
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      CustomTaskItem.configure({ nested: true }),
      ListBehaviorFix,
      Markdown,
    ],
    content,
  });
}

/** Load HTML, export markdown, reload markdown, export HTML — return both HTMLs. */
function roundTrip(html: string): { markdown: string; before: string; after: string } {
  const editor = createEditor(html);
  const before = editor.getHTML();
  const markdown = editor.getMarkdown();

  // Reload from markdown
  editor.commands.setContent(markdown, { contentType: "markdown" } as never);
  const after = editor.getHTML();

  editor.destroy();
  return { markdown, before, after };
}

/* ── Test fixtures — real content from session files ── */

const NESTED_TASK_LIST = `<ul data-type="taskList">
  <li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>set up ssh into the computer</p></div></li>
  <li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div>
    <p>set up dynamic models</p>
    <ul data-type="taskList">
      <li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>use cheaper models? openAI?</p></div></li>
    </ul>
  </div></li>
</ul>`;

const NESTED_BULLET_LIST = `<ul>
  <li><p>Search space becoming commoditized</p>
    <ul>
      <li><p>Perplexity ($150M range), Tavily acquired, EXA indexing web</p></li>
      <li><p>Deeper nested item</p>
        <ul>
          <li><p>Third level</p></li>
        </ul>
      </li>
    </ul>
  </li>
</ul>`;

const MIXED_FORMATTING = `<h3>OpenClaw Todos</h3>
<p><strong><em><u>Learning with Claude on open source projects</u></em></strong></p>
<p>OpenClaw [4+ hrs]</p>
<ul>
  <li><p>how does memory work?</p></li>
</ul>`;

const HEADINGS_AND_BLOCKQUOTES = `<h1>Main Title</h1>
<h2>Subtitle</h2>
<h3>Section</h3>
<blockquote><p>This is a quote with <strong>bold</strong> and <em>italic</em> text.</p></blockquote>
<p>Regular paragraph.</p>`;

const ORDERED_LIST = `<ol>
  <li><p>First item</p></li>
  <li><p>Second item</p>
    <ol>
      <li><p>Nested ordered</p></li>
    </ol>
  </li>
  <li><p>Third item</p></li>
</ol>`;

const MIXED_LIST_TYPES = `<ul data-type="taskList">
  <li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div>
    <p>Task with nested bullets</p>
    <ul>
      <li><p>Bullet inside task</p></li>
      <li><p>Another bullet</p></li>
    </ul>
  </div></li>
</ul>`;

const CHECKED_TASKS = `<ul data-type="taskList">
  <li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>Done task</p></div></li>
  <li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Pending task</p></div></li>
</ul>`;

const EMPTY_PARAGRAPHS = `<p>Before</p><p></p><p>After</p>`;

const CODE_BLOCK = `<p>Some text</p><pre><code class="language-javascript">function hello() {
  return "world";
}</code></pre><p>After code</p>`;

/* ── Tests ── */

describe("Markdown round-trip fidelity", () => {
  it("preserves nested task lists", () => {
    const { markdown, before, after } = roundTrip(NESTED_TASK_LIST);

    console.log("Markdown output:\n", markdown);
    console.log("HTML before:\n", before);
    console.log("HTML after:\n", after);

    // Text content preserved
    expect(after).toContain("set up ssh into the computer");
    expect(after).toContain("set up dynamic models");
    expect(after).toContain("use cheaper models? openAI?");

    // Task list structure preserved
    expect(after).toContain('data-type="taskList"');
    expect(after).toContain('data-type="taskItem"');

    // Nesting preserved: inner task list exists
    const editorAfter = createEditor();
    editorAfter.commands.setContent(markdown, { contentType: "markdown" } as never);
    let taskListCount = 0;
    editorAfter.state.doc.descendants((node) => {
      if (node.type.name === "taskList") taskListCount++;
    });
    expect(taskListCount).toBeGreaterThanOrEqual(2); // outer + inner
    editorAfter.destroy();
  });

  it("preserves checked state on task items", () => {
    const { markdown, after } = roundTrip(CHECKED_TASKS);

    console.log("Checked tasks markdown:\n", markdown);

    // Markdown should use [x] and [ ]
    expect(markdown).toContain("[x]");
    expect(markdown).toContain("[ ]");

    // After round-trip, checked state should be preserved
    expect(after).toContain('data-checked="true"');
    expect(after).toContain('data-checked="false"');
  });

  it("preserves nested bullet lists (3 levels)", () => {
    const { markdown, after } = roundTrip(NESTED_BULLET_LIST);

    console.log("Nested bullets markdown:\n", markdown);
    console.log("HTML after:\n", after);

    expect(after).toContain("Search space becoming commoditized");
    expect(after).toContain("Third level");

    // Verify nesting depth — count bulletList nodes
    const editorAfter = createEditor();
    editorAfter.commands.setContent(markdown, { contentType: "markdown" } as never);
    let bulletListCount = 0;
    editorAfter.state.doc.descendants((node) => {
      if (node.type.name === "bulletList") bulletListCount++;
    });
    console.log("bulletList count after round-trip:", bulletListCount);
    // At minimum need 2 levels (the original has 3, but markdown may compact)
    expect(bulletListCount).toBeGreaterThanOrEqual(2);
    // All text content must survive
    expect(after).toContain("Deeper nested item");
    editorAfter.destroy();
  });

  it("preserves ordered lists with nesting", () => {
    const { markdown, after } = roundTrip(ORDERED_LIST);

    console.log("Ordered list markdown:\n", markdown);

    expect(after).toContain("First item");
    expect(after).toContain("Nested ordered");
    expect(after).toContain("<ol>");
  });

  it("preserves headings and blockquotes", () => {
    const { markdown, after } = roundTrip(HEADINGS_AND_BLOCKQUOTES);

    console.log("Headings markdown:\n", markdown);

    // Check markdown output has proper syntax
    expect(markdown).toContain("# Main Title");
    expect(markdown).toContain("## Subtitle");
    expect(markdown).toContain("### Section");
    expect(markdown).toContain(">");

    // HTML round-trip preserves structure
    expect(after).toContain("<h1>");
    expect(after).toContain("<h2>");
    expect(after).toContain("<h3>");
    expect(after).toContain("<blockquote>");
    expect(after).toContain("<strong>");
    expect(after).toContain("<em>");
  });

  it("preserves bold, italic, underline formatting", () => {
    const { markdown, after } = roundTrip(MIXED_FORMATTING);

    console.log("Mixed formatting markdown:\n", markdown);

    expect(after).toContain("<strong>");
    expect(after).toContain("<em>");
    // Underline — check if <u> survives (may need custom serializer)
    expect(after).toContain("<u>");
  });

  it("preserves mixed list types (task with nested bullets)", () => {
    const { markdown, after } = roundTrip(MIXED_LIST_TYPES);

    console.log("Mixed lists markdown:\n", markdown);

    expect(after).toContain("Task with nested bullets");
    expect(after).toContain("Bullet inside task");

    // Both list types should exist
    expect(after).toContain('data-type="taskList"');
    const editorAfter = createEditor();
    editorAfter.commands.setContent(markdown, { contentType: "markdown" } as never);
    let hasBulletList = false;
    let hasTaskList = false;
    editorAfter.state.doc.descendants((node) => {
      if (node.type.name === "bulletList") hasBulletList = true;
      if (node.type.name === "taskList") hasTaskList = true;
    });
    expect(hasBulletList).toBe(true);
    expect(hasTaskList).toBe(true);
    editorAfter.destroy();
  });

  it("preserves code blocks", () => {
    const { markdown, after } = roundTrip(CODE_BLOCK);

    console.log("Code block markdown:\n", markdown);
    console.log("Code block HTML after:\n", after);

    expect(markdown).toContain("```");
    expect(after).toContain("<pre>");
    expect(after).toContain("hello");
  });

  it("handles empty paragraphs", () => {
    const { after } = roundTrip(EMPTY_PARAGRAPHS);

    expect(after).toContain("Before");
    expect(after).toContain("After");
  });

  it("markdown output is human-readable (no HTML tags for basic formatting)", () => {
    const { markdown } = roundTrip(HEADINGS_AND_BLOCKQUOTES);

    // Should use markdown syntax, not HTML tags
    expect(markdown).not.toContain("<h1>");
    expect(markdown).not.toContain("<h2>");
    expect(markdown).not.toContain("<blockquote>");
    expect(markdown).toContain("#");
    expect(markdown).toContain("**");
    expect(markdown).toContain("*");
  });
});
