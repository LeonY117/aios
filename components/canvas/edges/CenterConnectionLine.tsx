"use client";

import {
  getBezierPath,
  useInternalNode,
  type ConnectionLineComponentProps,
} from "@xyflow/react";

export default function CenterConnectionLine({
  fromNode,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const sourceNode = useInternalNode(fromNode.id);

  if (!sourceNode) return null;

  const sourceCenter = {
    x: sourceNode.internals.positionAbsolute.x + (sourceNode.measured.width ?? 0) / 2,
    y: sourceNode.internals.positionAbsolute.y + (sourceNode.measured.height ?? 0) / 2,
  };

  const [path] = getBezierPath({
    sourceX: sourceCenter.x,
    sourceY: sourceCenter.y,
    targetX: toX,
    targetY: toY,
  });

  return (
    <path
      d={path}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={1.5}
      className="animated"
    />
  );
}
