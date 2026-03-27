import { describe, it, expect } from "vitest";
import { detectSource } from "./detect";

describe("detectSource", () => {
  it("detects Notion URLs (notion.so)", () => {
    const result = detectSource("https://www.notion.so/my-page-abc123");
    expect(result.type).toBe("notion");
  });

  it("detects Notion URLs (notion.site)", () => {
    const result = detectSource("https://team.notion.site/Page-123");
    expect(result.type).toBe("notion");
  });

  it("detects GitHub PR URLs", () => {
    const result = detectSource("https://github.com/owner/repo/pull/42");
    expect(result.type).toBe("github");
  });

  it("detects GitHub issue URLs", () => {
    const result = detectSource("https://github.com/owner/repo/issues/7");
    expect(result.type).toBe("github");
  });

  it("detects Slack message URLs", () => {
    const result = detectSource(
      "https://workspace.slack.com/archives/C04ABCDEF/p1700000000000000"
    );
    expect(result.type).toBe("slack");
  });

  it("detects ChatGPT share URLs", () => {
    const result = detectSource("https://chatgpt.com/share/abc-123");
    expect(result.type).toBe("chatgpt");
  });

  it("detects Claude share URLs", () => {
    const result = detectSource("https://claude.ai/share/abc-123");
    expect(result.type).toBe("claude");
  });

  it("returns 'url' for generic URLs", () => {
    const result = detectSource("https://example.com/article");
    expect(result.type).toBe("url");
    if (result.type !== "manual") {
      expect(result.url).toBe("https://example.com/article");
    }
  });

  it("returns 'manual' for non-URL text", () => {
    const result = detectSource("just some plain text");
    expect(result.type).toBe("manual");
    if (result.type === "manual") {
      expect(result.text).toBe("just some plain text");
    }
  });

  it("returns 'manual' for non-http protocols", () => {
    const result = detectSource("ftp://files.example.com/doc");
    expect(result.type).toBe("manual");
  });

  it("trims whitespace before detection", () => {
    const result = detectSource("  https://example.com/page  ");
    expect(result.type).toBe("url");
  });
});
