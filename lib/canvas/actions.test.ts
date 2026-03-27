import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  updateNodeData,
  selectAllSots,
  soloSelect,
  addEdgesFromSots,
  removeEdgeBetween,
} from "./actions";

// Minimal node helper — only fields the functions actually check.
function makeNode(id: string, type: string, data: Record<string, unknown> = {}, selected = false): Node {
  return { id, type, data, selected, position: { x: 0, y: 0 } };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

// ---------------------------------------------------------------------------
// updateNodeData
// ---------------------------------------------------------------------------
describe("updateNodeData", () => {
  it("updates the matching node's data", () => {
    const nodes = [
      makeNode("a", "sotCard", { title: "old" }),
      makeNode("b", "chat", { title: "keep" }),
    ];
    const result = updateNodeData(nodes, "a", { title: "new" });
    expect(result[0].data.title).toBe("new");
  });

  it("leaves non-matching nodes unchanged", () => {
    const nodes = [
      makeNode("a", "sotCard", { title: "old" }),
      makeNode("b", "chat", { title: "keep" }),
    ];
    const result = updateNodeData(nodes, "a", { title: "new" });
    expect(result[1]).toBe(nodes[1]);
  });

  it("merges partial patch into existing data", () => {
    const nodes = [makeNode("a", "sotCard", { title: "t", color: "red" })];
    const result = updateNodeData(nodes, "a", { color: "blue" });
    expect(result[0].data).toEqual({ title: "t", color: "blue" });
  });

  it("returns array unchanged when node id is missing", () => {
    const nodes = [makeNode("a", "sotCard", { title: "t" })];
    const result = updateNodeData(nodes, "nonexistent", { title: "new" });
    expect(result[0]).toBe(nodes[0]);
  });
});

// ---------------------------------------------------------------------------
// selectAllSots
// ---------------------------------------------------------------------------
describe("selectAllSots", () => {
  it("selects sotCard and contextBlock nodes", () => {
    const nodes = [
      makeNode("a", "sotCard"),
      makeNode("b", "contextBlock"),
      makeNode("c", "chat"),
    ];
    const result = selectAllSots(nodes);
    expect(result[0].selected).toBe(true);
    expect(result[1].selected).toBe(true);
  });

  it("deselects non-SOT nodes", () => {
    const nodes = [makeNode("c", "chat", {}, true)];
    const result = selectAllSots(nodes);
    expect(result[0].selected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// soloSelect
// ---------------------------------------------------------------------------
describe("soloSelect", () => {
  it("selects only the specified node", () => {
    const nodes = [
      makeNode("a", "sotCard", {}, true),
      makeNode("b", "chat", {}, true),
    ];
    const result = soloSelect(nodes, "b");
    expect(result[0].selected).toBe(false);
    expect(result[1].selected).toBe(true);
  });

  it("deselects all when id does not match any node", () => {
    const nodes = [makeNode("a", "sotCard", {}, true)];
    const result = soloSelect(nodes, "nonexistent");
    expect(result[0].selected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addEdgesFromSots
// ---------------------------------------------------------------------------
describe("addEdgesFromSots", () => {
  it("adds edges from multiple sources to one target", () => {
    const result = addEdgesFromSots([], ["s1", "s2"], "t1");
    expect(result).toHaveLength(2);
    expect(result.some((e) => e.source === "s1" && e.target === "t1")).toBe(true);
    expect(result.some((e) => e.source === "s2" && e.target === "t1")).toBe(true);
  });

  it("skips duplicate edges", () => {
    const existing = [makeEdge("s1", "t1")];
    const result = addEdgesFromSots(existing, ["s1", "s2"], "t1");
    // s1->t1 already existed, so only s2->t1 was added
    const s1Edges = result.filter((e) => e.source === "s1" && e.target === "t1");
    expect(s1Edges).toHaveLength(1);
    expect(result.some((e) => e.source === "s2" && e.target === "t1")).toBe(true);
  });

  it("returns original array contents when all are duplicates", () => {
    const existing = [makeEdge("s1", "t1")];
    const result = addEdgesFromSots(existing, ["s1"], "t1");
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// removeEdgeBetween
// ---------------------------------------------------------------------------
describe("removeEdgeBetween", () => {
  it("removes matching edges", () => {
    const edges = [makeEdge("s1", "t1"), makeEdge("s2", "t1")];
    const result = removeEdgeBetween(edges, "s1", "t1");
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("s2");
  });

  it("keeps non-matching edges untouched", () => {
    const edges = [makeEdge("s1", "t1"), makeEdge("s1", "t2")];
    const result = removeEdgeBetween(edges, "s1", "t1");
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("t2");
  });

  it("returns all edges when no match exists", () => {
    const edges = [makeEdge("s1", "t1")];
    const result = removeEdgeBetween(edges, "x", "y");
    expect(result).toHaveLength(1);
  });
});
