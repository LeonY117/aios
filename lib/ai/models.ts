import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";

export type ModelProvider = "anthropic" | "openai";

export type ModelCapability = "web-search" | "vision" | "thinking";

export type ModelConfig = {
  id: string;
  provider: ModelProvider;
  name: string;
  capabilities: ModelCapability[];
  /** The env var that must be set for this model to be available */
  envKey: string;
};

export const MODELS: ModelConfig[] = [
  // Anthropic
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    name: "Claude Sonnet 4.6",
    capabilities: ["web-search", "vision"],
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-opus-4-6",
    provider: "anthropic",
    name: "Claude Opus 4.6",
    capabilities: ["web-search", "vision", "thinking"],
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    capabilities: ["web-search", "vision"],
    envKey: "ANTHROPIC_API_KEY",
  },
  // OpenAI
  {
    id: "gpt-4.1",
    provider: "openai",
    name: "GPT-4.1",
    capabilities: ["web-search", "vision"],
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    name: "GPT-4.1 Mini",
    capabilities: ["web-search", "vision"],
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gpt-4.1-nano",
    provider: "openai",
    name: "GPT-4.1 Nano",
    capabilities: ["web-search"],
    envKey: "OPENAI_API_KEY",
  },
];

/** Returns only models whose API key is configured */
export function getAvailableModels(): ModelConfig[] {
  return MODELS.filter((m) => !!process.env[m.envKey]);
}

/** Get the AI SDK model instance for a given model ID */
export function getModel(modelId: string) {
  const config = MODELS.find((m) => m.id === modelId);
  if (!config) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  if (!process.env[config.envKey]) {
    throw new Error(
      `API key not configured. Set ${config.envKey} in .env.local`
    );
  }

  switch (config.provider) {
    case "anthropic":
      return anthropic(config.id);
    case "openai":
      return openai(config.id);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/** Get tools for a given model (e.g., web search) */
export function getToolsForModel(
  config: ModelConfig,
  options: { webSearch?: boolean } = {}
): ToolSet {
  const tools: ToolSet = {};

  if (options.webSearch && config.capabilities.includes("web-search")) {
    if (config.provider === "anthropic") {
      tools.web_search = anthropic.tools.webSearch_20260209();
    }
    // OpenAI web search is passed differently — handled in the route
  }

  return tools;
}
