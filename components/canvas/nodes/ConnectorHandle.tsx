"use client";

import { Handle, Position, type HandleProps } from "@xyflow/react";

/**
 * Large connector handle with a "+" icon on the side of the node.
 * The Handle sits on the edge of the node for easy click-to-drag.
 * Edges still route center-to-center via the CenterEdge component.
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
      className={`!w-10 !h-10 !bg-transparent !border-0 !rounded-full
        ${isTarget ? "!-left-5" : "!-right-5"}`}
    >
      <div
        className={`absolute inset-0 rounded-full border-2 flex items-center justify-center pointer-events-none transition-all
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
          className={isTarget ? "text-indigo-400" : "text-gray-400"}
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
