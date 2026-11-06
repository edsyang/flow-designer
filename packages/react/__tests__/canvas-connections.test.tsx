import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CANVAS_COMMANDS,
  Document,
  GenericContent,
  contentTypesRegistry,
  initializeI18n,
  prototypeRegistry,
} from "@flow-designer/model";
import type {
  ConnectionContext,
  ConnectionCheckOptions,
  GenericRelation,
  IGraphManager,
  PortDefinition,
} from "@flow-designer/model";
import { Editor, commandRegistry } from "@flow-designer/core";
import { registerCanvasCommands } from "../../plugins/src/x6-graph/commands";
import { Skeleton } from "@flow-designer/skeleton";
import { FlowDesignerContext } from "../src/context";
import type { EngineShape } from "../src/types";
import { Canvas } from "../src/panels/canvas";
import { setMessageApi } from "../src/message-holder";

beforeAll(async () => {
  await initializeI18n();
  if (!contentTypesRegistry.getSuitableContentType("*"))
    contentTypesRegistry.register(GenericContent);
});
const commandDisposers: Array<() => void> = [];
afterEach(() => {
  cleanup();
  commandDisposers.splice(0).forEach((dispose) => dispose());
});
let fixtureId = 0;

async function setup(rejectCommit = false) {
  commandDisposers.push(registerCanvasCommands());
  const id = ++fixtureId;
  const ports: PortDefinition[] = [
    { id: "source-only", group: "in", position: "top", connectionDirection: "out" },
    { id: "bidirectional", group: "out", position: "right", connectionDirection: "both" },
  ];
  prototypeRegistry.register({
    meta: { name: `Target ${id}`, typeName: `canvas-target-${id}` },
    schema: [],
    view: { type: "node", shape: "fd-rect", ports },
  });
  prototypeRegistry.register({
    meta: { name: `Source ${id}`, typeName: `canvas-source-${id}` },
    schema: [],
    view: { type: "node", shape: "fd-rect", quickAdd: false, ports },
  });
  const doc = new Document({ id: `canvas-${id}`, documentType: "*", documentVersion: "1.0.0" });
  const source = await doc.getContent().addNode({ type: `canvas-source-${id}` });
  const editor = new Editor();
  const skeleton = new Skeleton();
  editor.setDocument(doc);
  editor.setSkeleton(skeleton);
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const evaluateConnection = vi.fn(
    (context: ConnectionContext, options?: ConnectionCheckOptions) => {
      if (options?.phase === "candidate") return { valid: true, deferred: true };
      return rejectCommit
        ? { valid: false, reason: "workbench.connection.incompatible" as const }
        : { valid: Boolean(doc.getContent().getNode(context.targetNode)) };
    },
  );
  const graph = {
    clientToLocal: (x: number, y: number) => ({ x, y }),
    localToClient: (x: number, y: number) => ({ x, y }),
    getPortDefinition: (_node: string, port: string) =>
      ports.find((item) => item.id === port) ?? null,
    evaluateConnection,
    getDefaultEdgeType: () => "TestEdge",
    getEdgeTypeConfig: () => ({ schema: [] }),
    select: vi.fn(),
    removeCell: vi.fn(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = listeners.get(event) ?? new Set();
      handlers.add(handler);
      listeners.set(event, handlers);
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    },
  };
  editor.setGraph(graph as unknown as IGraphManager);
  const view = render(
    <FlowDesignerContext.Provider value={{ editor, skeleton, doc } as unknown as EngineShape}>
      <Canvas area={skeleton.canvas} />
    </FlowDesignerContext.Provider>,
  );
  const emit = (event: string, payload: unknown) =>
    act(() => {
      listeners.get(event)?.forEach((handler) => handler(payload));
    });
  const open = (reason?: string) =>
    emit("connection:blank", {
      sourceCellId: source!.getId(),
      sourcePortId: "bidirectional",
      edgeId: "temporary",
      x: 100,
      y: 100,
      reason,
    });
  return { id, doc, source: source!, graph, open, emit, view, evaluateConnection };
}

