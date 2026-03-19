"use client";

import { Handle, Position, type HandleProps } from "@xyflow/react";

/**
 * Large connector handle with a "+" icon at the bottom corner of the node.
 * Hidden by default, fades in when the parent node is hovered.
 */
export default function ConnectorHandle({
  type,
  ...props
}: Omit<HandleProps, "position"> & { position?: HandleProps["position"] }) {
  const isTarget = type === "target";

  return (
    <Handle
      type={type}
      position={isTarget ? Position.Left : Position.Right}
      {...props}
      className="!w-10 !h-10 !bg-transparent !border-0 !rounded-full !cursor-pointer connector-handle"
      style={{
        top: "50%",
        bottom: "auto",
        ...(isTarget
          ? { left: "-20px", right: "auto" }
          : { right: "-20px", left: "auto" }),
        transform: "translateY(-50%)",
      }}
    >
      <div
        className={`connector-handle-visual absolute inset-0 rounded-full border-2 flex items-center justify-center pointer-events-none
          opacity-0 scale-90 transition-all duration-200 ease-out
          ${
            isTarget
              ? "bg-indigo-50 border-indigo-300"
              : "bg-white border-gray-300"
          }
          shadow-sm`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={isTarget ? "text-indigo-400" : "text-gray-300"}
        >
          <path
            d="M7 2v10M2 7h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Handle>
  );
}
