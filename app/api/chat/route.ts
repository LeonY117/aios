import { streamText, type ModelMessage } from "ai";
import { getModel, getToolsForModel, MODELS } from "@/lib/ai/models";
import { buildSystemPrompt, buildBtwPrompt, type SotContext } from "@/lib/ai/system-prompt";

export const maxDuration = 30;

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolName: string }
  | { type: "source"; url: string; title?: string }
  | { type: "error"; message: string };

const encoder = new TextEncoder();

function formatEvent(event: StreamEvent): Uint8Array {
  return encoder.encode("data: " + JSON.stringify(event) + "\n\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      modelId,
      attachedSots = [],
      webSearch = true,
      btw,
    } = body as {
      messages: ModelMessage[];
      modelId: string;
      attachedSots?: SotContext[];
      webSearch?: boolean;
      btw?: { selectedText: string };
    };

    const config = MODELS.find((m) => m.id === modelId);
    if (!config) {
      return Response.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
    }

    const model = getModel(modelId);
    const system = btw
      ? buildBtwPrompt(btw.selectedText)
      : buildSystemPrompt(attachedSots);
    const tools = getToolsForModel(config, { webSearch });

    const result = streamText({
      model,
      system,
      messages,
      tools,
      onError({ error }) {
        console.error("[chat/route] streamText error:", error);
      },
    });

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        switch (chunk.type) {
          case "text-delta":
            controller.enqueue(formatEvent({ type: "text", text: chunk.text }));
            break;
          case "tool-call":
            controller.enqueue(
              formatEvent({ type: "tool-call", toolName: chunk.toolName }),
            );
            break;
          case "source":
            controller.enqueue(
              formatEvent({
                type: "source",
                url: chunk.url,
                title: chunk.title,
              }),
            );
            break;
          case "error":
            controller.enqueue(
              formatEvent({
                type: "error",
                message:
                  chunk.error instanceof Error
                    ? chunk.error.message
                    : String(chunk.error),
              }),
            );
            break;
        }
      },
    });

    return new Response(result.fullStream.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[chat/route] Unhandled error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