describe("Canvas pending connections", () => {
  it("offers bidirectional out-group ports and validates the real created target before connecting", async () => {
    const fixture = await setup();
    fixture.open();
    fireEvent.click(screen.getByRole("button", { name: `Target ${fixture.id}` }));
    await waitFor(() => expect(fixture.doc.getContent().getNodes()).toHaveLength(2));
    await waitFor(() => expect(fixture.graph.select).toHaveBeenCalled());
    const edge = (fixture.source.getRelation() as GenericRelation).serialize()[0]!;
    expect(edge.targetPort).toBe("bidirectional");
    expect(fixture.evaluateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        targetNode: "",
        targetPort: expect.objectContaining({ id: "bidirectional" }),
      }),
      { phase: "candidate" },
    );
    expect(fixture.evaluateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        targetNode: edge.targetNodeId,
        targetPort: expect.objectContaining({ id: "bidirectional" }),
      }),
      { phase: "commit" },
    );
    expect(fixture.doc.getSelection().getKeys()).toEqual([edge.targetNodeId]);
  });

  it("keeps a source rejection picker visible with its localized reason and no candidates", async () => {
    const fixture = await setup();
    fixture.open("workbench.connection.sourceCannotConnect");
    expect(screen.getByRole("dialog", { name: "选择要连接的节点" })).toBeTruthy();
    expect(screen.getByText(`Source ${fixture.id}：此端口仅接收入线，不能创建出线`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: `Target ${fixture.id}` })).toBeNull();
    expect(fixture.evaluateConnection).not.toHaveBeenCalled();
  });

  it("compensates a created node when the real-target validator rejects it", async () => {
    const fixture = await setup(true);
    fixture.open();
    fireEvent.click(screen.getByRole("button", { name: `Target ${fixture.id}` }));
    await screen.findByRole("alert");
    expect(fixture.doc.getContent().getNodes()).toEqual([fixture.source]);
    expect((fixture.source.getRelation() as GenericRelation).serialize()).toEqual([]);
    expect(fixture.graph.select).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("这两个端口不兼容");
  });

  it("reports a missing creation command without mutating the document", async () => {
    const fixture = await setup();
    fixture.open();
    commandRegistry.unregister(CANVAS_COMMANDS.createNode);
    fireEvent.click(screen.getByRole("button", { name: `Target ${fixture.id}` }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(`Target ${fixture.id}`);
    expect(fixture.doc.getContent().getNodes()).toEqual([fixture.source]);
    expect(fixture.graph.select).not.toHaveBeenCalled();
  });

  it("aggregates legacy routing warnings once per loaded baseline without rejecting its connection", async () => {
    const fixture = await setup();
    const warning = vi.fn();
    setMessageApi({ warning } as unknown as Parameters<typeof setMessageApi>[0]);
    fixture.open();
    fixture.emit("edge:routing:degraded", {
      edgeIds: ["one", "two"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    fixture.emit("edge:routing:degraded", {
      edgeIds: ["three"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "选择要连接的节点" })).toBeTruthy();
    expect(fixture.graph.removeCell).not.toHaveBeenCalled();
    act(() => fixture.doc.load(fixture.doc.getData()));
    fixture.emit("edge:routing:degraded", {
      edgeIds: ["loaded"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("shows one drop rejection message and releases its event listener", async () => {
    const fixture = await setup();
    const warning = vi.fn();
    setMessageApi({ warning } as unknown as Parameters<typeof setMessageApi>[0]);
    fixture.emit("connection:rejected", {
      valid: false,
      reason: "workbench.connection.incompatible",
      sourceNode: fixture.source.getId(),
      targetNode: "target",
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith("这两个端口不兼容");
    fixture.view.unmount();
    fixture.emit("connection:rejected", {
      valid: false,
      reason: "workbench.connection.incompatible",
    });
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
