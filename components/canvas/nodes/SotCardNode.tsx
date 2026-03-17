"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { SotNodeData } from "@/types";

const sourceBadgeColors: Record<SotNodeData["sourceType"], string> = {
  notion: "bg-gray-800 text-white",
  github: "bg-purple-600 text-white",
  url: "bg-blue-500 text-white",
  manual: "bg-green-600 text-white",
};

function LoadingSkeleton({ data }: { data: SotNodeData }) {
  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {data.title}
        </h3>
        <span
          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
        >
          {data.sourceType}
        </span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

function SotCardNode({ data }: NodeProps & { data: SotNodeData }) {
  if (data.isLoading) {
    return <LoadingSkeleton data={data} />;
  }

  const truncated =
    data.content.length > 200
      ? data.content.slice(0, 200) + "…"
      : data.content;

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {data.title}
        </h3>
        <span
          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeColors[data.sourceType]}`}
        >
          {data.sourceType}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-600">{truncated}</p>
    </div>
  );
}

export default memo(SotCardNode);
