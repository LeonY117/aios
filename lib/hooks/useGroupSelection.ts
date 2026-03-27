"use client";

import { useEffect } from "react";
import { useStore, useStoreApi, type Node } from "@xyflow/react";
import { GROUP_CONNECTOR_ID } from "@/lib/canvas/constants";

/**
 * Manages the ephemeral group-connector proxy node that appears when 2+
 * SOT nodes are selected and the marquee selection is complete.
 *
 * Also toggles `nodesSelectionActive` in the React Flow store when the
 * selection count crosses the threshold of 2.
 *
 * @param nodes       Current nodes array from useNodesState
 * @param setNodesRaw Raw setNodes (bypasses the dragHandle wrapper)
 */
export function useGroupSelection(
  nodes: Node[],
  setNodesRaw: (updater: Node[] | ((prev: Node[]) => Node[])) => void,
) {
  const store = useStoreApi();

  // Show group selection box when 2+ nodes are selected (e.g. via Shift+click)
  useEffect(() => {
    const selectedCount = nodes.filter((n) => n.selected).length;
    const { nodesSelectionActive } = store.getState();
    if (selectedCount >= 2 && !nodesSelectionActive) {
      store.setState({ nodesSelectionActive: true });
    } else if (selectedCount < 2 && nodesSelectionActive) {
      store.setState({ nodesSelectionActive: false });
    }
  }, [nodes, store]);

  // Manage ephemeral group-connector proxy node: appears when 2+ SOTs selected
  // AND marquee selection is complete (not while still dragging to select).
  const userSelectionActive = useStore((s) => s.userSelectionActive);

  useEffect(() => {
    // Don't show handle while user is still drawing the selection rectangle
    if (userSelectionActive) {
      setNodesRaw((nds) => {
        if (!nds.some((n) => n.id === GROUP_CONNECTOR_ID)) return nds;
        return nds.filter((n) => n.id !== GROUP_CONNECTOR_ID);
      });
      return;
    }

    const selected = nodes.filter(
      (n) => n.selected && n.id !== GROUP_CONNECTOR_ID,
    );
    const selectedSotCount = selected.filter(
      (n) => n.type === "sotCard" || n.type === "contextBlock",
    ).length;

    if (selectedSotCount >= 2) {
      // Compute bounding box of ALL selected nodes (matches selection rect)
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const n of selected) {
        const w = n.measured?.width ?? (n.style?.width as number) ?? 280;
        const h = n.measured?.height ?? (n.style?.height as number) ?? 360;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      const centerY = (minY + maxY) / 2;

      setNodesRaw((nds) => {
        const existing = nds.find((n) => n.id === GROUP_CONNECTOR_ID);
        if (existing) {
          // Update position if changed
          if (
            existing.position.x === maxX &&
            existing.position.y === centerY
          ) {
            return nds;
          }
          return nds.map((n) =>
            n.id === GROUP_CONNECTOR_ID
              ? { ...n, position: { x: maxX, y: centerY } }
              : n,
          );
        }
        // Add proxy node
        return [
          ...nds,
          {
            id: GROUP_CONNECTOR_ID,
            type: "groupConnector",
            position: { x: maxX, y: centerY },
            data: {},
            selectable: false,
            draggable: false,
            focusable: false,
            zIndex: 10000,
          },
        ];
      });
    } else {
      // Remove proxy if present
      setNodesRaw((nds) => {
        if (!nds.some((n) => n.id === GROUP_CONNECTOR_ID)) return nds;
        return nds.filter((n) => n.id !== GROUP_CONNECTOR_ID);
      });
    }
  }, [nodes, setNodesRaw, userSelectionActive]);
}
