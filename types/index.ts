export type SotNodeData = {
  title: string;
  content: string;
  sourceType: "notion" | "github" | "url" | "manual";
  sourceUrl?: string;
  isLoading?: boolean;
};
