import { useCallback, useEffect } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { detectSource } from "@/lib/sources/detect";
import { viewportCenter } from "@/lib/nodes";
import type { SotNodeData, ChatNodeData, ChatMessage } from "@/types";
import { topZIndex } from "@/lib/nodes";
import { isPendingEditorFocus } from "@/lib/editor-focus-signal";

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;

const SOURCE_ENDPOINT: Record<string, string> = {
  github: "/api/sources/github",
  notion: "/api/sources/notion",
  slack: "/api/sources/slack",
  url: "/api/sources/url",
  chatgpt: "/api/sources/chatgpt",
  claude: "/api/sources/claude",
};

/**
 * Handles adding a URL-based node to the canvas.
 * Shared between paste handler and toolbar link button.
 */
export function handleLinkAdd(
  url: string,
  position: { x: number; y: number },
  setNodes: SetNodes,
) {
  const detection = detectSource(url);

  if (detection.type === "manual") {
    // Not a valid URL — create as editable rich text note
    const paragraphs = detection.text
      .split(/\n+/)
      .map((line) => `<p>${line}</p>`)
      .join("");
    const data: SotNodeData = {
      title: "Untitled",
      content: paragraphs,
      sourceType: "manual",
      isRichText: true,
    };
    setNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: "sotCard",
        position,
        data,
        style: { width: 280, height: 360 },
        zIndex: topZIndex(nds),
      },
    ]);
    return;
  }

  if (detection.type === "chatgpt" || detection.type === "claude") {
    const source = detection.type;
    const nodeId = crypto.randomUUID();
    const loadingData: ChatNodeData = {
      title: detection.url,
      source,
      messages: [],
      sourceUrl: detection.url,
      isLoading: true,
    };
    setNodes((nds) => [
      ...nds,
      {
        id: nodeId,
        type: "chatWindow",
        position,
        data: loadingData,
        style: { width: 380, height: 420 },
        zIndex: topZIndex(nds),
      },
    ]);

    fetch(SOURCE_ENDPOINT[source], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: detection.url }),
    })
      .then((res) => res.json())
      .then((result) => {
        const messages: ChatMessage[] = result.messages ?? [];
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    title:
                      result.title ??
                      `${source === "chatgpt" ? "ChatGPT" : "Claude"} Conversation`,
                    source,
                    model: result.model,
                    messages,
                    sourceUrl: detection.url,
                    isLoading: false,
                  } satisfies ChatNodeData,
                }
              : n,
          ),
        );
      })
      .catch(() => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    title: "Import Failed",
                    source,
                    messages: [
                      {
                        role: "assistant",
                        content: `Failed to fetch or parse this ${source === "chatgpt" ? "ChatGPT" : "Claude"} conversation.`,
                      },
                    ],
                    sourceUrl: detection.url,
                    isLoading: false,
                  } satisfies ChatNodeData,
                }
              : n,
          ),
        );
      });
    return;
  }

  // All other URL types → SOT card
  const nodeId = crypto.randomUUID();
  const sourceType = detection.type;
  const endpoint = SOURCE_ENDPOINT[detection.type] ?? "/api/sources/url";
  const loadingData: SotNodeData = {
    title: detection.url,
    content: "",
    sourceType,
    sourceUrl: detection.url,
    isLoading: true,
  };
  setNodes((nds) => [
    ...nds,
    {
      id: nodeId,
      type: "sotCard",
      position,
      data: loadingData,
      style: { width: 288, height: 320 },
      zIndex: topZIndex(nds),
    },
  ]);

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: detection.url }),
  })
    .then((res) => res.json())
    .then((result) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  title: result.title,
                  content: result.content,
                  sourceType: result.sourceType,
                  sourceUrl: result.sourceUrl,
                  isLoading: false,
                } satisfies SotNodeData,
              }
            : n,
        ),
      );
    })
    .catch(() => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  title: detection.url,
                  content:
                    "Failed to fetch or extract content from this URL.",
                  sourceType,
                  sourceUrl: detection.url,
                  isLoading: false,
                } satisfies SotNodeData,
              }
            : n,
        ),
      );
    });
}

export function useCanvasPaste(setNodes: SetNodes) {
  const { screenToFlowPosition } = useReactFlow();

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      // A new editor is about to mount — let it handle the paste
      if (isPendingEditorFocus()) {
        return;
      }

      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;

      e.preventDefault();

      const position = viewportCenter(screenToFlowPosition);
      handleLinkAdd(text, position, setNodes);
    },
    [screenToFlowPosition, setNodes],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);
}
