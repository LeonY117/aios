import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type SotContext } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("returns base prompt when no SOTs are attached", () => {
    const result = buildSystemPrompt();
    expect(result).toContain("You are a helpful AI assistant in AIOS");
    expect(result).not.toContain("<attached_context>");
  });

  it("returns base prompt for empty array", () => {
    const result = buildSystemPrompt([]);
    expect(result).not.toContain("<attached_context>");
  });

  it("includes XML source blocks for attached SOTs", () => {
    const sots: SotContext[] = [
      { title: "Design Doc", content: "Some content", sourceType: "notion" },
    ];
    const result = buildSystemPrompt(sots);
    expect(result).toContain("<attached_context>");
    expect(result).toContain('<source index="1" title="Design Doc" type="notion">');
    expect(result).toContain("Some content");
    expect(result).toContain("</source>");
  });

  it("numbers multiple sources correctly", () => {
    const sots: SotContext[] = [
      { title: "First", content: "aaa", sourceType: "manual" },
      { title: "Second", content: "bbb", sourceType: "github" },
    ];
    const result = buildSystemPrompt(sots);
    expect(result).toContain('index="1"');
    expect(result).toContain('index="2"');
    expect(result).toContain('title="First"');
    expect(result).toContain('title="Second"');
    expect(result).toContain('type="manual"');
    expect(result).toContain('type="github"');
  });

  it("includes the base prompt even with SOTs attached", () => {
    const sots: SotContext[] = [
      { title: "Doc", content: "text", sourceType: "url" },
    ];
    const result = buildSystemPrompt(sots);
    expect(result).toContain("You are a helpful AI assistant in AIOS");
    expect(result).toContain("Reference sources by their title");
  });
});
