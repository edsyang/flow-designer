import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph, Edge, Node } from "@antv/x6";
import type { GraphEdit, GraphApplicationEvent } from "@flow-designer/core";
import { GraphManager } from "../src/graph-manager";
const ports = [
  { group: "in", position: "top" as const, connectionDirection: "both" as const },
  { group: "in", position: "left" as const, connectionDirection: "both" as const },
  { group: "out", position: "bottom" as const, connectionDirection: "both" as const },
  { group: "out", position: "right" as const, connectionDirection: "both" as const },
];
describe("typed graph adapter", () => {
  let manager: GraphManager, graph: Graph, container: HTMLElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new GraphManager();
    manager.init(container, { snapline: false });
    graph = manager.getX6Graph() as Graph;
    manager.registerNodeType(
      { name: "task", typeName: "business-task" },
      { type: "node", shape: "fd-rect", ports },
    );
    manager.registerEdgeType("flow", {
      router: { name: "manhattan" },
      connector: { name: "normal" },
      schema: [{ name: "name", type: "string", defaultValue: "Flow" }],
      defaultAttrs: { line: { stroke: "red" } },
    });
    for (const [id, x, y] of [
      ["a", 0, 0],
      ["b", 400, 0],
      ["c", 0, 300],
      ["d", 400, 300],
    ] as const)
      manager.addNode({ id, type: "task", x, y });
  });
  afterEach(() => {
    manager.dispose();
    container.remove();
  });
  const addEdge = (manager: GraphManager, id: string, source = "a", target = "b") => {
    manager.addEdge({
      id,
      type: "flow",
      source: { cell: source, port: "out-right" },
      target: { cell: target, port: "in-left" },
    });
    return manager.getCellById(id) as Edge;
  };
  it("publishes corrected node state with connected and explicit remote edges as detached snapshots", () => {
    const incident = addEdge(manager, "incident"),
      remote = addEdge(manager, "remote", "c", "d");
    remote.setVertices([{ x: 240, y: 290 }]);
    const edits: GraphEdit[] = [];
    manager.subscribeEdits((edit) => edits.push(edit));
    const node = manager.getCellById("a") as Node;
    node.position(0, 40);
    const native = vi.fn();
    manager.on("node:moved", native);
    void graph.trigger("node:moved", { node, routingEdgeIds: ["remote", "remote"] });
    expect(native).toHaveBeenCalledOnce();
    expect(edits).toHaveLength(1);
    const edit = edits[0];
    if (edit?.type !== "node-moved") throw new Error("Expected move edit");
    expect(edit.nodeId).toBe("a");
    expect(edit.position).toEqual(node.position());
    expect(edit.edges.map((edge) => edge.edgeId).sort()).toEqual(["incident", "remote"]);
    expect(edit.edges[0]?.sourcePortId).toBe(incident.getSourcePortId());
    expect(edit.edges[0]?.edgeType).toBe("flow");
    const saved = JSON.parse(JSON.stringify(edit));
    remote.setVertices([{ x: 999, y: 999 }]);
    node.position(80, 80);
    expect(edit).toEqual(saved);
    expect(edit.edges[1]?.vertices).toEqual([{ x: 240, y: 290 }]);
  });
  it("publishes resolved ports after successful native validation, retaining native isNew", () => {
    (manager.getCellById("b") as Node).position(0, 180);
    const edge = graph.addEdge({
      source: { cell: "a", port: "out-bottom" },
      target: { cell: "b", port: "out-bottom" },
    });
    const validate = graph.options.connecting.validateEdge!;
    expect(
      validate.call(graph, { edge, type: "target", previous: { x: 0, y: 0 } } as Parameters<
        typeof validate
      >[0]),
    ).toBe(true);
    const edits: GraphEdit[] = [];
    manager.subscribeEdits((edit) => edits.push(edit));
    void graph.trigger("edge:connected", { edge, isNew: true });
    const edit = edits[0];
    if (edit?.type !== "edge-connected") throw new Error("Expected connect edit");
    expect(edit.isNew).toBe(true);
    expect(edit.edge.sourcePortId).toBe(edge.getSourcePortId());
    expect(edit.edge.targetPortId).toBe(edge.getTargetPortId());
    expect(edit.edge.targetPortId).not.toBe("out-bottom");
    expect(edit.edge.edgeType).toBe("flow");
  });
  it("does not publish intermediate vertex changes and copies each semantic completion", () => {
    const edge = addEdge(manager, "edge");
    const edits: GraphEdit[] = [];
    manager.subscribeEdits((edit) => edits.push(edit));
    edge.setVertices([{ x: 210, y: 50 }]);
    expect(edits).toEqual([]);
    void graph.trigger("edge:vertices:committed", { edge });
    expect(edits).toEqual([
      { type: "edge-vertices-edited", edgeId: "edge", vertices: [{ x: 210, y: 50 }] },
    ]);
    edge.setVertices([]);
    expect(edits[0]).toMatchObject({ vertices: [{ x: 210, y: 50 }] });
  });
  it("captures stencil prototype and local position before native consumers remove the clone", () => {
    const edits: GraphEdit[] = [];
    manager.subscribeEdits((edit) => edits.push(edit));
    const clone = graph.addNode({
      shape: "rect",
      x: 90,
      y: 100,
      data: { __nodeType: "business-task" },
    });
    manager.on("node:added-by-stencil", () => manager.removeCell(clone.id));
    void graph.trigger("node:added-by-stencil", { cell: clone });
    expect(edits).toEqual([
      {
        type: "node-dropped",
        nodeType: "business-task",
        temporaryNodeId: clone.id,
        position: { x: 90, y: 100 },
      },
    ]);
    expect(manager.getCellById(clone.id)).toBeNull();
  });
  it("patches only existing projected nodes/ports without emitting persistent gestures", () => {
    const edits = vi.fn();
    manager.subscribeEdits(edits);
    const node = manager.getCellById("a") as Node;
    const position = vi.spyOn(node, "position");
    manager.patchNode({ nodeId: "a", position: { x: 0, y: 0 } });
    expect(position).toHaveBeenCalledTimes(1);
    manager.patchNode({
      nodeId: "a",
      position: { x: 40, y: 50 },
      label: "Localized",
      portLabels: [
        { portId: "in-top", label: "Input" },
        { portId: "missing", label: "Ignore" },
      ],
    });
    expect(node.position()).toEqual({ x: 40, y: 50 });
    expect(node.attr("label/text")).toBe("Localized");
    expect(node.getPortProp("in-top", "attrs/title/text")).toBe("Input");
    expect(node.hasPort("missing")).toBe(false);
    expect(edits).not.toHaveBeenCalled();
    expect(() => manager.patchNode({ nodeId: "missing", label: "Ignore" })).not.toThrow();
    expect(manager.getNodePorts("a")).toEqual(ports);
    expect(manager.getNodePorts("missing")).toEqual([]);
    expect(manager.getEdgeTypeMetadata("flow")).toEqual({
      schema: [{ name: "name", type: "string", defaultValue: "Flow" }],
    });
    expect(manager.getEdgeTypeMetadata("missing")).toBeNull();
  });
  it("normalizes application notifications without exposing native events or cells", () => {
    const events: GraphApplicationEvent[] = [];
    manager.subscribeEvents((event) => events.push(event));
    void graph.trigger("blank:dblclick", { e: { clientX: 12, clientY: 34 }, x: 56, y: 78 });
    expect(events.pop()).toEqual({
      type: "blank-double-clicked",
      clientPosition: { x: 12, y: 34 },
      graphPosition: { x: 56, y: 78 },
    });
    const edge = addEdge(manager, "edge");
    void graph.trigger("edge:click", { edge });
    expect(events.pop()).toEqual({ type: "edge-clicked", edgeId: "edge" });
    const native = vi.fn();
    manager.on("connection:rejected", native);
    manager.notifyConnectionRejected({
      valid: false,
      sourceNode: "a",
      targetNode: "b",
      reason: "workbench.connection.incompatible",
    });
    expect(native).toHaveBeenCalledOnce();
    expect(events.pop()).toEqual({
      type: "connection-rejected",
      valid: false,
      sourceNode: "a",
      targetNode: "b",
      reason: "workbench.connection.incompatible",
    });
    manager.select(["a"]);
    expect(events.pop()).toEqual({ type: "selection-changed", ids: ["a"] });
    void graph.trigger("connection:blank", {
      sourceCellId: "a",
      sourcePortId: "out-right",
      edgeId: "temp",
      x: 4,
      y: 5,
    });
    expect(events.pop()).toEqual({
      type: "connection-blank",
      sourceNodeId: "a",
      sourcePortId: "out-right",
      temporaryEdgeId: "temp",
      graphPosition: { x: 4, y: 5 },
    });
  });
  it("clears subscriptions on dispose and stale unsubscribe cannot remove a new registration", () => {
    const listener = vi.fn();
    const stop = manager.subscribeEvents(listener);
    manager.dispose();
    manager.init(container, { snapline: false });
    graph = manager.getX6Graph() as Graph;
    void graph.trigger("blank:click", {});
    expect(listener).not.toHaveBeenCalled();
    manager.subscribeEvents(listener);
    stop();
    stop();
    void graph.trigger("blank:click", {});
    expect(listener).toHaveBeenCalledOnce();
  });
  it("detaches all native notification listeners even if native disposal fails, isolating late events", () => {
    const oldGraph = graph;
    const edge = addEdge(manager, "old-edge");
    const off = vi.spyOn(oldGraph, "off");
    const nativeDispose = vi.spyOn(oldGraph, "dispose").mockImplementationOnce(() => {
      throw new Error("native dispose failure");
    });
    expect(() => manager.dispose()).toThrow("native dispose failure");
    expect(off).toHaveBeenCalledWith("blank:click", expect.any(Function));
    expect(off).toHaveBeenCalledWith("edge:vertices:committed", expect.any(Function));
    manager.init(container);
    const events = vi.fn(),
      edits = vi.fn();
    manager.subscribeEvents(events);
    manager.subscribeEdits(edits);
    void oldGraph.trigger("blank:click", {});
    void oldGraph.trigger("edge:vertices:committed", { edge });
    void oldGraph.trigger("edge:connected", { edge, isNew: true });
    expect(events).not.toHaveBeenCalled();
    expect(edits).not.toHaveBeenCalled();
    nativeDispose.mockRestore();
    off.mockRestore();
    oldGraph.dispose();
  });
  it("freezes final snapshots and detaches nested metadata defaults", () => {
    const edge = addEdge(manager, "edge");
    let saved: GraphEdit | undefined;
    manager.subscribeEdits((edit) => {
      saved = edit;
    });
    edge.setVertices([{ x: 1, y: 2 }]);
    void graph.trigger("edge:vertices:committed", { edge });
    expect(Object.isFrozen(saved)).toBe(true);
    if (saved?.type !== "edge-vertices-edited") throw new Error("Expected vertices");
    expect(Object.isFrozen(saved.vertices)).toBe(true);
    expect(Object.isFrozen(saved.vertices[0])).toBe(true);
    const defaults = { nested: { value: "original" } };
    manager.registerEdgeType("nested", {
      schema: [{ name: "config", type: "json", defaultValue: defaults }],
    });
    const metadata = manager.getEdgeTypeMetadata("nested");
    (metadata?.schema?.[0]?.defaultValue as typeof defaults).nested.value = "changed";
    expect(defaults.nested.value).toBe("original");
    manager.registerNodeType(
      { name: "no-ports", typeName: "no-ports" },
      { type: "node", shape: "fd-rect" },
    );
    manager.addNode({ id: "no-ports", type: "no-ports", x: 0, y: 0 });
    expect(manager.getNodePorts("no-ports")).toEqual([]);
  });
  it("publishes all already-supported selected-node gesture positions in one final DTO", () => {
    addEdge(manager, "incident");
    addEdge(manager, "remote", "c", "d");
    manager.select(["a", "c"]);
    const a = manager.getCellById("a") as Node,
      c = manager.getCellById("c") as Node;
    const edits: GraphEdit[] = [];
    manager.subscribeEdits((edit) => edits.push(edit));
    void graph.trigger("node:mousedown", { node: a });
    a.position(20, 0);
    c.position(20, 300);
    void graph.trigger("node:moving", { node: a, e: { clientX: 400, clientY: 400 } });
    void graph.trigger("node:moved", { node: a });
    const moves = edits.filter((edit) => edit.type === "node-moved");
    expect(moves).toHaveLength(1);
    const move = moves[0];
    if (move?.type !== "node-moved") throw new Error("Expected move");
    expect(move.nodes).toEqual([
      { nodeId: "a", position: { x: 20, y: 0 } },
      { nodeId: "c", position: { x: 20, y: 300 } },
    ]);
    expect(move.edges.map((edge) => edge.edgeId).sort()).toEqual(["incident", "remote"]);
  });
});
