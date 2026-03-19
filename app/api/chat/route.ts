import { streamText, type ModelMessage } from "ai";
import { getModel, getToolsForModel, MODELS } from "@/lib/ai/models";
import { buildSystemPrompt, type SotContext } from "@/lib/ai/system-prompt";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      modelId,
      attachedSots = [],
      webSearch = true,
    } = body as {
      messages: ModelMessage[];
      modelId: string;
      attachedSots?: SotContext[];
      webSearch?: boolean;
    };

    const config = MODELS.find((m) => m.id === modelId);
    if (!config) {
      return Response.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
    }

    const model = getModel(modelId);
    const system = buildSystemPrompt(attachedSots);
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

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[chat/route] Unhandled error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
