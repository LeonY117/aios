import type { Theme } from "./types";

// ---------------------------------------------------------------------------
// Default
// ---------------------------------------------------------------------------

const defaultLight: Theme = {
  id: "default-light",
  name: "Default Light",
  type: "light",
  colors: {
    canvas: "#ffffff",
    surface: "#ffffff",
    "surface-alt": "#f9fafb",
    overlay: "#ffffff",
    line: "#e5e7eb",
    "line-subtle": "#f3f4f6",
    "line-hover": "#d1d5db",
    fg: "#111827",
    "fg-dim": "#4b5563",
    "fg-muted": "#9ca3af",
    "fg-faint": "#d1d5db",
    handle: "#e5e7eb",
    hover: "#f3f4f6",
    accent: "#6366f1",
    "accent-hover": "#4f46e5",
    "accent-surface": "#eef2ff",
    "accent-line": "#a5b4fc",
    "on-accent": "#312e81",
    "accent-handle": "#c7d2fe",
    action: "#3b82f6",
    "action-hover": "#2563eb",
    "action-surface": "#dbeafe",
    selection: "#60a5fa",
    contrast: "#111827",
    "contrast-hover": "#1f2937",
    "contrast-fg": "#ffffff",
    edge: "#94a3b8",
    "edge-active": "#6366f1",
  },
};

const defaultDark: Theme = {
  id: "default-dark",
  name: "Default Dark",
  type: "dark",
  colors: {
    canvas: "#0f172a",
    surface: "#1e293b",
    "surface-alt": "#1a2332",
    overlay: "#1e293b",
    line: "#334155",
    "line-subtle": "#1e293b",
    "line-hover": "#475569",
    fg: "#f1f5f9",
    "fg-dim": "#94a3b8",
    "fg-muted": "#64748b",
    "fg-faint": "#475569",
    handle: "#475569",
    hover: "#334155",
    accent: "#818cf8",
    "accent-hover": "#6366f1",
    "accent-surface": "#1e1b4b",
    "accent-line": "#4f46e5",
    "on-accent": "#e0e7ff",
    "accent-handle": "#3730a3",
    action: "#3b82f6",
    "action-hover": "#2563eb",
    "action-surface": "#172554",
    selection: "#60a5fa",
    contrast: "#f1f5f9",
    "contrast-hover": "#e2e8f0",
    "contrast-fg": "#0f172a",
    edge: "#475569",
    "edge-active": "#818cf8",
  },
};

// ---------------------------------------------------------------------------
// Catppuccin  (https://catppuccin.com/palette)
// ---------------------------------------------------------------------------

const catppuccinLatte: Theme = {
  id: "catppuccin-latte",
  name: "Catppuccin Latte",
  type: "light",
  colors: {
    canvas: "#eff1f5",       // Base
    surface: "#e6e9ef",      // Surface0
    "surface-alt": "#dce0e8", // Mantle
    overlay: "#ccd0da",      // Surface1
    line: "#bcc0cc",         // Surface2
    "line-subtle": "#ccd0da", // Surface1
    "line-hover": "#acb0be", // Overlay0
    fg: "#4c4f69",           // Text
    "fg-dim": "#5c5f77",     // Subtext1
    "fg-muted": "#6c6f85",   // Subtext0
    "fg-faint": "#9ca0b0",   // Overlay1
    handle: "#bcc0cc",       // Surface2
    hover: "#ccd0da",        // Surface1
    accent: "#8839ef",       // Mauve
    "accent-hover": "#7632d1",
    "accent-surface": "#e8ddf5",
    "accent-line": "#b39cdb",
    "on-accent": "#4c4f69",  // Text
    "accent-handle": "#cdbae8",
    action: "#1e66f5",       // Blue
    "action-hover": "#1759d6",
    "action-surface": "#d5e2f9",
    selection: "#1e66f5",    // Blue
    contrast: "#4c4f69",     // Text
    "contrast-hover": "#5c5f77",
    "contrast-fg": "#eff1f5", // Base
    edge: "#9ca0b0",         // Overlay1
    "edge-active": "#8839ef", // Mauve
  },
};

