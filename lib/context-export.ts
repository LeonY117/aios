import type { Node } from "@xyflow/react";
import type { SotNodeData } from "@/types";

export function compileContext(sotNodes: Node<SotNodeData>[]): string {
  if (sotNodes.length === 0) return "";

  const sections = sotNodes.map((node) => {
    const d = node.data;
    const lines: string[] = [`## Source: ${d.title}`];
    lines.push(`**Type:** ${d.sourceType}`);
    if (d.sourceUrl) {
      lines.push(`**URL:** ${d.sourceUrl}`);
    }
    lines.push("", d.content);
    return lines.join("\n");
  });

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
