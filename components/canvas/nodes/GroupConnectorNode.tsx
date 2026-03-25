"use client";

import ConnectorHandle from "./ConnectorHandle";

/**
 * Invisible proxy node that provides a real React Flow <Handle> for the group
 * connector. Positioned at the right-center of the multi-selection bounding box.
 * The node itself is a small transparent box — only the ConnectorHandle is visible.
 */
export default function GroupConnectorNode() {
  return (
    <div
      style={{
        width: 1,
        height: 1,
        // Invisible but still in the DOM for the Handle to attach to
        background: "transparent",
        border: "none",
        pointerEvents: "none",
      }}
    >
      <ConnectorHandle type="source" />
    </div>
  );
}
