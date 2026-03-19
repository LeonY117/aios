import TurndownService from "turndown";
import type { Node } from "@xyflow/react";
import type { SotNodeData, ChatNodeData } from "@/types";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Task list support: checkboxes → [ ] / [x]
turndown.addRule("taskListItem", {
  filter: (node) =>
    node.nodeName === "LI" &&
    node.getAttribute("data-type") === "taskItem",
  replacement: (content, node) => {
    const checked = (node as Element).getAttribute("data-checked") === "true";
    return `${checked ? "[x]" : "[ ]"} ${content.trim()}\n`;
  },
});

function htmlToMarkdown(html: string): string {
  // If it doesn't look like HTML, return as-is
  if (!html.includes("<")) return html;
  return turndown.turndown(html);
}

type ContextNode = Node<SotNodeData> | Node<ChatNodeData>;

function isChatNode(node: ContextNode): node is Node<ChatNodeData> {
  return "messages" in node.data && Array.isArray(node.data.messages);
}

function nodeToSection(node: ContextNode): string {
  if (isChatNode(node)) {
    const d = node.data;
    const lines: string[] = [`## Source: ${d.title}`];
    lines.push(`**Type:** ${d.source} conversation`);
    if (d.model) lines.push(`**Model:** ${d.model}`);
    lines.push("");
    for (const msg of d.messages ?? []) {
      const label = msg.role === "user" ? "User" : "Assistant";
      lines.push(`**${label}:**\n\n${msg.content}\n`);
    }
    return lines.join("\n");
  }

  const d = node.data as SotNodeData;
  const lines: string[] = [`## Source: ${d.title}`];
  lines.push(`**Type:** ${d.sourceType}`);
  if (d.sourceUrl) lines.push(`**URL:** ${d.sourceUrl}`);
  lines.push("", htmlToMarkdown(d.content));
  return lines.join("\n");
}

export function compileSingleContext(node: ContextNode): string {
  return nodeToSection(node);
}

export function compileContext(nodes: ContextNode[]): string {
  if (nodes.length === 0) return "";

  const sections = nodes.map(nodeToSection);

  return [
    "# Project Context",
    "",
    "> This context was compiled from AIOS. Use it to inform your responses.",
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "",
    "---",
  ].join("\n");
}
