import { generateText } from "ai";
import { getModel } from "@/lib/ai/models";

const HAIKU_MODEL_ID = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Generate a concise title (3-7 words) that captures the main topic of this conversation.
Sentence case: capitalize only the first word and proper nouns.
Return JSON with a single "title" field.

Good examples:
{"title": "Fix login button on mobile"}
{"title": "Planning weekend trip to Paris"}
{"title": "Debug failing CI tests"}

Bad (too vague): {"title": "Quick question"}
Bad (too long): {"title": "Investigating and fixing the issue where the login button does not respond"}
Bad (wrong case): {"title": "Fix Login Button On Mobile"}`;

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message: string };

    if (!message) {
      return Response.json({ error: "Missing message" }, { status: 400 });
    }

    const model = getModel(HAIKU_MODEL_ID);
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: message,
    });

    // Extract JSON object from response — Haiku may include extra text around it
    const match = text.match(/\{[^}]*"title"\s*:\s*"[^"]*"[^}]*\}/);
    if (!match) {
      return Response.json({ error: "No valid title in response" }, { status: 500 });
    }
    const parsed = JSON.parse(match[0]) as { title: string };

    return Response.json({ title: parsed.title });
  } catch (error) {
    console.error("[chat/title] Error:", error);
    return Response.json(
      { error: "Failed to generate title" },
      { status: 500 },
    );
  }
}
