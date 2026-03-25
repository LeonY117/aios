"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { themes, SYSTEM_LIGHT, SYSTEM_DARK } from "./themes";
import type { Theme, ThemeColors } from "./types";

// ---------------------------------------------------------------------------
// System preference detection (SSR-safe via useSyncExternalStore)
// ---------------------------------------------------------------------------

const DARK_MQ = "(prefers-color-scheme: dark)";

function subscribePref(cb: () => void) {
  const mq = window.matchMedia(DARK_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getPrefSnapshot(): "light" | "dark" {
  return window.matchMedia(DARK_MQ).matches ? "dark" : "light";
}

function getPrefServerSnapshot(): "light" | "dark" {
  return "light";
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_KEY = "aios-theme";
const LS_COLORS_KEY = "aios-theme-colors";

function readSavedTheme(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? "system";
  } catch {
    return "system";
  }
}

function persistTheme(themeId: string, colors: ThemeColors, type: "light" | "dark") {
  try {
    localStorage.setItem(LS_KEY, themeId);
    localStorage.setItem(LS_COLORS_KEY, JSON.stringify(colors));
    localStorage.setItem("aios-theme-type", type);
  } catch {
    // quota exceeded or private browsing
  }
}

// ---------------------------------------------------------------------------
// Apply colors to :root
// ---------------------------------------------------------------------------

function applyColors(colors: ThemeColors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ThemeContextValue = {
  /** The resolved theme object. */
  theme: Theme;
  /** The user's selection — may be "system". */
  themeId: string;
  /** Change the active theme. */
  setTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Use external store to track theme name so that subscribing to
// localStorage changes (e.g. from another tab) is trivial.
let currentThemeId = "system";
const listeners = new Set<() => void>();

function subscribeThemeId(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getThemeIdSnapshot() {
  return currentThemeId;
}

function setThemeIdInternal(id: string) {
  currentThemeId = id;
  for (const cb of listeners) cb();
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const systemPref = useSyncExternalStore(
    subscribePref,
    getPrefSnapshot,
    getPrefServerSnapshot,
  );

  const themeId = useSyncExternalStore(
    subscribeThemeId,
    getThemeIdSnapshot,
    // Server: always "system"
    () => "system",
  );

  // Resolve the actual theme
  const resolved: Theme =
    themeId === "system"
      ? themes[systemPref === "dark" ? SYSTEM_DARK : SYSTEM_LIGHT]
      : themes[themeId] ?? themes[SYSTEM_LIGHT];

  // Apply CSS variables + color-scheme whenever resolved theme changes
  useEffect(() => {
    applyColors(resolved.colors);
    document.documentElement.style.colorScheme = resolved.type;
  }, [resolved]);

  // Initialize from localStorage on mount
  useEffect(() => {
    const saved = readSavedTheme();
    if (saved !== currentThemeId) {
      setThemeIdInternal(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback(
    (id: string) => {
      setThemeIdInternal(id);
      const next =
        id === "system"
          ? themes[systemPref === "dark" ? SYSTEM_DARK : SYSTEM_LIGHT]
          : themes[id] ?? themes[SYSTEM_LIGHT];
      persistTheme(id, next.colors, next.type);
    },
    [systemPref],
  );

  // Persist when system pref flips while in "system" mode
  useEffect(() => {
    if (themeId === "system") {
      persistTheme("system", resolved.colors, resolved.type);
    }
  }, [themeId, systemPref, resolved.colors, resolved.type]);

  return (
    <ThemeContext value={{ theme: resolved, themeId, setTheme }}>
      {children}
    </ThemeContext>
  );
}
