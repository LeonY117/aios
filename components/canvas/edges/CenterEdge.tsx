"use client";

import {
  getBezierPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";

export default function CenterEdge({
  id,
  source,
  target,
  style,
  markerEnd,
  markerStart,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sourceCenter = {
    x: sourceNode.internals.positionAbsolute.x + (sourceNode.measured.width ?? 0) / 2,
    y: sourceNode.internals.positionAbsolute.y + (sourceNode.measured.height ?? 0) / 2,
  };

  const targetCenter = {
    x: targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? 0) / 2,
    y: targetNode.internals.positionAbsolute.y + (targetNode.measured.height ?? 0) / 2,
  };

  const [edgePath] = getBezierPath({
    sourceX: sourceCenter.x,
    sourceY: sourceCenter.y,
    targetX: targetCenter.x,
    targetY: targetCenter.y,
  });

  return (
    <>
      {/* Wide invisible path for easier click/hover target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      <path
        id={id}
        d={edgePath}
        fill="none"
        className="react-flow__edge-path"
        stroke={style?.stroke ?? "#94a3b8"}
        strokeWidth={1.5}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
    </>
  );
}
