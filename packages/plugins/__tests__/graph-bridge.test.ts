import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GraphManager } from "@flow-designer/graph";
import { prototypeRegistry } from "@flow-designer/model";
import type { Document } from "@flow-designer/model";
import { GraphBridge, truncateLabel } from "../src/x6-graph/bridge/graph-bridge";
import { setupRegistries, createDocument } from "./test-helpers";

describe("GraphBridge", () => {
  it("keeps short English labels readable in circular nodes", () => {
    expect(truncateLabel("Start", "fd-circle")).toBe("Start");
    expect(truncateLabel("End", "fd-circle")).toBe("End");
    expect(truncateLabel("开始", "fd-circle")).toBe("开始");
  });

  let container: HTMLElement;
  let graphManager: GraphManager;
  let document: Document;
  let bridge: GraphBridge;

  beforeEach(() => {
    setupRegistries();
    container = window.document.createElement("div");
    window.document.body.appendChild(container);
    graphManager = new GraphManager();
    graphManager.init(container);

    const rectPrototype = prototypeRegistry.getPrototypeByType("rect")!;
    graphManager.registerNodeType(
      { name: rectPrototype.getName(), typeName: rectPrototype.getTypeName() },
      rectPrototype.getView(),
    );

    document = createDocument();
    bridge = new GraphBridge(graphManager, document);
  });

  afterEach(() => {
    bridge.teardown();
    graphManager.dispose();
    window.document.body.removeChild(container);
  });

  it("syncs existing nodes to the graph on setup", async () => {
    await document.getContent().addNode({ type: "rect", props: { __position: { x: 10, y: 20 } } });
    bridge.setup();
    const cellIds = graphManager.toJSON().nodes.map((n) => n.id);
    expect(cellIds).toHaveLength(1);
  });

  it("projects each existing relation once during setup", async () => {
    const source = await document.getContent().addNode({ id: "source", type: "rect", props: {} });
    await document.getContent().addNode({ id: "target", type: "rect", props: {} });
    source!.getRelation().addEdge({ id: "edge-1", targetNodeId: "target" });
    const addEdge = vi.spyOn(graphManager, "addEdge");
    bridge.setup();
    expect(addEdge).toHaveBeenCalledTimes(1);
    expect(graphManager.toJSON().edges.map((edge) => edge.id)).toEqual(["edge-1"]);
  });

  it("preserves explicit relation ports during projection and restore", async () => {
    const source = await document.getContent().addNode({ id: "source", type: "rect", props: {} });
    await document.getContent().addNode({ id: "target", type: "rect", props: {} });
    source!
      .getRelation()
      .addEdge({ id: "edge", targetNodeId: "target", sourcePort: "out", targetPort: "in" });
    bridge.setup();
    expect(graphManager.toJSON().edges[0]).toMatchObject({
      source: { cell: "source", port: "out" },
      target: { cell: "target", port: "in" },
    });
    const snapshot = document.getData();
    bridge.resetFromData(snapshot);
    expect(graphManager.toJSON().edges[0]).toMatchObject({
      source: { cell: "source", port: "out" },
      target: { cell: "target", port: "in" },
    });
  });

  it.each(["curve", "orth"])(
    "preserves %s edge type, explicit ports and edited waypoints through undo/redo/load",
    async (type) => {
      graphManager.registerEdgeType("curve", { router: null, connector: { name: "smooth" } });
      graphManager.registerEdgeType("orth", {
        router: { name: "orth" },
        connector: { name: "rounded" },
      });
      bridge.setup();
      document.getTimeline().setApplier((data) => bridge.resetFromData(data as never));
      const source = await document
        .getContent()
        .addNode({ id: "source", type: "rect", props: { __position: { x: 0, y: 0 } } });
      await document
        .getContent()
        .addNode({ id: "target", type: "rect", props: { __position: { x: 300, y: 200 } } });
      source!.getRelation().addEdge({
        id: "typed-edge",
        targetNodeId: "target",
        type,
        sourcePort: "out",
        targetPort: "in",
        vertices: [],
      });
      document.getTimeline().reset();
      const graph = graphManager.getX6Graph() as {
        getCellById(id: string): any;
        trigger(name: string, payload: unknown): void;
      };
      const edge = graph.getCellById("typed-edge");
      const vertices = [
        { x: 150, y: 20 },
        { x: 150, y: 220 },
      ];
      edge.setVertices(vertices);
      graph.trigger("edge:vertices:committed", { edge });
      await Promise.resolve();
      await Promise.resolve();
      const saved = document.getData();
      expect(source!.getRelation().getEdgeById("typed-edge")).toMatchObject({
        type,
        sourcePort: "out",
        targetPort: "in",
        vertices,
      });
      document.getTimeline().back();
      expect(graph.getCellById("typed-edge").getVertices()).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 1));
      document.getTimeline().forward();
      expect(graph.getCellById("typed-edge").getVertices()).toEqual(vertices);
      expect(document.getData()).toEqual(saved);
      document.load(saved);
      expect(graphManager.getEdgeTypeName("typed-edge")).toBe(type);
      expect(graph.getCellById("typed-edge").getSourcePortId()).toBe("out");
      expect(graph.getCellById("typed-edge").getTargetPortId()).toBe("in");
      if (type === "curve") {
        expect(graph.getCellById("typed-edge").getRouter()).toBeFalsy();
        expect(graph.getCellById("typed-edge").getConnector().name).toBe("smooth");
      } else expect(graph.getCellById("typed-edge").getRouter()).toBeTruthy();
    },
  );

  it("retains a single explicit port while choosing the other endpoint port", async () => {
    const source = await document.getContent().addNode({ id: "source", type: "rect", props: {} });
    await document.getContent().addNode({ id: "target", type: "rect", props: {} });
    source!.getRelation().addEdge({ id: "source-port", targetNodeId: "target", sourcePort: "out" });
    source!.getRelation().addEdge({ id: "target-port", targetNodeId: "target", targetPort: "in" });
    bridge.setup();
    const edges = graphManager.toJSON().edges;
    expect(edges).toHaveLength(2);
    for (const edge of edges)
      expect(edge).toMatchObject({
        source: { cell: "source", port: "out" },
        target: { cell: "target", port: "in" },
      });
  });

  it("updates an existing relation on reconnection and persists segment vertices", async () => {
    bridge.setup();
    const source = await document.getContent().addNode({ id: "source", type: "rect", props: {} });
    await document.getContent().addNode({ id: "target", type: "rect", props: {} });
    await document.getContent().addNode({ id: "other", type: "rect", props: {} });
    source!
      .getRelation()
      .addEdge({ id: "edge", targetNodeId: "target", props: { label: "hello" } });
    const graph = graphManager.getX6Graph() as {
      getCellById(id: string): any;
      trigger(name: string, payload: unknown): void;
    };
    const edge = graph.getCellById("edge");
    edge.setTarget({ cell: "other", port: "in" });
    graph.trigger("edge:connected", { edge });
    expect(source!.getRelation().getEdges()).toHaveLength(1);
    expect(source!.getRelation().getEdgeById("edge")).toMatchObject({
      targetNodeId: "other",
      props: { label: "hello" },
    });
    edge.setVertices([{ x: 40, y: 50 }]);
    graph.trigger("edge:vertices:committed", { edge });
    expect(source!.getRelation().getEdgeById("edge")?.vertices).toEqual([{ x: 40, y: 50 }]);
  });

  it("adds a node to the graph when one is added to the model", async () => {
    bridge.setup();
    const node = await document
      .getContent()
      .addNode({ type: "rect", props: { __position: { x: 0, y: 0 } } });
    expect(node).not.toBeNull();
    expect(graphManager.getCellById(node!.getId())).toBeTruthy();
  });

  it("removes a node from the graph when removed from the model", async () => {
    bridge.setup();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    expect(graphManager.getCellById(node!.getId())).toBeTruthy();
    await document.getContent().removeNode(node!);
    expect(graphManager.getCellById(node!.getId())).toBeNull();
  });

  it("propagates model position changes to the graph cell (NodeBridge)", async () => {
    bridge.setup();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    node!.setPosition(50, 60);
    await Promise.resolve();
    await Promise.resolve();
    const cell = graphManager.getCellById(node!.getId()) as {
      position(): { x: number; y: number };
    };
    expect(cell.position()).toEqual({ x: 50, y: 60 });
  });

  it("propagates graph node:moved events back to the model", async () => {
    bridge.setup();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    const cell = graphManager.getCellById(node!.getId()) as {
      position(x: number, y: number): void;
    };
    cell.position(70, 80);
    graphManager.on("node:moved" as never, () => {});
    (
      graphManager as unknown as {
        getX6Graph(): { trigger(event: string, payload: unknown): void };
      }
    )
      .getX6Graph()
      .trigger("node:moved", { cell });
    expect(node!.getPosition()).toEqual({ x: 70, y: 80 });
  });

  it("propagates selection:changed events to the document selection", async () => {
    bridge.setup();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    graphManager.select([node!.getId()]);
    (
      graphManager as unknown as {
        getX6Graph(): { trigger(event: string, payload: unknown): void };
      }
    )
      .getX6Graph()
      .trigger("selection:changed", {});
    expect(document.getSelection().getKeys()).toEqual([node!.getId()]);
  });

  it("resetFromData rebuilds both model and graph", async () => {
    bridge.setup();
    await document.getContent().addNode({ type: "rect", props: {} });

    const snapshotWithTwoNodes = {
      id: "doc-1",
      documentType: "*",
      documentVersion: "1.0.0",
      nodes: [
        { id: "reset-1", typeName: "rect", props: { __position: { x: 1, y: 1 } } },
        { id: "reset-2", typeName: "rect", props: { __position: { x: 2, y: 2 } } },
      ],
    };
    bridge.resetFromData(snapshotWithTwoNodes as never);

    expect(document.getContent().getNodes()).toHaveLength(2);
    expect(graphManager.getCellById("reset-1")).toBeTruthy();
    expect(graphManager.getCellById("reset-2")).toBeTruthy();
  });

  it("teardown stops further model-to-graph sync", async () => {
    bridge.setup();
    bridge.teardown();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    expect(graphManager.getCellById(node!.getId())).toBeNull();
  });

  it("wires up with Timeline so undo/redo replay through resetFromData", async () => {
    document.getTimeline().setApplier((data) => bridge.resetFromData(data as never));
    bridge.setup();

    await document
      .getContent()
      .addNode({ id: "n1", type: "rect", props: { __position: { x: 0, y: 0 } } });
    expect(graphManager.getCellById("n1")).toBeTruthy();

    // TimelinePoint coalesces log() calls within a 300ms window into a single undo step;
    // wait it out so 'n1' and 'n2' land on distinct timeline points.
    await new Promise((resolve) => setTimeout(resolve, 350));

    await document
      .getContent()
      .addNode({ id: "n2", type: "rect", props: { __position: { x: 10, y: 10 } } });
    expect(graphManager.getCellById("n2")).toBeTruthy();

    const existingCell = graphManager.getCellById("n1");
    document.getTimeline().back();
    expect(graphManager.getCellById("n1")).toBe(existingCell);
    expect(graphManager.getCellById("n2")).toBeNull();
    expect(document.getContent().getNodes()).toHaveLength(1);

    document.getTimeline().forward();
    expect(graphManager.getCellById("n1")).toBeTruthy();
    expect(graphManager.getCellById("n2")).toBeTruthy();
    expect(document.getContent().getNodes()).toHaveLength(2);
  }, 10000);

  it("does not push a redundant position update when a graph-originated move is applied (anti-loop)", async () => {
    bridge.setup();
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    const cell = graphManager.getCellById(node!.getId()) as {
      position(x?: number, y?: number): { x: number; y: number } | void;
    };
    cell.position(70, 80);

    const positionSpy = vi.spyOn(cell, "position");
    (
      graphManager as unknown as {
        getX6Graph(): { trigger(event: string, payload: unknown): void };
      }
    )
      .getX6Graph()
      .trigger("node:moved", { cell });

    await Promise.resolve();
    await Promise.resolve();

    expect(node!.getPosition()).toEqual({ x: 70, y: 80 });
    // onNodeMoved itself reads the position once (a getter call, 0 args) to sync it to
    // the model; the echo-suppression must prevent NodeBridge from calling it again as
    // a setter (2 args) once the resulting prop change notification fires.
    const setterCalls = positionSpy.mock.calls.filter((args) => args.length > 0);
    expect(setterCalls).toHaveLength(0);
    positionSpy.mockRestore();
  });

  it("passes the original model node to React and refreshes it after props change", async () => {
    const render = vi.fn((_props: { node: unknown }) => null);
    graphManager.registerNodeType(
      { name: "rect", typeName: "rect" },
      { type: "node", component: render, defaultSize: { width: 120, height: 40 } },
    );
    bridge.setup();
    const node = await document
      .getContent()
      .addNode({ id: "react-model", type: "rect", props: { name: "before" } });
    await vi.waitFor(() =>
      expect(render.mock.calls.some(([props]) => props.node === node)).toBe(true),
    );
    const callsBefore = render.mock.calls.length;
    node!.getProps().setPropData("name", "after");
    await vi.waitFor(() => expect(render.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(render.mock.calls.at(-1)?.[0].node).toBe(node);
  });

  it("renders a custom React component node without throwing", async () => {
    graphManager.registerNodeType(
      { name: "react-node", typeName: "react-node" },
      {
        type: "node",
        component: () => null,
        defaultSize: { width: 120, height: 40 },
        ports: [{ id: "out", group: "out", position: "right" }],
      },
    );

    expect(() => {
      graphManager.addNode({ id: "react-1", type: "react-node", x: 0, y: 0 });
    }).not.toThrow();
    expect(graphManager.getCellById("react-1")).toBeTruthy();
  });

  it("replaces a stencil-dropped cell with a model-backed node (node:added-by-stencil)", async () => {
    bridge.setup();

    const stencilContainer = window.document.createElement("div");
    window.document.body.appendChild(stencilContainer);
    graphManager.createStencil(stencilContainer);

    const graph = graphManager.getX6Graph() as {
      addNode(metadata: unknown, options?: unknown): { id: string };
    };
    graph.addNode(
      { shape: "fd-rect", id: "dropped-1", x: 30, y: 40, data: { __nodeType: "rect" } },
      { stencil: "fake-stencil-id" },
    );

    // The temp dropped cell should be removed immediately...
    expect(graphManager.getCellById("dropped-1")).toBeNull();

    // ...and replaced by a real model node once content.addNode() resolves.
    await new Promise((resolve) => setTimeout(resolve, 1));
    await Promise.resolve();
    await Promise.resolve();

    const nodes = document.getContent().getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].getPosition()).toEqual({ x: 30, y: 40 });
    expect(graphManager.getCellById(nodes[0].getId())).toBeTruthy();
    // Exactly one cell should exist on the canvas — no leftover duplicate from the drop.
    expect(graphManager.toJSON().nodes).toHaveLength(1);
    expect(graphManager.getSelection()).toEqual([nodes[0].getId()]);
    expect(document.getSelection().getKeys()).toEqual([nodes[0].getId()]);

    window.document.body.removeChild(stencilContainer);
  });
});