const catppuccinMocha: Theme = {
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  type: "dark",
  colors: {
    canvas: "#1e1e2e",       // Base
    surface: "#313244",      // Surface0
    "surface-alt": "#181825", // Mantle
    overlay: "#45475a",      // Surface1
    line: "#45475a",         // Surface1
    "line-subtle": "#313244", // Surface0
    "line-hover": "#585b70", // Surface2
    fg: "#cdd6f4",           // Text
    "fg-dim": "#bac2de",     // Subtext1
    "fg-muted": "#a6adc8",   // Subtext0
    "fg-faint": "#6c7086",   // Overlay0
    handle: "#585b70",       // Surface2
    hover: "#45475a",        // Surface1
    accent: "#cba6f7",       // Mauve
    "accent-hover": "#b88ef0",
    "accent-surface": "#2a2240",
    "accent-line": "#7c5cad",
    "on-accent": "#cdd6f4",  // Text
    "accent-handle": "#584680",
    action: "#89b4fa",       // Blue
    "action-hover": "#74c7ec", // Sapphire
    "action-surface": "#1e2a3e",
    selection: "#89b4fa",    // Blue
    contrast: "#cdd6f4",     // Text
    "contrast-hover": "#bac2de",
    "contrast-fg": "#1e1e2e", // Base
    edge: "#6c7086",         // Overlay0
    "edge-active": "#cba6f7", // Mauve
  },
};

// ---------------------------------------------------------------------------
// Ayu  (https://github.com/ayu-theme/ayu-colors)
// ---------------------------------------------------------------------------

const ayuLight: Theme = {
  id: "ayu-light",
  name: "Ayu Light",
  type: "light",
  colors: {
    canvas: "#fafafa",
    surface: "#ffffff",
    "surface-alt": "#f0f0f0",
    overlay: "#ffffff",
    line: "#d8d8d2",
    "line-subtle": "#e8e8e4",
    "line-hover": "#c0c0b8",
    fg: "#575f66",
    "fg-dim": "#828c99",
    "fg-muted": "#abb0b6",
    "fg-faint": "#d4d4d4",
    handle: "#d4d4d4",
    hover: "#eaeaea",
    accent: "#ff9940",
    "accent-hover": "#e68830",
    "accent-surface": "#fff3e6",
    "accent-line": "#e6b07a",
    "on-accent": "#575f66",
    "accent-handle": "#f0d4b0",
    action: "#399ee6",
    "action-hover": "#2d8cd4",
    "action-surface": "#e6f2fc",
    selection: "#399ee6",
    contrast: "#575f66",
    "contrast-hover": "#6b737a",
    "contrast-fg": "#fafafa",
    edge: "#c0c4cc",
    "edge-active": "#ff9940",
  },
};

const ayuDark: Theme = {
  id: "ayu-dark",
  name: "Ayu Dark",
  type: "dark",
  colors: {
    canvas: "#0b0e14",
    surface: "#0f131a",
    "surface-alt": "#131721",
    overlay: "#1c212b",
    line: "#1c212b",
    "line-subtle": "#151a23",
    "line-hover": "#2b3240",
    fg: "#bfbdb6",
    "fg-dim": "#9a988e",
    "fg-muted": "#565b66",
    "fg-faint": "#3d424d",
    handle: "#2b3240",
    hover: "#1c212b",
    accent: "#e6b450",
    "accent-hover": "#f2c365",
    "accent-surface": "#1f1a0e",
    "accent-line": "#7a6530",
    "on-accent": "#bfbdb6",
    "accent-handle": "#5c4d2b",
    action: "#39bae6",
    "action-hover": "#59c8ed",
    "action-surface": "#0e1f2e",
    selection: "#39bae6",
    contrast: "#bfbdb6",
    "contrast-hover": "#d4d2cb",
    "contrast-fg": "#0b0e14",
    edge: "#3d424d",
    "edge-active": "#e6b450",
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const themes: Record<string, Theme> = {
  "default-light": defaultLight,
  "default-dark": defaultDark,
  "catppuccin-latte": catppuccinLatte,
  "catppuccin-mocha": catppuccinMocha,
  "ayu-light": ayuLight,
  "ayu-dark": ayuDark,
};

/** Ordered list for the theme picker UI. */
export const themeList: Theme[] = [
  defaultLight,
  defaultDark,
  catppuccinLatte,
  catppuccinMocha,
  ayuLight,
  ayuDark,
];

/** Default pair for "system" auto-switching. */
export const SYSTEM_LIGHT = "default-light";
export const SYSTEM_DARK = "default-dark";
