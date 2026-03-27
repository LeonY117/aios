import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import MarkdownIt from "markdown-it";
import { sourceErrorResponse, missingEnvResponse } from "@/lib/sources/helpers";

const md = new MarkdownIt();

/** Convert markdown inside <details> blocks to HTML so nested lists render. */
function renderDetailsContent(content: string): string {
  return content.replace(
    /(<details>\s*<summary>.*?<\/summary>)([\s\S]*?)(<\/details>)/g,
    (_match, open: string, body: string, close: string) =>
      `${open}\n${md.render(body.trim())}\n${close}`,
  );
}

// Notion URLs contain a 32-char hex ID (with or without dashes)
const PAGE_ID_RE = /([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;

function extractPageId(url: string): string | null {
  const match = url.match(PAGE_ID_RE);
  if (!match) return null;
  // Strip dashes to get a clean 32-char hex ID
  return match[1].replace(/-/g, "");
}

function getPageTitle(page: Record<string, unknown>): string {
  const properties = page.properties as Record<string, { type: string; title?: Array<{ plain_text: string }> }> | undefined;
  if (!properties) return "Untitled";

  for (const prop of Object.values(properties)) {
    if (prop.type === "title" && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
  }
  return "Untitled";
}

export async function POST(request: Request) {
  const { url } = await request.json();

  const pageId = extractPageId(url);
  if (!pageId) {
    return sourceErrorResponse(url, "notion", "**Could not parse Notion URL.** Expected a Notion page link.");
  }

  const token = process.env.NOTION_API_TOKEN;
  if (!token) {
    return missingEnvResponse(url, "notion", "NOTION_API_TOKEN", "Create an integration at https://www.notion.so/my-integrations and share the page with it.");
  }

  const notion = new Client({ auth: token });
  const n2m = new NotionToMarkdown({
    notionClient: notion,
    config: { parseChildPages: false },
  });

  try {
    const [page, mdBlocks] = await Promise.all([
      notion.pages.retrieve({ page_id: pageId }),
      n2m.pageToMarkdown(pageId),
    ]);

    const title = getPageTitle(page as unknown as Record<string, unknown>);
    const mdString = n2m.toMarkdownString(mdBlocks);
    const content = typeof mdString === "string" ? mdString : mdString.parent;

    return NextResponse.json({
      title,
      content: renderDetailsContent(content) || "*(empty page)*",
      sourceType: "notion",
      sourceUrl: url,
    });
  } catch {
    return sourceErrorResponse(url, "notion", "**Failed to fetch Notion page.** Make sure the page is shared with your integration and the URL is correct.");
  }
}
