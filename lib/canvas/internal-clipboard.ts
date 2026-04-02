import type { Node, Edge } from "@xyflow/react";

type ClipboardPayload = {
  nodes: Node[];
  edges: Edge[];
  pasteCount: number;
};

let clipboard: ClipboardPayload | null = null;

export function setClipboard(nodes: Node[], edges: Edge[]): void {
  clipboard = { nodes, edges, pasteCount: 0 };
}

export function getClipboard(): ClipboardPayload | null {
  return clipboard;
}

export function incrementPasteCount(): void {
  if (clipboard) clipboard.pasteCount += 1;
}

export function clearClipboard(): void {
  clipboard = null;
}
