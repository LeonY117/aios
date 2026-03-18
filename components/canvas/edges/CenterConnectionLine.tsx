"use client";

import {
  getBezierPath,
  Position,
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

  const dx = toX - sourceCenter.x;
  const dy = toY - sourceCenter.y;
  const sourcePos = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top);
  const targetPos = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? Position.Left : Position.Right)
    : (dy > 0 ? Position.Top : Position.Bottom);

  const [path] = getBezierPath({
    sourceX: sourceCenter.x,
    sourceY: sourceCenter.y,
    sourcePosition: sourcePos,
    targetX: toX,
    targetY: toY,
    targetPosition: targetPos,
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
