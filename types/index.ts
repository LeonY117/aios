// --- Shared unions ---

export type SourceType = "notion" | "github" | "slack" | "url" | "chatgpt" | "manual" | "file" | "pdf";

export type ChatSourceType = "chatgpt" | "claude" | "manual" | "interactive";

// --- API response types ---

export type SourceResult = {
  title: string;
  content: string;
  sourceType: string;
  sourceUrl: string;
};

export type ChatSourceResult = SourceResult & {
  messages: ChatMessage[];
  model?: string;
};

// --- Node data types ---

export type SotNodeData = {
  title: string;
  content: string;
  sourceType: SourceType;
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
  source: ChatSourceType;
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
