import { describe, expect, it, vi } from "vitest";
import {
  ContentAop,
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
} from "@flow-designer/model";
import type { GenericRelation } from "@flow-designer/model";
import type {
  ConnectionCheckOptions,
  ConnectionContext,
  GraphConnectionPort,
} from "@flow-designer/core";
import { commandRegistry, CANVAS_COMMANDS } from "@flow-designer/core";
import {
  connectCanvasNodes,
  createCanvasNode,
  registerCanvasCommands,
} from "../src/x6-graph/commands";

const port = {
  id: "any",
  group: "out" as const,
  position: "right" as const,
  connectionDirection: "both" as const,
};
function fixture(reject = false) {
  contentTypesRegistry.register(GenericContent);
  if (!prototypeRegistry.getPrototypeByType("command-task"))
    prototypeRegistry.register({
      meta: { name: "Task", typeName: "command-task" },
      schema: [],
      view: { type: "node", shape: "fd-rect", ports: [port] },
    });
  const document = new Document({
    id: "command",
    documentType: "*",
    documentVersion: "1.0.0",
    elements: [
      { id: "source", typeName: "command-task", props: { name: "Source" } },
      { id: "unrelated", typeName: "command-task", props: { name: "Unrelated" } },
    ],
  });
  document.getSelection().setKeys(["source"]);
  const graph = {
    getPortDefinition: () => port,
    evaluateConnection: vi.fn((_context: ConnectionContext, options?: ConnectionCheckOptions) =>
      options?.phase === "candidate"
        ? { valid: true, deferred: true }
        : { valid: !reject, reason: "workbench.connection.incompatible" },
    ),
    resolveConnection: vi.fn(() => ({ valid: true })),
    getDefaultEdgeType: () => "Sequence",
    getEdgeTypeMetadata: () => ({
      schema: [{ name: "name", type: "string", defaultValue: "Default name" }],
    }),
  } as unknown as GraphConnectionPort;
  const request = {
    document,
    graph,
    typeName: "command-task",
    position: { x: 200, y: 150 },
    source: { nodeId: "source", portId: "any" },
  };
  return { document, graph, request };
}

