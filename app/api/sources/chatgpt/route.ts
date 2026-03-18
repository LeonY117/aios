import { NextResponse } from "next/server";
import { resolveFlightPayload } from "@/lib/sources/chatgpt/parse-flight";
import { extractConversation } from "@/lib/sources/chatgpt/extract-conversation";

const SHARE_URL_RE = /chatgpt\.com\/share\//;

function errorResponse(url: string, message: string) {
  return NextResponse.json({
    title: "Import Failed",
    content: message,
    sourceType: "chatgpt" as const,
    sourceUrl: url,
    messages: [{ role: "assistant" as const, content: message }],
  });
}

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!SHARE_URL_RE.test(url)) {
    return errorResponse(url, "Not a valid ChatGPT share link.");
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    html = await res.text();
  } catch {
    return errorResponse(url, "Failed to fetch the ChatGPT share page.");
  }

  // Extract the React Flight payload from streamController.enqueue("...")
  const enqueueMatch = html.match(
    /streamController\.enqueue\("(.+?)"\)\s*[;\n]/,
  );
  if (!enqueueMatch) {
    return errorResponse(
      url,
      "Could not find conversation data in the page. The share link may be expired or invalid.",
    );
  }

  let flightArray: unknown[];
  try {
    // Double-parse: first JSON.parse unescapes the string, second parses the array
    const unescaped = JSON.parse(`"${enqueueMatch[1]}"`);
    flightArray = JSON.parse(unescaped);
    if (!Array.isArray(flightArray)) {
      throw new Error("Payload is not an array");
    }
  } catch {
    return errorResponse(url, "Failed to parse conversation data from page.");
  }

  let resolved: unknown;
  try {
    resolved = resolveFlightPayload(flightArray);
  } catch {
    return errorResponse(url, "Failed to resolve React Flight payload.");
  }

  const conversation = extractConversation(resolved);
  if (!conversation) {
    return errorResponse(
      url,
      "Could not extract messages from the conversation data.",
    );
  }

  // Format messages as markdown for SOT content fallback
  const markdownLines = conversation.messages.map(
    (m) => `**${m.role === "user" ? "User" : "Assistant"}:**\n\n${m.content}`,
  );
  const content = markdownLines.join("\n\n---\n\n");

  return NextResponse.json({
    title: conversation.title,
    content,
    sourceType: "chatgpt",
    sourceUrl: url,
    model: conversation.model,
    messages: conversation.messages,
  });
}
