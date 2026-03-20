/**
 * Client-side model list and utilities.
 * The display names shown in the dropdown (no server deps).
 */

export type ClientModelConfig = {
  id: string;
  name: string;
};

/** Static list matching the server-side MODELS in lib/ai/models.ts */
export const ALL_MODELS: ClientModelConfig[] = [
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6" },
  { id: "claude-opus-4-6", name: "Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5" },
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
];

export const DEFAULT_MODEL_ID = "claude-haiku-4-5-20251001";

export function getModelName(modelId: string): string {
  return ALL_MODELS.find((m) => m.id === modelId)?.name ?? modelId;
}
