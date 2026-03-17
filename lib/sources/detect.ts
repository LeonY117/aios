export type SourceDetection =
  | { type: "notion" | "github" | "chatgpt" | "url"; url: string }
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
    if (/chatgpt\.com\/share\//.test(href)) {
      return { type: "chatgpt", url: href };
    }

    return { type: "url", url: href };
  } catch {
    return { type: "manual", text: trimmed };
  }
}
