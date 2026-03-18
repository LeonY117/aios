import { useCallback, useEffect } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { detectSource } from "@/lib/sources/detect";
import { parseClaudeShareHtml } from "@/lib/sources/claude/parse-share-html";
import { createSotNode, viewportCenter } from "@/lib/nodes";
import type { SotNodeData, ChatNodeData, ChatMessage } from "@/types";

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;

const SOURCE_ENDPOINT: Record<string, string> = {
  github: "/api/sources/github",
  notion: "/api/sources/notion",
  url: "/api/sources/url",
  chatgpt: "/api/sources/chatgpt",
};

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

      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;

      e.preventDefault();

      const detection = detectSource(text);
      const position = viewportCenter(screenToFlowPosition);

      if (detection.type === "manual") {
        const title =
          detection.text.length > 50
            ? detection.text.slice(0, 50) + "…"
            : detection.text;
        const data: SotNodeData = {
          title,
          content: detection.text,
          sourceType: "manual",
        };
        setNodes((nds) => [...nds, createSotNode(data, position)]);
        return;
      }

      if (detection.type === "chatgpt") {
        // ChatGPT share links create chatWindow nodes
        const nodeId = crypto.randomUUID();
        const loadingData: ChatNodeData = {
          title: detection.url,
          source: "chatgpt",
          messages: [],
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
          },
        ]);

        fetch(SOURCE_ENDPOINT.chatgpt, {
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
                        title: result.title ?? "ChatGPT Conversation",
                        source: "chatgpt",
                        model: result.model,
                        messages,
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
                        source: "chatgpt",
                        messages: [
                          {
                            role: "assistant",
                            content:
                              "Failed to fetch or parse this ChatGPT conversation.",
                          },
                        ],
                        isLoading: false,
                      } satisfies ChatNodeData,
                    }
                  : n,
              ),
            );
          });
        return;
      }

      if (detection.type === "claude") {
        // Claude share links are behind Cloudflare — fetch client-side
        const nodeId = crypto.randomUUID();
        const loadingData: ChatNodeData = {
          title: detection.url,
          source: "claude",
          messages: [],
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
          },
        ]);

        fetch(detection.url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          })
          .then((html) => {
            const conversation = parseClaudeShareHtml(html);
            if (!conversation || conversation.messages.length === 0) {
              throw new Error("Could not extract messages");
            }
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      data: {
                        title: conversation.title,
                        source: "claude",
                        model: conversation.model,
                        messages: conversation.messages,
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
                        source: "claude",
                        messages: [
                          {
                            role: "assistant",
                            content:
                              "Failed to fetch this Claude conversation. Claude share pages are protected by Cloudflare, so client-side fetch may be blocked by CORS. Try copying the conversation text and pasting it directly.",
                          },
                        ],
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
    },
    [screenToFlowPosition, setNodes],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);
}
