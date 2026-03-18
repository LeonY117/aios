export type SourceDetection =
  | { type: "notion" | "github" | "slack" | "chatgpt" | "claude" | "url"; url: string }
  | { type: "manual"; text: string };

export function detectSource(text: string): SourceDetection {
  const trimmed = text.trim();

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { type: "manual", text: trimmed };
    }

    const href = url.href;

    if (/notion\.(so|site)\//.test(href)) {
      return { type: "notion", url: href };
    }
    if (/github\.com\/.+\/(pull|issues)\/\d+/.test(href)) {
      return { type: "github", url: href };
    }
    if (/\.slack\.com\/archives\/[A-Z0-9]+\/p\d+/.test(href)) {
      return { type: "slack", url: href };
    }
    if (/chatgpt\.com\/share\//.test(href)) {
      return { type: "chatgpt", url: href };
    }
    if (/claude\.ai\/share\//.test(href)) {
      return { type: "claude", url: href };
    }

    return { type: "url", url: href };
  } catch {
    return { type: "manual", text: trimmed };
  }
}
