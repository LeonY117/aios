"use client";

import { useEffect } from "react";

type ShortcutActions = {
  addTextBlock: () => void;
  addLinkNode: () => void;
  addChatNode: () => void;
  addContextBlock: () => void;
  doSave: () => void;
  flushDebouncedSave: () => void;
  selectAll: () => void;
};

/**
 * Registers global keyboard shortcuts for the canvas:
 * - T / L / C / B  — create text block, link, chat, context block
 * - Cmd+S           — save
 * - Cmd+A           — select all SOT nodes
 *
 * All shortcuts are suppressed when an input/textarea/contentEditable has focus.
 */
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Single-key shortcuts (no modifier) for node creation
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          // Don't intercept typing in text fields
        } else {
          switch (e.key.toLowerCase()) {
            case "t":
              e.preventDefault();
              actions.addTextBlock();
              return;
            case "l":
              e.preventDefault();
              actions.addLinkNode();
              return;
            case "c":
              e.preventDefault();
              actions.addChatNode();
              return;
            case "b":
              e.preventDefault();
              actions.addContextBlock();
              return;
          }
        }
      }

      if (!e.metaKey && !e.ctrlKey) return;

      // Cmd+S — save
      if (e.key === "s") {
        e.preventDefault();
        actions.flushDebouncedSave();
        actions.doSave();
        return;
      }

      // Cmd+A — select all SOT nodes (skip if input is focused)
      if (e.key === "a") {
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        actions.selectAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
