import type { Node } from "@xyflow/react";
import type { SotNodeData } from "@/types";
import { topZIndex } from "@/lib/nodes";

type SetNodes = (updater: (nodes: Node[]) => Node[]) => void;

type Position = { x: number; y: number };

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

export async function handleFileUpload(
  file: File,
  position: Position,
  setNodes: SetNodes,
  sessionName: string,
): Promise<void> {
  const nodeId = crypto.randomUUID();

  // Create loading skeleton immediately
  const skeleton: Node = {
    id: nodeId,
    type: "sotCard",
    position,
    data: {
      title: file.name,
      content: "",
      sourceType: "file",
      isLoading: true,
    } satisfies SotNodeData,
    style: { width: 280, height: 360 },
  };
  setNodes((nds) => [...nds, { ...skeleton, zIndex: topZIndex(nds) }]);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("sessionName", sessionName);
  formData.append("nodeId", nodeId);

  try {
    const res = await fetch("/api/sources/file", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const result = await res.json();

    const isPdf = result.sourceType === "pdf";
    const isFile = result.sourceType === "file";

    const data: SotNodeData = {
      title: result.title,
      content: isFile ? textToHtml(result.content) : result.content,
      sourceType: result.sourceType,
      isRichText: isFile,
      ...(isPdf
        ? {
            pdfUrl: `/api/session/files?name=${encodeURIComponent(sessionName)}&id=${nodeId}`,
          }
        : {}),
    };

    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data } : n,
      ),
    );
  } catch {
    // Remove skeleton on error
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  }
}
