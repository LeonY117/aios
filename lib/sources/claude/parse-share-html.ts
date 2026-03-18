import type { ChatMessage } from "@/types";

export type ClaudeConversation = {
  title: string;
  model: string;
  messages: ChatMessage[];
};

/**
 * Parse a Claude share page's HTML to extract conversation messages.
 *
 * Claude share pages render conversations using these DOM classes:
 * - `div.font-user-message` for user turns
 * - `div.font-claude-message` for assistant turns
 *
 * The page title contains the conversation name.
 *
 * Since claude.ai blocks server-side fetches (Cloudflare), this parser
 * is designed to run client-side on HTML fetched by the user's browser.
 */
export function parseClaudeShareHtml(
  html: string,
): ClaudeConversation | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Extract title from the page
  const titleEl = doc.querySelector("title");
  const rawTitle = titleEl?.textContent?.trim() ?? "";
  // Claude titles often have " - Claude" suffix
  const title = rawTitle.replace(/\s*[-–—]\s*Claude\s*$/, "") || "Claude Conversation";

  const messages: ChatMessage[] = [];

  // Strategy 1: Look for user/assistant message containers by class
  const userMessages = doc.querySelectorAll(
    "[class*='font-user-message'], [data-testid='user-message']",
  );
  const claudeMessages = doc.querySelectorAll(
    "[class*='font-claude-message'], [data-testid='claude-message']",
  );

  if (userMessages.length > 0 || claudeMessages.length > 0) {
    // Collect all messages with their position in the document
    const allMessages: Array<{ role: "user" | "assistant"; el: Element }> = [];

    userMessages.forEach((el) => allMessages.push({ role: "user", el }));
    claudeMessages.forEach((el) =>
      allMessages.push({ role: "assistant", el }),
    );

    // Sort by document order
    allMessages.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    for (const { role, el } of allMessages) {
      const text = extractTextContent(el);
      if (text) {
        messages.push({ role, content: text });
      }
    }
  }

  // Strategy 2: Look for embedded JSON data (some share pages include it)
  if (messages.length === 0) {
    const jsonConversation = extractFromEmbeddedJson(doc);
    if (jsonConversation) return jsonConversation;
  }

  // Strategy 3: Fall back to generic turn-based extraction
  if (messages.length === 0) {
    // Look for alternating message blocks in common container patterns
    const blocks = doc.querySelectorAll(
      "[class*='message'], [class*='turn'], [class*='conversation'] > div",
    );
    for (const block of blocks) {
      const text = extractTextContent(block);
      if (!text) continue;

      // Heuristic: check for "Human:" or "Assistant:" prefixes
      if (text.startsWith("Human:") || text.startsWith("H:")) {
        messages.push({
          role: "user",
          content: text.replace(/^(?:Human|H):\s*/, ""),
        });
      } else if (text.startsWith("Assistant:") || text.startsWith("A:")) {
        messages.push({
          role: "assistant",
          content: text.replace(/^(?:Assistant|A):\s*/, ""),
        });
      }
    }
  }

  if (messages.length === 0) return null;

  return { title, model: "claude", messages };
}

/** Extract clean text content from an element, preserving code blocks as markdown. */
function extractTextContent(el: Element): string {
  const parts: string[] = [];

  for (const child of el.querySelectorAll(
    "p, pre, li, h1, h2, h3, h4, h5, h6, blockquote, table",
  )) {
    if (child.tagName === "PRE") {
      // Preserve code blocks
      const code = child.querySelector("code");
      const lang =
        code
          ?.getAttribute("class")
          ?.match(/language-(\w+)/)?.[1] ?? "";
      parts.push(`\`\`\`${lang}\n${(code ?? child).textContent?.trim() ?? ""}\n\`\`\``);
    } else if (child.tagName === "BLOCKQUOTE") {
      const text = child.textContent?.trim();
      if (text) parts.push(text.split("\n").map((l) => `> ${l}`).join("\n"));
    } else {
      const text = child.textContent?.trim();
      if (text) parts.push(text);
    }
  }

  // If no structured elements found, fall back to full text
  if (parts.length === 0) {
    return el.textContent?.trim() ?? "";
  }

  return parts.join("\n\n");
}

/** Try to extract conversation from embedded JSON in script tags. */
function extractFromEmbeddedJson(
  doc: Document,
): ClaudeConversation | null {
  const scripts = doc.querySelectorAll("script");

  for (const script of scripts) {
    const text = script.textContent;
    if (!text || text.length < 100) continue;

    // Look for __NEXT_DATA__ or similar embedded JSON
    const nextDataMatch = text.match(
      /__NEXT_DATA__\s*=\s*(\{[\s\S]*\})/,
    );
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        return extractFromNextData(data);
      } catch {
        // continue
      }
    }

    // Look for chat_messages pattern in any JSON blob
    if (text.includes("chat_messages")) {
      try {
        // Try to find a JSON object with chat_messages
        const match = text.match(/\{[^]*"chat_messages"[^]*\}/);
        if (match) {
          const data = JSON.parse(match[0]);
          return extractFromClaudeApi(data);
        }
      } catch {
        // continue
      }
    }
  }

  return null;
}

/** Extract from __NEXT_DATA__ format. */
function extractFromNextData(
  data: Record<string, unknown>,
): ClaudeConversation | null {
  // Navigate through Next.js page props
  const props = data.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;
  if (!pageProps) return null;

  // Look for conversation data in page props
  const conversation = pageProps.conversation as
    | Record<string, unknown>
    | undefined;
  if (conversation?.chat_messages) {
    return extractFromClaudeApi(conversation);
  }

  return null;
}

/** Extract from Claude's API JSON format (chat_messages array). */
function extractFromClaudeApi(
  data: Record<string, unknown>,
): ClaudeConversation | null {
  const chatMessages = data.chat_messages as
    | Array<{
        sender: string;
        content: Array<{ type: string; text?: string }>;
      }>
    | undefined;
  if (!chatMessages?.length) return null;

  const title = (data.name as string) ?? "Claude Conversation";
  const messages: ChatMessage[] = [];

  for (const msg of chatMessages) {
    const role: "user" | "assistant" =
      msg.sender === "human" ? "user" : "assistant";
    const textParts = msg.content
      ?.filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!);
    const content = textParts?.join("\n") ?? "";
    if (content) {
      messages.push({ role, content });
    }
  }

  if (messages.length === 0) return null;
  return { title, model: "claude", messages };
}
