"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

type EditableTitleProps = {
  title: string;
  onChange: (title: string) => void;
  className?: string;
};

export default function EditableTitle({
  title,
  onChange,
  className = "text-sm font-semibold text-gray-900",
}: EditableTitleProps) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (focused || !ref.current) return;
    if (ref.current.textContent !== title) {
      ref.current.textContent = title;
    }
  }, [title, focused]);

  const commit = useCallback(() => {
    const text = ref.current?.textContent?.trim() ?? "";
    if (text && text !== title) {
      onChange(text);
    } else if (ref.current) {
      ref.current.textContent = title;
    }
  }, [title, onChange]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        }
        if (e.key === "Escape") {
          if (ref.current) ref.current.textContent = title;
          ref.current?.blur();
        }
      }}
      className={`nodrag outline-none cursor-text rounded-sm px-1 -mx-1 line-clamp-2 ${focused ? "shadow-[inset_0_0_0_1px_#d1d5db] bg-gray-50/50 line-clamp-none" : ""} ${className}`}
    />
  );
}
