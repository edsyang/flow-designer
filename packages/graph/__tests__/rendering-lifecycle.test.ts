import { Keyboard } from "@antv/x6-plugin-keyboard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graph, type Node } from "@antv/x6";
import type { ReactElement } from "react";
import type { ContentNode } from "@flow-designer/model";
import { register } from "@antv/x6-react-shape";
import { createRoot } from "react-dom/client";
import { GraphManager } from "../src/graph-manager";

vi.mock("@antv/x6-react-shape", async (original) => ({
  ...(await original<typeof import("@antv/x6-react-shape")>()),
  register: vi.fn(),
}));
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })),
}));

describe("GraphManager React resource lifecycle", () => {
  let manager: GraphManager;
  let container: HTMLElement;
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new GraphManager();
    manager.init(container);
  });
  afterEach(() => {
    manager.dispose();
    container.remove();
  });
  it("releases replaced labels once and ignores their stale cleanup after a newer mount", () => {
    manager.registerEdgeType("label", { component: () => null });
    manager.setEdgeTypeName("edge", "label");
    const graph = manager.getX6Graph() as Graph;
    const mount = document.createElement("div");
    const args = {
      edge: { id: "edge", getData: () => ({ name: "first" }) },
      label: {},
      container: mount,
    };
    const render = graph.options.onEdgeLabelRendered!;
    const first = render(args as Parameters<typeof render>[0]);
    const oldRoot = vi.mocked(createRoot).mock.results[0]!.value;
    const second = render(args as Parameters<typeof render>[0]);
    const newRoot = vi.mocked(createRoot).mock.results[1]!.value;
    expect(oldRoot.unmount).toHaveBeenCalledTimes(1);
    first?.(args as Parameters<typeof render>[0]);
    expect(newRoot.unmount).not.toHaveBeenCalled();
    manager.dispose();
    expect(oldRoot.unmount).toHaveBeenCalledTimes(1);
    expect(newRoot.unmount).toHaveBeenCalledTimes(1);
    second?.(args as Parameters<typeof render>[0]);
    manager.dispose();
    expect(newRoot.unmount).toHaveBeenCalledTimes(1);
  });
  it("reads current model references and selection, and clears references across cell removal and reinit", () => {
    manager.registerNodeType(
      { name: "react-test", typeName: "test" },
      { type: "node", shape: "fd-rect", component: () => null },
    );
    const registration = vi.mocked(register).mock.calls[0]![0];
    const adapter = registration.component as (args: { node: Node; graph: Graph }) => ReactElement<{
      node: ContentNode | undefined;
      selected: boolean;
      data: Record<string, unknown>;
    }>;
    let graph = manager.getX6Graph() as Graph;
    const first = { id: "model1" },
      second = { id: "model2" };
    manager.addNode({
      id: "node",
      type: "react-test",
      x: 0,
      y: 0,
      data: { contentNode: first, title: "first" },
    });
    let node = manager.getCellById("node") as Node;
    expect(adapter({ node, graph }).props).toMatchObject({
      node: first,
      selected: false,
      data: { title: "first" },
    });
    manager.updateNodeData("node", { contentNode: second, title: "second" });
    manager.select(["node"]);
    expect(adapter({ node, graph }).props).toMatchObject({
      node: second,
      selected: true,
      data: { title: "second" },
    });
    expect(adapter({ node, graph }).props.data).not.toHaveProperty("__modelVersion");
    manager.removeCell("node");
    expect(adapter({ node, graph }).props.node).toBeUndefined();
    manager.addNode({ id: "node", type: "react-test", x: 0, y: 0, data: { contentNode: second } });
    manager.dispose();
    expect(adapter({ node, graph }).props.node).toBeUndefined();
    manager.init(container);
    graph = manager.getX6Graph() as Graph;
    manager.addNode({ id: "node", type: "react-test", x: 0, y: 0 });
    node = manager.getCellById("node") as Node;
    expect(adapter({ node, graph }).props.node).toBeUndefined();
    expect(manager.getStencilNodeGroups()[0]?.items[0]?.type).toBe("react-test");
  });
  it("cleans an initialization failure after plugins and observers were acquired, retaining the original error", () => {
    manager.dispose();
    manager.registerNodeType(
      { name: "reusable", typeName: "reusable" },
      { type: "node", shape: "fd-rect" },
    );
    const failure = new Error("keyboard init failed");
    const init = Keyboard.prototype.init;
    const nativeDispose = Keyboard.prototype.dispose;
    const dispose = vi.spyOn(Keyboard.prototype, "dispose").mockImplementationOnce(function () {
      nativeDispose.call(this);
      throw new Error("secondary plugin cleanup failure");
    });
    const graphCleanupFailure = new Error("secondary graph cleanup failure");
    const nativeGraphDispose = Graph.prototype.dispose;
    const graphDispose = vi.spyOn(Graph.prototype, "dispose").mockImplementationOnce(function () {
      nativeGraphDispose.call(this);
      throw graphCleanupFailure;
    });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const remove = vi.spyOn(window, "removeEventListener");
    const pluginInit = vi
      .spyOn(Keyboard.prototype, "init")
      .mockImplementationOnce(function (graph) {
        init.call(this, graph);
        throw failure;
      });
    try {
      expect(() => manager.init(container)).toThrow(failure);
      expect(manager.getX6Graph()).toBeNull();
      expect(dispose).toHaveBeenCalled();
      expect(graphDispose).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        "[flow-designer] plugin initialization cleanup failed:",
        expect.any(Error),
      );
      expect(report).toHaveBeenCalledWith(
        "[flow-designer] graph initialization cleanup failed:",
        graphCleanupFailure,
      );
      expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(container.querySelector("svg")).toBeNull();
      expect(() => manager.dispose()).not.toThrow();
    } finally {
      report.mockRestore();
      pluginInit.mockRestore();
      dispose.mockRestore();
      graphDispose.mockRestore();
      remove.mockRestore();
    }
    manager.init(container);
    expect(manager.getStencilNodeGroups()[0]?.items[0]?.type).toBe("reusable");
  });
  it("continues all resource cleanup after an unmount failure and remains reusable", () => {
    manager.registerNodeType(
      { name: "reusable", typeName: "reusable" },
      { type: "node", shape: "fd-rect" },
    );
    manager.registerEdgeType("label", { component: () => null });
    manager.addNode({
      id: "node",
      type: "reusable",
      x: 0,
      y: 0,
      data: { contentNode: { id: "model" } },
    });
    const graph = manager.getX6Graph() as Graph;
    const render = graph.options.onEdgeLabelRendered!;
    for (const id of ["first", "second"]) {
      manager.setEdgeTypeName(id, "label");
      render({
        edge: { id, getData: () => ({}) },
        label: {},
        container: document.createElement("div"),
      } as Parameters<typeof render>[0]);
    }
    const first = vi.mocked(createRoot).mock.results[0]!.value;
    const second = vi.mocked(createRoot).mock.results[1]!.value;
    const failure = new Error("unmount failed");
    first.unmount.mockImplementationOnce(() => {
      throw failure;
    });
    const nativeGraphDispose = graph.dispose;
    const graphFailure = new Error("graph dispose failed");
    const graphDispose = vi.spyOn(graph, "dispose").mockImplementationOnce(function () {
      nativeGraphDispose.call(this);
      throw graphFailure;
    });
    try {
      let reported: unknown;
      try {
        manager.dispose();
      } catch (error) {
        reported = error;
      }
      expect(reported).toMatchObject({ errors: [graphFailure, failure] });
      expect(graphDispose).toHaveBeenCalledTimes(1);
      expect(first.unmount).toHaveBeenCalledTimes(1);
      expect(second.unmount).toHaveBeenCalledTimes(1);
      expect(manager.getX6Graph()).toBeNull();
      expect(manager.getEdgeTypeName("first")).toBeNull();
      expect(() => manager.dispose()).not.toThrow();
      manager.init(container);
      expect(manager.getStencilNodeGroups()[0]?.items[0]?.type).toBe("reusable");
      expect(manager.toJSON().nodes).toEqual([]);
    } finally {
      graphDispose.mockRestore();
    }
  });
});
