"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

type MaximizePortalProps = {
  children: React.ReactNode;
  onClose: () => void;
};

export default function MaximizePortal({
  children,
  onClose,
}: MaximizePortalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Block wheel events at the native level so React Flow's canvas doesn't scroll
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center animate-[fadeIn_0.15s_ease]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Content */}
      <div
        className="maximize-portal relative flex h-[80vh] w-[80vw] flex-col rounded-xl border border-line bg-surface shadow-2xl animate-[scaleIn_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
