export type SotNodeData = {
  title: string;
  content: string;
  sourceType: "notion" | "github" | "slack" | "url" | "chatgpt" | "manual" | "file" | "pdf";
  sourceUrl?: string;
  pdfUrl?: string;
  isLoading?: boolean;
  isRichText?: boolean;
  isEditing?: boolean;
};

export type ChatSource = {
  url: string;
  title?: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  sources?: ChatSource[];
};

export type AttachedSot = {
  nodeId: string;
  title: string;
  content: string;
  sourceType: string;
  color: string;
};

export type ChatNodeData = {
  title: string;
  source: "chatgpt" | "claude" | "manual" | "interactive";
  model?: string;
  modelId?: string;
  messages: ChatMessage[];
  sourceUrl?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  webSearch?: boolean;
  attachedSots?: AttachedSot[];
};

export type ContextBlockData = {
  title: string;
};
