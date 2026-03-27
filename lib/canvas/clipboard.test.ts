import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyWithFeedback } from "./clipboard";

describe("copyWithFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock navigator.clipboard since it doesn't exist in Node
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls navigator.clipboard.writeText with the text", () => {
    const setCopied = vi.fn();
    copyWithFeedback("hello", setCopied);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("calls setCopied(true) immediately", () => {
    const setCopied = vi.fn();
    copyWithFeedback("hello", setCopied);
    expect(setCopied).toHaveBeenCalledWith(true);
  });

  it("calls setCopied(false) after 2000ms timeout", () => {
    const setCopied = vi.fn();
    copyWithFeedback("hello", setCopied);

    // Before timeout: only true was called
    expect(setCopied).toHaveBeenCalledTimes(1);
    expect(setCopied).toHaveBeenCalledWith(true);

    // Advance past the timeout
    vi.advanceTimersByTime(2000);

    expect(setCopied).toHaveBeenCalledTimes(2);
    expect(setCopied).toHaveBeenLastCalledWith(false);
  });

  it("does not call setCopied(false) before 2000ms", () => {
    const setCopied = vi.fn();
    copyWithFeedback("hello", setCopied);

    vi.advanceTimersByTime(1999);
    expect(setCopied).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(setCopied).toHaveBeenCalledTimes(2);
  });
});
