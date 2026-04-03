import { useEffect } from "react";

/**
 * Calls `handler` when the Escape key is pressed.
 * Uses capture phase so the handler fires before other listeners.
 */
export function useEscapeKey(handler: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handler();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [handler]);
}
