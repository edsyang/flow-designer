import { describe, expect, it, vi } from "vitest";
import type {
  EdgeConfig,
  GraphApplicationEvent,
  GraphEdit,
  GraphPort,
  NodeConfig,
} from "@flow-designer/core";
import { prototypeRegistry } from "@flow-designer/model";
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
      prototypeRegistry.getPrototypeByName(nodes.get(id)?.type ?? "")?.getView().ports ?? [],
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
      expect(state.source.getRelation().getEdgeById("new")?.vertices).toEqual([{ x: 60, y: 70 }]);
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
