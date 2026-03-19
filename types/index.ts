export type SotNodeData = {
  title: string;
  content: string;
  sourceType: "notion" | "github" | "slack" | "url" | "chatgpt" | "manual";
  sourceUrl?: string;
  isLoading?: boolean;
  isRichText?: boolean;
  isEditing?: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
};

export type ChatNodeData = {
  title: string;
  source: "chatgpt" | "claude" | "manual";
  model?: string;
  messages: ChatMessage[];
  sourceUrl?: string;
  isLoading?: boolean;
};

export type ContextBlockData = {
  title: string;
};