describe("shared Canvas creation commands", () => {
  it("persists both resolved endpoint ports for a shared connect command and document round-trip", async () => {
    const { document, graph, request } = fixture();
    vi.spyOn(graph, "getPortDefinition").mockImplementation((_id, id) => ({ ...port, id }));
    vi.spyOn(graph, "evaluateConnection").mockImplementation((context) => ({
      valid: context.sourcePort?.id === "source-bottom" && context.targetPort?.id === "target-top",
      reason: "workbench.connection.routeUnavailable",
    }));
    vi.spyOn(graph, "resolveConnection").mockReturnValue({
      valid: true,
      sourcePortId: "source-bottom",
      targetPortId: "target-top",
    });
    const edgeId = await connectCanvasNodes({
      ...request,
      target: { nodeId: "unrelated", portId: "any" },
    });
    const saved = document.save();
    expect(
      (document.getContent().getNode("source")!.getRelation() as GenericRelation).getEdgeById(
        edgeId,
      ),
    ).toMatchObject({ sourcePort: "source-bottom", targetPort: "target-top" });
    expect(saved.elements.find((element: { id: string }) => element.id === edgeId)).toMatchObject({
      sourceRef: "source",
      targetRef: "unrelated",
      sourcePort: "source-bottom",
      targetPort: "target-top",
    });
    document.load(saved);
    expect(document.getData()).toEqual(saved);
  });

  it("creates a node with the resolved source and target ports in one undoable checkpoint", async () => {
    const { document, graph, request } = fixture();
    vi.spyOn(graph, "getPortDefinition").mockImplementation((_id, id) => ({ ...port, id }));
    vi.spyOn(graph, "evaluateConnection").mockImplementation((context, options) =>
      options?.phase === "candidate"
        ? { valid: true, deferred: true }
        : {
            valid:
              context.sourcePort?.id === "source-bottom" && context.targetPort?.id === "target-top",
            reason: "workbench.connection.routeUnavailable",
          },
    );
    vi.spyOn(graph, "resolveConnection").mockReturnValue({
      valid: true,
      sourcePortId: "source-bottom",
      targetPortId: "target-top",
    });
    const created = await createCanvasNode(request);
    const saved = document.save();
    const expected = {
      sourcePort: "source-bottom",
      targetPort: "target-top",
      targetNodeId: created.nodeId,
    };
    expect(
      (document.getContent().getNode("source")!.getRelation() as GenericRelation).getEdgeById(
        created.edgeId!,
      ),
    ).toMatchObject(expected);
    expect(document.getTimeline().getPoints()).toHaveLength(2);
    document.getTimeline().back();
    expect(document.getContent().getNode(created.nodeId)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 1));
    document.getTimeline().forward();
    expect(
      (document.getContent().getNode("source")!.getRelation() as GenericRelation).getEdgeById(
        created.edgeId!,
      ),
    ).toMatchObject(expected);
    document.load(saved);
    expect(document.getData()).toEqual(saved);
  });

  it("does not let route fallback bypass a semantic rejection", async () => {
    const { document, graph, request } = fixture(true);
    const before = structuredClone(document.getData());
    await expect(createCanvasNode(request)).rejects.toThrow();
    expect(graph.resolveConnection).not.toHaveBeenCalled();
    expect(document.getData()).toEqual(before);
    expect(document.getTimeline().getPoints()).toHaveLength(1);
  });

  it("rejects a real-target connection without changing data, selection, dirty state, history or redo even when delete is vetoed", async () => {
    const { document, request } = fixture(true);
    await document.transaction("later edit", () => document.getProps().setData({ title: "later" }));
    document.getTimeline().back();
    await new Promise((resolve) => setTimeout(resolve, 1));
    const before = structuredClone(document.getData());
    const points = [...document.getTimeline().getPoints()];
    const removing = vi.fn(() => Promise.reject(new Error("cannot delete")));
    document.aspect(ContentAop.NODE_REMOVING, removing);
    await expect(createCanvasNode(request)).rejects.toThrow();
    expect(removing).not.toHaveBeenCalled();
    expect(document.getData()).toEqual(before);
    expect(document.getContent().getNodes()).toHaveLength(2);
    expect(document.getSelection().getKeys()).toEqual(["source"]);
    expect(document.isModified()).toBe(false);
    expect(document.getTimeline().getPoints()).toEqual(points);
    expect(document.getTimeline().getCurrentCursor()).toBe(0);
    document.getTimeline().forward();
    expect(document.getProps().getData()).toEqual({ title: "later" });
  });

  it("does not remove an external replacement with the same ID when the pending addition fails", async () => {
    const { document, request } = fixture(true);
    let allocated!: import("@flow-designer/model").ContentNode;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    document.aspect(ContentAop.NODE_ADDING, async (node) => {
      if (allocated) return;
      allocated = node;
      started();
      await gate;
      return false;
    });
    const result = createCanvasNode(request);
    const rejected = expect(result).rejects.toThrow();
    await ready;
    const replacement = await document.getContent().addNode({
      id: allocated.getId(),
      type: "command-task",
      props: { name: "External replacement" },
    });
    release();
    await rejected;
    expect(document.getContent().getNode(allocated.getId())).toBe(replacement);
    expect(document.getContent().getNodes()).toContain(replacement);
    expect(document.getContent().getNodes()).not.toContain(allocated);
    expect(replacement?.getProps().getPropData("name")).toBe("External replacement");
  });

  it("cleans its allocated object when addNode throws after inserting it", async () => {
    const { document, request } = fixture();
    const before = structuredClone(document.getData());
    const prototype = document.getRegistries().prototypes.getPrototypeByType("command-task")!;
    const add = vi.spyOn(prototype, "nodeDidAdd").mockImplementationOnce(() => {
      throw new Error("after insertion");
    });
    try {
      await expect(createCanvasNode(request)).rejects.toThrow("after insertion");
      expect(document.getData()).toEqual(before);
      expect(document.getContent().getNodes()).toHaveLength(2);
      expect(document.getTimeline().getPoints()).toHaveLength(1);
      expect(document.isModified()).toBe(false);
    } finally {
      add.mockRestore();
    }
  });

  it("preserves concurrent unrelated edits and selections while compensating only its own failed node", async () => {
    const { document, request } = fixture(true);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    document.aspect(ContentAop.NODE_ADDING, () => gate);
    const result = createCanvasNode(request);
    await Promise.resolve();
    await Promise.resolve();
    document.getProps().setData({ unrelatedEdit: "retained" });
    document.getSelection().setKeys(["unrelated"]);
    release();
    await expect(result).rejects.toThrow();
    expect(document.getContent().getNodes()).toHaveLength(2);
    expect(document.getProps().getData()).toEqual({ unrelatedEdit: "retained" });
    expect(document.getSelection().getKeys()).toEqual(["unrelated"]);
    document.getTimeline().back();
    expect(document.getProps().getData()).toEqual({});
  });

  it("compensates only its nested failure and preserves the outer command's successful object", async () => {
    const { document, request } = fixture(true);
    await document.transaction("outer", async () => {
      const outer = await document
        .getContent()
        .addNode({ id: "outer-owned", type: "command-task" });
      await expect(createCanvasNode(request)).rejects.toThrow();
      expect(document.getContent().getNode("outer-owned")).toBe(outer);
      expect(document.getContent().getNodes()).toHaveLength(3);
    });
    expect(document.getTimeline().getPoints()).toHaveLength(2);
    document.getTimeline().back();
    expect(document.getContent().getNode("outer-owned")).toBeNull();
  });

  it("keeps stateless registry commands alive until their last plugin owner is disposed", () => {
    const first = registerCanvasCommands();
    const second = registerCanvasCommands();
    expect(commandRegistry.hasCommand(CANVAS_COMMANDS.createNode)).toBe(true);
    first();
    first();
    expect(commandRegistry.hasCommand(CANVAS_COMMANDS.createNode)).toBe(true);
    second();
    expect(commandRegistry.hasCommand(CANVAS_COMMANDS.createNode)).toBe(false);
  });

  it("creates node and named relation through the public registry in exactly one undo step", async () => {
    const { document, request } = fixture();
    const dispose = registerCanvasCommands();
    try {
      const result = (await commandRegistry.executeCommand(
        CANVAS_COMMANDS.createNode,
        request,
      )) as { nodeId: string; edgeId: string };
      expect(document.getContent().getNodes()).toHaveLength(3);
      const edge = (
        document.getContent().getNode("source")!.getRelation() as GenericRelation
      ).getEdgeById(result.edgeId);
      expect(edge?.props).toEqual({ name: "Default name" });
      expect(edge?.targetNodeId).toBe(result.nodeId);
      expect(document.getTimeline().getPoints()).toHaveLength(2);
      document.getTimeline().back();
      expect(document.getContent().getNodes()).toHaveLength(2);
      await new Promise((resolve) => setTimeout(resolve, 1));
      document.getTimeline().forward();
      expect(document.getContent().getNodes()).toHaveLength(3);
    } finally {
      dispose();
    }
  });
});

it("does not run a queued creation after its document is destroyed", async () => {
  const { document, graph } = fixture();
  const pending = createCanvasNode({
    document,
    graph,
    typeName: "command-task",
    position: { x: 0, y: 0 },
  });
  document.destroy();
  await expect(pending).rejects.toThrow("destroyed");
  expect(document.getContent().getNodes()).toHaveLength(0);
  expect(document.getTimeline().getPoints()).toHaveLength(0);
});
