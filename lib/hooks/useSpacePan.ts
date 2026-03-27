"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages space+pan grab cursor and shift-held body classes.
 *
 * - Holding Space enables left-click panning and shows a grab cursor.
 * - Holding Shift suppresses text selection during multi-select.
 * - Dragging while Space is held shows the grabbing cursor.
 */
export function useSpacePan() {
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const isSpaceHeldRef = useRef(false);

  // Space key → enable left-click pan with grab cursor
  // Shift key → suppress text selection during multi-select
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (e.target as HTMLElement)?.isContentEditable
        )
          return;
        e.preventDefault();
        setIsSpaceHeld(true);
        isSpaceHeldRef.current = true;
        document.body.classList.add("space-held");
      }
      if (e.key === "Shift") {
        document.body.classList.add("shift-held");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceHeld(false);
        isSpaceHeldRef.current = false;
        document.body.classList.remove("space-held", "space-dragging");
      }
      if (e.key === "Shift") {
        document.body.classList.remove("shift-held");
      }
    };
    const onBlur = () => {
      setIsSpaceHeld(false);
      isSpaceHeldRef.current = false;
      document.body.classList.remove(
        "space-held",
        "space-dragging",
        "shift-held",
      );
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.body.classList.remove(
        "space-held",
        "space-dragging",
        "shift-held",
      );
    };
  }, []);

  // Track mouse down/up while space is held for grabbing cursor
  const onMoveStart = useCallback(() => {
    if (isSpaceHeldRef.current) {
      document.body.classList.add("space-dragging");
    }
  }, []);
  const onMoveEnd = useCallback(() => {
    document.body.classList.remove("space-dragging");
  }, []);

  return { isSpaceHeld, onMoveStart, onMoveEnd };
}
