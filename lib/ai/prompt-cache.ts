/**
 * Anthropic prompt caching utilities.
 *
 * Adds cache breakpoints to the system prompt and conversation history
 * so Anthropic reuses cached prefixes instead of re-processing them.
 * OpenAI handles prefix caching automatically — these functions are
 * no-ops for non-Anthropic providers.
 */

import type { SystemModelMessage, ModelMessage } from "ai";
import type { ModelProvider } from "./models";

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

/**
 * Wrap a system prompt with an Anthropic cache breakpoint.
 * Returns the plain string for non-Anthropic providers.
 */
export function withSystemCacheBreakpoint(
  systemPrompt: string,
  provider: ModelProvider,
): string | SystemModelMessage {
  if (provider !== "anthropic") return systemPrompt;

  return {
    role: "system",
    content: systemPrompt,
    providerOptions: ANTHROPIC_CACHE_CONTROL,
  };
}

/**
 * Add a cache breakpoint to the second-to-last message so all prior
 * conversation history is cached. Returns the array unchanged for
 * non-Anthropic providers or conversations with fewer than 2 messages.
 */
export function withHistoryCacheBreakpoint(
  messages: ModelMessage[],
  provider: ModelProvider,
): ModelMessage[] {
  if (provider !== "anthropic" || messages.length < 2) return messages;

  const breakpointIndex = messages.length - 2;

  return messages.map((msg, i) => {
    if (i !== breakpointIndex) return msg;
    return {
      ...msg,
      providerOptions: {
        ...msg.providerOptions,
        ...ANTHROPIC_CACHE_CONTROL,
      },
    };
  });
}
