import { NextResponse } from "next/server";
import puppeteer, { type Browser } from "puppeteer";

const SHARE_URL_RE = /claude\.ai\/share\//;

// Singleton browser — launched on first request, reused for all subsequent ones.
// Lives for the lifetime of the Next.js dev server / production process.
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  // Clean up reference if the browser closes unexpectedly
  browserInstance.on("disconnected", () => {
    browserInstance = null;
  });
  return browserInstance;
}

function errorResponse(url: string, message: string) {
  return NextResponse.json({
    title: "Import Failed",
    content: message,
    sourceType: "claude" as const,
    sourceUrl: url,
    messages: [{ role: "assistant" as const, content: message }],
  });
}

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!SHARE_URL_RE.test(url)) {
    return errorResponse(url, "Not a valid Claude share link.");
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate and wait for the conversation to render
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for message elements to appear
    await page.waitForSelector(
      '[data-testid="user-message"], [class*="font-claude-response"]',
      { timeout: 15000 },
    );

    // Extract conversation data from the DOM
    const conversation = await page.evaluate(() => {
      // The page header contains "Conversation TitleShared by Name"
      const headerEl = document.querySelector('[data-testid="page-header"]');
      const headerText = headerEl?.textContent?.trim() ?? "";
      const title =
        headerText.replace(/Shared by\s+.*$/, "").trim() ||
        document.title.replace(/\s*[-\u2013\u2014]\s*Claude\s*$/, "") ||
        "Claude Conversation";

      // Actual selectors from Claude's share pages (as of March 2026):
      // User messages: [data-testid="user-message"] with class !font-user-message
      // Assistant messages: [class*="font-claude-response"] but NOT font-claude-response-body (which is a child)
      const userEls = document.querySelectorAll(
        '[data-testid="user-message"]',
      );
      const assistantEls = document.querySelectorAll(
        '[class*="font-claude-response"]:not([class*="font-claude-response-body"])',
      );

      const all: Array<{ role: "user" | "assistant"; el: Element }> = [];
      userEls.forEach((el) => all.push({ role: "user", el }));
      assistantEls.forEach((el) => all.push({ role: "assistant", el }));

      // Sort by document order
      all.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      const messages = all
        .map(({ role, el }) => {
          const parts: string[] = [];

          const walk = (parent: Element) => {
            for (const child of parent.children) {
              if (child.tagName === "PRE") {
                const code = child.querySelector("code");
                const lang =
                  code?.className?.match(/language-(\w+)/)?.[1] ?? "";
                parts.push(
                  "```" +
                    lang +
                    "\n" +
                    ((code ?? child).textContent?.trim() ?? "") +
                    "\n```",
                );
              } else if (
                ["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6"].includes(
                  child.tagName,
                ) &&
                !child.closest("pre")
              ) {
                const prefix = child.tagName.startsWith("H")
                  ? "#".repeat(parseInt(child.tagName[1])) + " "
                  : "";
                const text = child.textContent?.trim();
                if (text) parts.push(prefix + text);
              } else if (child.tagName === "BLOCKQUOTE") {
                const text = child.textContent?.trim();
                if (text)
                  parts.push(
                    text
                      .split("\n")
                      .map((l) => "> " + l)
                      .join("\n"),
                  );
              } else if (child.children.length > 0) {
                walk(child);
              }
            }
          };

          walk(el);

          const content =
            parts.length > 0
              ? parts.join("\n\n")
              : (el as HTMLElement).innerText?.trim() ?? "";

          return { role, content };
        })
        .filter((m) => m.content);

      return { title, messages };
    });

    // Close the tab, not the browser
    await page.close();

    if (!conversation.messages.length) {
      return errorResponse(url, "Could not find any messages on the page.");
    }

    // Format as markdown for SOT content fallback
    const markdownLines = conversation.messages.map(
      (m) =>
        `**${m.role === "user" ? "User" : "Assistant"}:**\n\n${m.content}`,
    );
    const content = markdownLines.join("\n\n---\n\n");

    return NextResponse.json({
      title: conversation.title,
      content,
      sourceType: "claude",
      sourceUrl: url,
      model: "claude",
      messages: conversation.messages,
    });
  } catch (err) {
    // Close the tab on error, but keep the browser alive
    await page?.close().catch(() => {});
    const message =
      err instanceof Error ? err.message : "Unknown error fetching page";
    return errorResponse(
      url,
      `Failed to load Claude share page: ${message}`,
    );
  }
}
