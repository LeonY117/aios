import { NextResponse } from "next/server";
import { extract } from "@extractus/article-extractor";
import TurndownService from "turndown";

function parseOgTags(html: string): { title?: string; description?: string } {
  const titleMatch = html.match(
    /<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/,
  );
  const descMatch = html.match(
    /<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/,
  );
  return {
    title: titleMatch?.[1]?.replace(/&amp;/g, "&"),
    description: descMatch?.[1]?.replace(/&amp;/g, "&"),
  };
}

function extractHtmlContent(html: string): string | null {
  // Look for SSR HTML content in Next.js RSC payloads (e.g. Granola notes)
  // These contain escaped HTML like \u003ch3\u003e in __next_f script blocks
  const rscBlocks = html.match(
    /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g,
  );
  if (!rscBlocks) return null;

  for (const block of rscBlocks) {
    const match = block.match(
      /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/,
    );
    if (!match?.[1]) continue;

    // Unescape the JSON string content
    let content: string;
    try {
      content = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }

    // Check if this block contains meaningful HTML content (headings + lists)
    if (content.includes("<h3>") && content.includes("<li>")) {
      return content;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const { url } = await request.json();

  try {
    const article = await extract(url);
    const turndown = new TurndownService();

    if (article?.content) {
      return NextResponse.json({
        title: article.title || url,
        content: turndown.turndown(article.content),
        sourceType: "url",
        sourceUrl: url,
      });
    }

    // Fallback: fetch raw HTML and try OG tags + embedded content
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AIOS/1.0)" },
    });
    const html = await res.text();
    const og = parseOgTags(html);

    // Try to extract embedded HTML content (works for Granola, some SPAs)
    const embeddedHtml = extractHtmlContent(html);
    if (embeddedHtml) {
      return NextResponse.json({
        title: og.title || url,
        content: turndown.turndown(embeddedHtml),
        sourceType: "url",
        sourceUrl: url,
      });
    }

    // Last resort: OG description
    if (og.title || og.description) {
      return NextResponse.json({
        title: og.title || url,
        content: og.description || "No content could be extracted.",
        sourceType: "url",
        sourceUrl: url,
      });
    }

    return NextResponse.json({
      title: url,
      content: "Could not extract content from this URL.",
      sourceType: "url",
      sourceUrl: url,
    });
  } catch {
    return NextResponse.json({
      title: url,
      content: "Failed to fetch or extract content from this URL.",
      sourceType: "url",
      sourceUrl: url,
    });
  }
}
