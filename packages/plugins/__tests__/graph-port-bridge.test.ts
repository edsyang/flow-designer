import { describe, expect, it, vi } from "vitest";
import type {
  EdgeConfig,
  GraphApplicationEvent,
  GraphEdit,
  GraphPort,
  NodeConfig,
} from "@flow-designer/core";
import { prototypeRegistry } from "@flow-designer/model";
import { applyCanvasGraphEdit } from "../src/x6-graph/commands";
import { GraphBridge } from "../src/x6-graph/bridge/graph-bridge";
import { createDocument, setupRegistries } from "./test-helpers";

function projection() {
  const nodes = new Map<string, NodeConfig>();
  const edges = new Map<string, EdgeConfig>();
  const edits = new Set<(edit: GraphEdit) => void>();
  const events = new Set<(event: GraphApplicationEvent) => void>();
  let selected: string[] = [];
  const patchNode = vi.fn<GraphPort["patchNode"]>();
  const graph: GraphPort = {
    addNode: (node) => {
      nodes.set(node.id, node);
      return node.id;
    },
    addEdge: (edge) => {
      edges.set(edge.id, edge);
      return edge.id;
    },
    updateEdge: (edge) => {
      edges.set(edge.id, edge);
    },
    removeCell: (id) => {
      nodes.delete(id);
      edges.delete(id);
    },
    resetCells: (nextNodes, nextEdges) => {
      nodes.clear();
      edges.clear();
      nextNodes.forEach((node) => nodes.set(node.id, node));
      nextEdges.forEach((edge) => edges.set(edge.id, edge));
    },
    batchUpdate: (operation) => operation(),
    patchNode,
    updateNodeData: vi.fn(),
    select: (ids) => {
      selected = [...ids];
      for (const listener of events) listener({ type: "selection-changed", ids: [...ids] });
    },
    getSelection: () => [...selected],
    zoomTo: vi.fn(),
    getZoom: () => 1,
    centerContent: vi.fn(),
    zoomToFit: vi.fn(),
    resize: vi.fn(),
    clientToLocal: (x, y) => ({ x, y }),
    localToClient: (x, y) => ({ x, y }),
    setInteractionMode: vi.fn(),
    getInteractionMode: () => "pan",
    getNodePorts: (id) =>
      prototypeRegistry.getPrototypeByName(nodes.get(id)?.type ?? "")?.getPorts() ?? [],
    getPortDefinition: (_id, port) => ({
      id: port,
      group: "out",
      position: "right",
      connectionDirection: "both",
    }),
    getEdgeTypeName: (id) => edges.get(id)?.type ?? null,
    getDefaultEdgeType: () => "curve",
    getEdgeTypeMetadata: () => ({
      schema: [{ name: "name", type: "string", defaultValue: "Connection" }],
    }),
    checkConnection: () => true,
    evaluateConnection: () => ({ valid: true }),
    resolveConnection: () => ({ valid: true }),
    subscribeEdits: (listener) => {
      edits.add(listener);
      return () => {
        edits.delete(listener);
      };
    },
    subscribeEvents: (listener) => {
      events.add(listener);
      return () => {
        events.delete(listener);
      };
    },
    notifyConnectionRejected: vi.fn(),
  };
  return {
    graph,
    nodes,
    edges,
    patchNode,
    edits,
    events,
    edit: (edit: GraphEdit) => {
      for (const listener of edits) listener(edit);
    },
    event: (event: GraphApplicationEvent) => {
      for (const listener of events) listener(event);
    },
  };
}
async function fixture() {
  setupRegistries();
  const document = createDocument();
  const source = await document.getContent().addNode({ id: "source", type: "rect" });
  await document.getContent().addNode({ id: "target", type: "rect" });
  await document.getContent().addNode({ id: "obstacle", type: "rect" });
  const port = projection();
  const bridge = new GraphBridge(port.graph, document);
  bridge.setup();
  return {
    ...port,
    document,
    source: source!,
    bridge,
    dispose: () => {
      bridge.teardown();
      document.destroy();
    },
  };
}
describe("bridge through the core graph port", () => {
  it("persists finalized movement and a nonconnected reroute in one reversible gesture", async () => {
    const state = await fixture();
    try {
      state.source.getRelation().addEdge({
        id: "remote",
        targetNodeId: "target",
        type: "curve",
        sourcePort: "before",
        vertices: [{ x: 1, y: 2 }],
      });
      await Promise.resolve();
      state.document.getTimeline().reset();
      const before = state.document.getData();
      state.edit({
        type: "node-moved",
        nodeId: "obstacle",
        position: { x: 90, y: 80 },
        edges: [
          {
            edgeId: "remote",
            edgeType: "curve",
            sourceNodeId: "source",
            targetNodeId: "target",
            sourcePortId: "resolved-source",
            targetPortId: "resolved-target",
            vertices: [{ x: 70, y: 40 }],
          },
        ],
      });
      await Promise.resolve();
      await vi.waitFor(() => expect(state.document.getTimeline().getPoints()).toHaveLength(2));
      expect(state.source.getRelation().getEdgeById("remote")).toMatchObject({
        type: "curve",
        sourcePort: "resolved-source",
        targetPort: "resolved-target",
        vertices: [{ x: 70, y: 40 }],
      });
      expect(state.document.getContent().getNode("obstacle")?.getPosition()).toEqual({
        x: 90,
        y: 80,
      });
      const after = state.document.getData();
      state.document.getTimeline().back();
      expect(state.document.getData()).toEqual(before);
      state.document.getTimeline().forward();
      expect(state.document.getData()).toEqual(after);
    } finally {
      state.dispose();
    }
  });
  it("updates nodes through projection patches and does not echo a finalized position", async () => {
    const state = await fixture();
    try {
      state.patchNode.mockClear();
      state.source.setPosition(40, 50);
      await Promise.resolve();
      await Promise.resolve();
      expect(state.patchNode).toHaveBeenCalledWith({
        nodeId: "source",
        position: { x: 40, y: 50 },
      });
      state.patchNode.mockClear();
      state.edit({ type: "node-moved", nodeId: "source", position: { x: 70, y: 80 }, edges: [] });
      await Promise.resolve();
      await Promise.resolve();
      expect(state.patchNode).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      state.dispose();
    }
  });
  it("uses connection/vertices snapshots and metadata without an adapter or native cell", async () => {
    const state = await fixture();
    try {
      state.document.getTimeline().reset();
      state.edit({
        type: "edge-connected",
        edge: {
          edgeId: "new",
          edgeType: "curve",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "target",
          targetPortId: "in",
          vertices: [{ x: 30, y: 40 }],
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(state.source.getRelation().getEdgeById("new")).toMatchObject({
        type: "curve",
        props: { name: "Connection" },
        vertices: [{ x: 30, y: 40 }],
      });
      expect(state.edges.get("new")).toMatchObject({
        source: { cell: "source", port: "out" },
        target: { cell: "target", port: "in" },
        labels: [],
      });
      state.edit({ type: "edge-vertices-edited", edgeId: "new", vertices: [{ x: 60, y: 70 }] });
      await Promise.resolve();
      await vi.waitFor(() =>
        expect(state.source.getRelation().getEdgeById("new")?.vertices).toEqual([{ x: 60, y: 70 }]),
      );
    } finally {
      state.dispose();
    }
  });
  it("compensates a newly committed relation when projection fails, without native graph access", async () => {
    const state = await fixture();
    try {
      const report = vi.fn();
      state.bridge.teardown();
      const bridge = new GraphBridge(state.graph, state.document, report);
      bridge.setup();
      state.document.getTimeline().reset();
      const before = state.document.getData();
      state.graph.select(["target"]);
      const error = new Error("projection failed");
      vi.spyOn(state.graph, "updateEdge").mockImplementationOnce(() => {
        throw error;
      });
      state.edit({
        type: "edge-connected",
        edge: {
          edgeId: "failed",
          edgeType: "curve",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "target",
          targetPortId: "in",
          vertices: [],
        },
      });
      await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error));
      expect(state.document.getData()).toEqual(before);
      expect(state.source.getRelation().getEdgeById("failed")).toBeNull();
      expect(state.document.getSelection().getKeys()).toEqual(["target"]);
      expect(state.document.getTimeline().getPoints()).toHaveLength(1);
      expect(state.graph.notifyConnectionRejected).toHaveBeenCalledWith({
        valid: false,
        reason: "workbench.connection.incompatible",
        sourceNode: "source",
        targetNode: "target",
      });
      bridge.teardown();
    } finally {
      state.dispose();
    }
  });
  it("commits group positions and curve endpoints/vertices as one undoable operation", async () => {
    const state = await fixture();
    try {
      state.source.getRelation().addEdge({
        id: "curve",
        type: "curve",
        targetNodeId: "target",
        sourcePort: "out",
        targetPort: "in",
        vertices: [{ x: 1, y: 2 }],
      });
      state.document.getTimeline().reset();
      const before = state.document.save();
      await applyCanvasGraphEdit({
        document: state.document,
        graph: state.graph,
        edit: {
          type: "node-moved",
          nodeId: "source",
          position: { x: 30, y: 40 },
          nodes: [
            { nodeId: "source", position: { x: 30, y: 40 } },
            { nodeId: "target", position: { x: 70, y: 80 } },
          ],
          edges: [
            {
              edgeId: "curve",
              edgeType: "curve",
              sourceNodeId: "source",
              targetNodeId: "target",
              sourcePortId: "right",
              targetPortId: "left",
              vertices: [{ x: 50, y: 60 }],
            },
          ],
        },
      });
      expect(state.document.getTimeline().getPoints()).toHaveLength(2);
      const after = state.document.getData();
      state.document.getTimeline().back();
      expect(state.document.getData()).toEqual(before);
      state.document.getTimeline().forward();
      expect(state.document.getData()).toEqual(after);
      expect(state.source.getRelation().getEdgeById("curve")).toMatchObject({
        type: "curve",
        sourcePort: "right",
        targetPort: "left",
        vertices: [{ x: 50, y: 60 }],
      });
    } finally {
      state.dispose();
    }
  });

  it("reconnects source owner and vertices in one transaction and restores on projection failure", async () => {
    const state = await fixture();
    try {
      state.source.getRelation().addEdge({
        id: "curve",
        type: "curve",
        targetNodeId: "target",
        props: { name: "custom" },
        vertices: [{ x: 1, y: 2 }],
      });
      state.document.getTimeline().reset();
      const before = state.document.save();
      const edit: GraphEdit = {
        type: "edge-connected",
        edge: {
          edgeId: "curve",
          edgeType: "curve",
          sourceNodeId: "obstacle",
          targetNodeId: "target",
          sourcePortId: "out",
          targetPortId: "in",
          vertices: [{ x: 4, y: 5 }],
        },
      };
      vi.spyOn(state.graph, "updateEdge").mockImplementationOnce(() => {
        throw new Error("projection failed");
      });
      await expect(
        applyCanvasGraphEdit({ document: state.document, graph: state.graph, edit }),
      ).rejects.toThrow("projection failed");
      expect(state.document.getData()).toEqual(before);
      expect(state.edges.get("curve")).toMatchObject({
        source: "source",
        target: "target",
        type: "curve",
        vertices: [{ x: 1, y: 2 }],
      });
      expect(state.document.isModified()).toBe(false);
      expect(state.document.getTimeline().getPoints()).toHaveLength(1);
      await applyCanvasGraphEdit({ document: state.document, graph: state.graph, edit });
      expect(state.source.getRelation().getEdgeById("curve")).toBeNull();
      expect(
        state.document.getContent().getNode("obstacle")!.getRelation().serialize(),
      ).toMatchObject([
        { id: "curve", type: "curve", props: { name: "custom" }, vertices: [{ x: 4, y: 5 }] },
      ]);
      state.document.getTimeline().back();
      expect(state.document.getData()).toEqual(before);
    } finally {
      state.dispose();
    }
  });

  it("preserves a same-ID external relation replacement and unrelated edits when projection throws", async () => {
    const state = await fixture();
    try {
      state.document.getTimeline().reset();
      vi.spyOn(state.graph, "updateEdge").mockImplementationOnce(() => {
        state.source.getRelation().addEdge({
          id: "owned",
          type: "external",
          targetNodeId: "obstacle",
          props: { name: "external" },
        });
        state.document.getContent().getNode("obstacle")!.setPosition(777, 888);
        throw new Error("projection failed");
      });
      await expect(
        applyCanvasGraphEdit({
          document: state.document,
          graph: state.graph,
          edit: {
            type: "edge-connected",
            edge: {
              edgeId: "owned",
              sourceNodeId: "source",
              targetNodeId: "target",
              sourcePortId: "out",
              targetPortId: "in",
              vertices: [],
            },
          },
        }),
      ).rejects.toThrow("projection failed");
      expect(state.source.getRelation().getEdgeById("owned")).toMatchObject({
        type: "external",
        targetNodeId: "obstacle",
      });
      expect(state.edges.get("owned")).toMatchObject({
        source: "source",
        target: "obstacle",
        type: "external",
      });
      expect(state.document.getContent().getNode("obstacle")!.getPosition()).toEqual({
        x: 777,
        y: 888,
      });
      expect(state.document.getTimeline().getPoints()).toHaveLength(2);
    } finally {
      state.dispose();
    }
  });

  it("restores graph positions and vertices after an observer rejects an edit", async () => {
    const state = await fixture();
    try {
      state.source.getRelation().addEdge({
        id: "curve",
        type: "curve",
        targetNodeId: "target",
        vertices: [{ x: 1, y: 2 }],
      });
      state.document.getTimeline().reset();
      const before = state.document.save();
      let reject = true;
      const off = state.source.getRelation().onChange(() => {
        if (reject) {
          reject = false;
          throw new Error("observer rejected");
        }
      });
      await expect(
        applyCanvasGraphEdit({
          document: state.document,
          graph: state.graph,
          edit: {
            type: "node-moved",
            nodeId: "source",
            position: { x: 100, y: 200 },
            edges: [
              {
                edgeId: "curve",
                edgeType: "curve",
                sourceNodeId: "source",
                targetNodeId: "target",
                vertices: [{ x: 300, y: 400 }],
              },
            ],
          },
        }),
      ).rejects.toThrow("observer rejected");
      off();
      expect(state.document.getData()).toEqual(before);
      expect(state.patchNode).toHaveBeenLastCalledWith({
        nodeId: "source",
        position: state.source.getPosition(),
      });
      expect(state.edges.get("curve")).toMatchObject({ type: "curve", vertices: [{ x: 1, y: 2 }] });
      expect(state.document.isModified()).toBe(false);
      expect(state.document.getTimeline().getPoints()).toHaveLength(1);
    } finally {
      state.dispose();
    }
  });

  it("keeps no-op gesture redo and saved identity intact", async () => {
    const state = await fixture();
    try {
      state.document.getTimeline().reset();
      const move = (x: number) =>
        applyCanvasGraphEdit({
          document: state.document,
          graph: state.graph,
          edit: { type: "node-moved", nodeId: "source", position: { x, y: 0 }, edges: [] },
        });
      await move(50);
      state.document.getTimeline().back();
      state.document.save();
      await move(0);
      expect(state.document.isModified()).toBe(false);
      expect(state.document.getTimeline().getPoints()).toHaveLength(2);
      state.document.getTimeline().forward();
      expect(state.source.getPosition()).toEqual({ x: 50, y: 0 });
    } finally {
      state.dispose();
    }
  });

  it("keeps stencil coordinates top-left and selects the real model node", async () => {
    const state = await fixture();
    try {
      await applyCanvasGraphEdit({
        document: state.document,
        graph: state.graph,
        edit: {
          type: "node-dropped",
          nodeType: "rect",
          temporaryNodeId: "temporary",
          position: { x: 321, y: 123 },
        },
      });
      const id = state.document.getSelection().getKeys()[0]!;
      expect(id).not.toBe("temporary");
      expect(state.document.getContent().getNode(id)!.getPosition()).toEqual({ x: 321, y: 123 });
      expect(state.graph.getSelection()).toEqual([id]);
    } finally {
      state.dispose();
    }
  });

  it("does not revive queued edits after document destruction", async () => {
    const state = await fixture();
    const pending = applyCanvasGraphEdit({
      document: state.document,
      graph: state.graph,
      edit: { type: "node-moved", nodeId: "source", position: { x: 99, y: 99 }, edges: [] },
    });
    state.document.destroy();
    await expect(pending).rejects.toThrow("destroyed");
    expect(state.source.getPosition()).not.toEqual({ x: 99, y: 99 });
    state.bridge.teardown();
  });

  it("consumes selection IDs from the event and releases both subscriptions", async () => {
    const state = await fixture();
    try {
      state.event({ type: "selection-changed", ids: ["target"] });
      expect(state.document.getSelection().getKeys()).toEqual(["target"]);
      expect(state.graph.getSelection()).toEqual([]);
      state.bridge.teardown();
      expect(state.edits.size).toBe(0);
      expect(state.events.size).toBe(0);
      state.edit({ type: "node-moved", nodeId: "source", position: { x: 999, y: 999 }, edges: [] });
      expect(state.source.getPosition()).not.toEqual({ x: 999, y: 999 });
    } finally {
      state.dispose();
    }
  });
});
