import type { GraphApplicationEvent, ConnectionRejectionReason } from "@flow-designer/core";
import type { ConnectionContext, ConnectionCheckOptions, GraphPort } from "@flow-designer/core";
import { bindSkeleton } from "@flow-designer/skeleton";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
} from "@flow-designer/model";
import { CANVAS_COMMANDS } from "@flow-designer/core";
import { initializeI18n } from "@flow-designer/i18n";
import type { GenericRelation, PortDefinition } from "@flow-designer/model";
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
  bindSkeleton(editor, skeleton);
  const listeners = new Set<(event: GraphApplicationEvent) => void>();
  const evaluateConnection = vi.fn(
    (context: ConnectionContext, options?: ConnectionCheckOptions) => {
      if (options?.phase === "candidate") return { valid: true, deferred: true };
      return rejectCommit
        ? { valid: false, reason: "workbench.connection.incompatible" as const }
        : { valid: Boolean(doc.getContent().getNode(context.targetNode)) };
    },
  );
  const graph = {
    clientToLocal: vi.fn((x: number, y: number) => ({ x, y })),
    localToClient: vi.fn((x: number, y: number) => ({ x, y })),
    getPortDefinition: (_node: string, port: string) =>
      ports.find((item) => item.id === port) ?? null,
    evaluateConnection,
    getDefaultEdgeType: () => "TestEdge",
    getEdgeTypeMetadata: () => ({ schema: [] }),
    getNodePorts: () => ports,
    select: vi.fn(),
    removeCell: vi.fn(),
    subscribeEvents: (handler: (event: GraphApplicationEvent) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };
  editor.setGraph(graph as unknown as GraphPort);
  const view = render(
    <FlowDesignerContext.Provider value={{ editor, skeleton, doc } as unknown as EngineShape}>
      <Canvas area={skeleton.canvas} />
    </FlowDesignerContext.Provider>,
  );
  const emit = (event: GraphApplicationEvent) =>
    act(() => {
      listeners.forEach((handler) => handler(event));
    });
  const open = (reason?: ConnectionRejectionReason) =>
    emit({
      type: "connection-blank",
      sourceNodeId: source!.getId(),
      sourcePortId: "bidirectional",
      temporaryEdgeId: "temporary",
      graphPosition: { x: 100, y: 100 },
      reason,
    });
  return { id, doc, source: source!, graph, open, emit, view, evaluateConnection };
}

describe("Canvas pending connections", () => {
  it("uses typed client coordinates first and graph coordinates as the double-click fallback", async () => {
    const fixture = await setup();
    fixture.emit({
      type: "blank-double-clicked",
      clientPosition: { x: 230, y: 140 },
      graphPosition: { x: 99, y: 88 },
    });
    expect(screen.getByRole("dialog", { name: "添加节点" })).toBeTruthy();
    expect(fixture.graph.clientToLocal).toHaveBeenLastCalledWith(230, 140);
    expect(fixture.graph.localToClient).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fixture.emit({ type: "blank-double-clicked", graphPosition: { x: 300, y: 200 } });
    expect(fixture.graph.localToClient).toHaveBeenLastCalledWith(300, 200);
    expect(fixture.graph.clientToLocal).toHaveBeenLastCalledWith(300, 200);
    expect(screen.getByRole("dialog", { name: "添加节点" })).toBeTruthy();
  });

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
    fixture.emit({
      type: "routing-degraded",
      edgeIds: ["one", "two"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    fixture.emit({
      type: "routing-degraded",
      edgeIds: ["three"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "选择要连接的节点" })).toBeTruthy();
    expect(fixture.graph.removeCell).not.toHaveBeenCalled();
    act(() => fixture.doc.load(fixture.doc.getData()));
    fixture.emit({
      type: "routing-degraded",
      edgeIds: ["loaded"],
      reason: "workbench.connection.legacyRouteWarning",
    });
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("shows one drop rejection message and releases its event listener", async () => {
    const fixture = await setup();
    const warning = vi.fn();
    setMessageApi({ warning } as unknown as Parameters<typeof setMessageApi>[0]);
    fixture.emit({
      type: "connection-rejected",
      valid: false,
      reason: "workbench.connection.incompatible",
      sourceNode: fixture.source.getId(),
      targetNode: "target",
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith("这两个端口不兼容");
    fixture.view.unmount();
    fixture.emit({
      type: "connection-rejected",
      valid: false,
      reason: "workbench.connection.incompatible",
      sourceNode: fixture.source.getId(),
      targetNode: "target",
    });
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
