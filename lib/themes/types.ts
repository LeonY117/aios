/** Semantic color tokens that define a complete AIOS theme. */
export type ThemeColors = {
  // Canvas
  canvas: string;

  // Surfaces
  surface: string;
  "surface-alt": string;
  overlay: string;

  // Borders
  line: string;
  "line-subtle": string;
  "line-hover": string;

  // Text
  fg: string;
  "fg-dim": string;
  "fg-muted": string;
  "fg-faint": string;

  // Interactive chrome
  handle: string;
  hover: string;

  // Primary accent (context blocks, focus rings, primary CTA)
  accent: string;
  "accent-hover": string;
  "accent-surface": string;
  "accent-line": string;
  "on-accent": string;
  "accent-handle": string;

  // Secondary accent (action buttons like "Add to chat")
  action: string;
  "action-hover": string;
  "action-surface": string;

  // Selection ring
  selection: string;

  // High-contrast (send button)
  contrast: string;
  "contrast-hover": string;
  "contrast-fg": string;

  // Connection lines
  edge: string;
  "edge-active": string;
};

export type Theme = {
  id: string;
  name: string;
  type: "light" | "dark";
  colors: ThemeColors;
};
