import { ConnectionCoordinator } from "../src/connection-coordinator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Edge, Graph } from "@antv/x6";
import { ConnectionValidators } from "../src/validators";
import { GraphManager } from "../src/graph-manager";

const ports = [
  { group: "in", position: "top" as const, connectionDirection: "both" as const },
  { group: "in", position: "left" as const, connectionDirection: "both" as const },
  { group: "out", position: "bottom" as const, connectionDirection: "both" as const },
  { group: "out", position: "right" as const, connectionDirection: "both" as const },
];
describe("shared connection policy", () => {
  let manager: GraphManager;
  let container: HTMLElement;
  let graph: Graph;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new GraphManager();
    manager.init(container);
    graph = manager.getX6Graph() as Graph;
    manager.registerNodeType(
      { name: "task", typeName: "task" },
      { type: "node", shape: "fd-rect", ports },
    );
    manager.registerNodeType(
      { name: "start", typeName: "start" },
      {
        type: "node",
        shape: "fd-rect",
        ports: ports.map((port) => ({ ...port, connectionDirection: "out" })),
      },
    );
    manager.registerNodeType(
      { name: "end", typeName: "end" },
      {
        type: "node",
        shape: "fd-rect",
        ports: ports.map((port) => ({ ...port, connectionDirection: "in" })),
      },
    );
    for (const [i, type] of ["start", "task", "end"].entries())
      manager.addNode({ id: type, type, x: i * 300, y: 100 });
  });
  afterEach(() => {
    manager.dispose();
    container.remove();
  });
  it("filters typed candidates with pure metadata while refusing incompatible real commits", () => {
    manager.dispose();
    manager = new GraphManager();
    manager.init(container, {
      connecting: { connectionValidator: ConnectionValidators.sameDataType },
    });
    graph = manager.getX6Graph() as Graph;
    const sourcePort = { id: "model", group: "out", position: "right" as const, dataType: "MODEL" };
    const targetPort = { id: "latent", group: "in", position: "left" as const, dataType: "LATENT" };
    for (const [type, definition] of [
      ["source", sourcePort],
      ["target", targetPort],
    ] as const) {
      manager.registerNodeType(
        { name: type, typeName: type },
        { type: "node", shape: "fd-rect", ports: [definition] },
      );
      manager.addNode({ id: type, type, x: type === "source" ? 0 : 300, y: 0 });
    }
    const context = { sourceNode: "source", targetNode: "target", sourcePort, targetPort };
    expect(
      manager.evaluateConnection({ ...context, targetNode: "" }, { phase: "candidate" }),
    ).toEqual({ valid: false, reason: "workbench.connection.incompatible" });
    expect(manager.evaluateConnection(context)).toEqual({
      valid: false,
      reason: "workbench.connection.incompatible",
    });
  });
  it("accepts legacy cell movement payloads and preserves supplied routing edge IDs", () => {
    const payload = { cell: graph.getCellById("task"), routingEdgeIds: ["remote-edge"] };
    expect(() => {
      void graph.trigger("node:moved" as never, payload as never);
    }).not.toThrow();
    expect(payload.routingEdgeIds).toEqual(["remote-edge"]);
    expect(() => {
      void graph.trigger("node:moved" as never, {} as never);
    }).not.toThrow();
  });
  it("evaluates alternative ports without mutating endpoints for rejected candidates", () => {
    const edge = graph.addEdge({
      source: { cell: "task", port: "out-right" },
      target: { cell: "end", port: "in-left" },
    });
    const source = edge.getSource(),
      target = edge.getTarget();
    const admission = new ConnectionCoordinator(
      () => graph,
      new Map([
        ["task", "task"],
        ["end", "end"],
      ]),
      new Map([
        ["task", ports],
        ["end", ports.map((port) => ({ ...port, connectionDirection: "in" as const }))],
      ]),
      new Map(),
      new Map(),
    );
    const check = vi.spyOn(admission, "hasShortConnectionRoute").mockImplementation(() => {
      expect(edge.getSource()).toEqual(source);
      expect(edge.getTarget()).toEqual(target);
      return false;
    });
    const setSource = vi.spyOn(edge, "setSource"),
      setTarget = vi.spyOn(edge, "setTarget");
    expect(admission.tryAlternativeDirectionalPorts(edge)).toBe(false);
    expect(check.mock.calls.length).toBeGreaterThan(1);
    expect(setSource).not.toHaveBeenCalled();
    expect(setTarget).not.toHaveBeenCalled();
  });
  it("commits only the final fallback pair once and does not oscillate on the next reroute", () => {
    graph.getCellById("end").position(300, 400);
    const edge = graph.addEdge({
      source: { cell: "task", port: "out-right" },
      target: { cell: "end", port: "in-left" },
    });
    const admission = new ConnectionCoordinator(
      () => graph,
      new Map([
        ["task", "task"],
        ["end", "end"],
      ]),
      new Map([
        ["task", ports],
        ["end", ports.map((port) => ({ ...port, connectionDirection: "in" as const }))],
      ]),
      new Map(),
      new Map(),
    );
    const originalSource = edge.getSource(),
      originalTarget = edge.getTarget();
    let committed = false;
    vi.spyOn(admission, "hasShortConnectionRoute").mockImplementation((context) => {
      if (!committed) {
        expect(edge.getSource()).toEqual(originalSource);
        expect(edge.getTarget()).toEqual(originalTarget);
      }
      return context.sourcePort.position === "bottom" && context.targetPort.position === "top";
    });
    const source = vi.spyOn(edge, "setSource"),
      target = vi.spyOn(edge, "setTarget");
    admission.autoSwitchEdgePorts(edge, false, false, true);
    committed = true;
    expect(edge.getSourcePortId()).toBe("out-bottom");
    expect(edge.getTargetPortId()).toBe("in-top");
    expect(source).toHaveBeenCalledTimes(1);
    expect(target).toHaveBeenCalledTimes(1);
    source.mockClear();
    target.mockClear();
    admission.autoSwitchEdgePorts(edge, false, false, true);
    expect(source).not.toHaveBeenCalled();
    expect(target).not.toHaveBeenCalled();
  });
  it("never substitutes named typed fields to rescue an impossible fixed-port route", () => {
    const out = { id: "source-field", group: "out", position: "right" as const, dataType: "FLOW" };
    const input = { id: "target-field", group: "in", position: "right" as const, dataType: "FLOW" };
    manager.registerNodeType(
      { name: "typed-source", typeName: "typed-source" },
      { type: "node", shape: "fd-rect", ports: [out] },
    );
    manager.registerNodeType(
      { name: "typed-target", typeName: "typed-target" },
      { type: "node", shape: "fd-rect", ports: [input] },
    );
    manager.addNode({ id: "typed-source", type: "typed-source", x: 0, y: 500 });
    manager.addNode({ id: "typed-target", type: "typed-target", x: 300, y: 500 });
    manager.registerEdgeType("flow", {
      router: { name: "manhattan" },
      connector: { name: "normal" },
    });
    expect(
      manager.resolveConnection({
        sourceNode: "typed-source",
        sourcePort: out,
        targetNode: "typed-target",
        targetPort: input,
      }),
    ).toEqual({ valid: false, reason: "workbench.connection.routeUnavailable" });
  });
  const port = (id: string) => ports.find((p) => `${p.group}-${p.position}` === id)!;
  it("supports every geometric side in both directions while start/end retain semantics", () => {
    for (const p of ports) {
      const id = `${p.group}-${p.position}`;
      expect(
        manager.evaluateConnection({
          sourceNode: "task",
          sourcePort: port(id),
          targetNode: "end",
          targetPort: manager.getPortDefinition("end", id),
        }).valid,
      ).toBe(true);
      expect(
        manager.evaluateConnection({
          sourceNode: "start",
          sourcePort: manager.getPortDefinition("start", id),
          targetNode: "task",
          targetPort: port(id),
        }).valid,
      ).toBe(true);
    }
    expect(
      manager.evaluateConnection({
        sourceNode: "end",
        sourcePort: manager.getPortDefinition("end", "in-left"),
        targetNode: "task",
        targetPort: port("in-left"),
      }).reason,
    ).toBe("workbench.connection.sourceCannotConnect");
    expect(
      manager.evaluateConnection({
        sourceNode: "task",
        sourcePort: port("out-right"),
        targetNode: "start",
        targetPort: manager.getPortDefinition("start", "out-right"),
      }).reason,
    ).toBe("workbench.connection.targetCannotReceive");
    expect(
      manager.evaluateConnection({
        sourceNode: "task",
        sourcePort: null,
        targetNode: "end",
        targetPort: port("in-top"),
      }).valid,
    ).toBe(false);
  });
  it("selects all legal geometric sides without rewriting their existing IDs", () => {
    manager.addNode({ id: "other", type: "task", x: 0, y: 100 });
    manager.addEdge({ id: "directions", source: "task", target: "other" });
    const edge = graph.getCellById("directions") as Edge;
    expect(edge.getSourcePortId()).toBe("in-left");
    expect(edge.getTargetPortId()).toBe("out-right");
  });
  it("keeps an incoming-only blank source reachable with an explicit empty-picker reason", () => {
    const handler = vi.fn();
    graph.on("connection:blank", handler);
    const edge = graph.addEdge({
      source: { cell: "end", port: "in-left" },
      target: { x: 1000, y: 400 },
    });
    graph.trigger("edge:mouseup", { edge });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "workbench.connection.sourceCannotConnect",
        edgeId: edge.id,
      }),
    );
  });
  it("validates commit once and does not emit rejection notifications during hover", () => {
    const handler = vi.fn();
    graph.on("connection:rejected", handler);
    const edge = graph.addEdge({
      source: { cell: "task", port: "out-right" },
      target: { cell: "start", port: "out-right" },
    });
    const validate = graph.options.connecting.validateConnection;
    if (typeof validate !== "function") throw new Error("Missing native connection callback");
    for (let i = 0; i < 5; i++)
      expect(
        validate.call(graph, {
          edge,
          sourceCell: graph.getCellById("task"),
          targetCell: graph.getCellById("start"),
          sourcePort: "out-right",
          targetPort: "out-right",
        } as never),
      ).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(
      graph.options.connecting.validateEdge?.call(graph, {
        edge,
        type: "target",
        previous: { x: 0, y: 0 },
      }),
    ).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it("rejects detaching a saved target to blank so X6 restores its previous terminal", () => {
    const edge = graph.addEdge({
      source: { cell: "task", port: "out-right" },
      target: { x: 1000, y: 400 },
    });
    expect(
      graph.options.connecting.validateEdge?.call(graph, {
        edge,
        type: "target",
        previous: { cell: "end", port: "in-left" },
      }),
    ).toBe(false);
  });
  it("does not intercept blank drops when explicitly configured to ignore them", () => {
    manager.dispose();
    manager.init(container, { connecting: { onBlankDrop: "ignore", allowBlank: true } });
    graph = manager.getX6Graph() as Graph;
    manager.addNode({ id: "source", type: "fd-rect", x: 0, y: 0 });
    const handler = vi.fn();
    graph.on("connection:blank", handler);
    const edge = graph.addEdge({
      source: { cell: "source", port: "right" },
      target: { x: 500, y: 300 },
    });
    graph.trigger("edge:mouseup", { edge });
    expect(handler).not.toHaveBeenCalled();
  });
});
