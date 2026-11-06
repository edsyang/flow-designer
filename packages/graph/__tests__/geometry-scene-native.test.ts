import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph, Node } from "@antv/x6";
import { GraphManager } from "../src/graph-manager";
import { geometrySceneFor } from "../src/edge-routing";

describe("native geometry scene integration", () => {
  let manager: GraphManager, graph: Graph, container: HTMLElement;
  const ports = [
    { group: "out", position: "right" as const, connectionDirection: "both" as const },
    { group: "in", position: "left" as const, connectionDirection: "both" as const },
  ];
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new GraphManager();
    manager.init(container);
    graph = manager.getX6Graph() as Graph;
    graph.options.async = false;
    manager.registerNodeType(
      { name: "task", typeName: "task" },
      { type: "node", shape: "fd-rect", ports },
    );
    manager.registerEdgeType("flow", { router: { name: "manhattan" } });
    manager.addNode({ id: "source", type: "task", x: 0, y: 0 });
    manager.addNode({ id: "target", type: "task", x: 400, y: 0 });
  });
  afterEach(() => {
    manager.dispose();
    container.remove();
  });
  it("reuses admission geometry in the native renderer, then invalidates bounds/ports/reset", async () => {
    const scene = geometrySceneFor(graph),
      context = {
        sourceNode: "source",
        targetNode: "target",
        sourcePort: ports[0]!,
        targetPort: ports[1]!,
      };
    expect(manager.evaluateConnection(context).valid).toBe(true);
    const misses = scene.metrics.planMisses,
      hits = scene.metrics.planHits;
    manager.addEdge({
      id: "edge",
      type: "flow",
      source: { cell: "source", port: "out-right" },
      target: { cell: "target", port: "in-left" },
    });
    await vi.waitFor(() => expect(scene.getRendered("edge")?.status).toBe("valid"));
    expect(scene.metrics.planHits).toBeGreaterThan(hits);
    expect(scene.metrics.planMisses).toBe(misses);
    const original = scene.getRendered("edge")!;
    expect(original.source.portId).toBe("out-right");
    const target = manager.getCellById("target") as Node;
    target.resize(200, 70);
    await vi.waitFor(() =>
      expect(scene.getRendered("edge")!.revision).toBeGreaterThan(original.revision),
    );
    const resized = scene.snapshot().revision;
    target.setPortProp("in-left", "attrs/title/text", "Input");
    expect(scene.snapshot().revision).toBeGreaterThan(resized);
    manager.resetCells([], []);
    expect(scene.boxes.size).toBe(0);
    expect(scene.getRendered("edge")).toBeUndefined();
  });
  it("retains an observable legacy-degraded plan and its strict policy failure", async () => {
    manager.addEdge({
      id: "legacy",
      type: "flow",
      source: { cell: "source", port: "out-right" },
      target: { cell: "target", port: "out-right" },
    });
    const scene = geometrySceneFor(graph);
    await vi.waitFor(() => expect(scene.getRendered("legacy")?.status).toBe("legacy-degraded"));
    const plan = scene.getRendered("legacy")!;
    expect(["blocked-within-policy", "budget-exhausted"]).toContain(plan.strictStatus);
    expect(plan.points.length).toBeGreaterThan(1);
    const view = graph.findViewByCell("legacy");
    expect(view?.container.getAttribute("data-routing-plan-status")).toBe("legacy-degraded");
    expect(view?.container.getAttribute("data-routing-policy-failure")).toBe(plan.strictStatus);
  });
});
