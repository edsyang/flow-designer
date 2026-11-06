import { defineNode } from "../../engine/src/definitions";
import { bindSkeleton } from "@flow-designer/skeleton";
import { Editor, PluginContext, PluginManager } from "@flow-designer/core";
import { Skeleton } from "@flow-designer/skeleton";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { IPluginContext } from "@flow-designer/core";
import { GraphManager } from "@flow-designer/graph";
import type { Document } from "@flow-designer/model";
import { pluginX6Graph } from "../src/x6-graph";
import { setupRegistries, createDocument } from "./test-helpers";

function createMockContext(document: Document) {
  const editor = new Editor({ registries: document.getRegistries() });
  editor.setDocument(document);
  const skeleton = new Skeleton();
  for (const prototype of document.getRegistries().prototypes.getRegistry()) {
    skeleton.ui.register(
      defineNode({
        meta: { name: prototype.getName(), typeName: prototype.getTypeName() },
        view: { type: "node", shape: "fd-rect", ports: prototype.getPorts() },
        schema: prototype.getSchema(),
        editor: [],
      }),
      document.getRegistries().prototypes,
    );
  }
  bindSkeleton(editor, skeleton);
  const manager = new PluginManager(editor);
  editor.setPlugins(manager);
  const ctx = new PluginContext(editor, manager);
  ctx.setLogger({ name: "plugin-x6-graph" });
  const setGraph = vi.spyOn(editor, "setGraph");
  return {
    ctx,
    triggerMount: (container: HTMLElement) =>
      skeleton.canvas.getDidMountCallbacks().forEach((callback) => callback(container)),
    setGraph,
  };
}

describe("pluginX6Graph", () => {
  let container: HTMLElement;
  let document: Document;

  beforeEach(() => {
    setupRegistries();
    container = window.document.createElement("div");
    window.document.body.appendChild(container);
    document = createDocument();
  });

  afterEach(() => {
    container.parentNode?.removeChild(container);
  });

  it("has the expected name and no dependencies", () => {
    const { ctx } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    expect(config.name).toBe("plugin-x6-graph");
    expect(config.dep).toEqual([]);
  });

  it("initializes the GraphManager and injects it into the editor once mounted", () => {
    const { ctx, triggerMount, setGraph } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    config.init!();
    triggerMount(container);

    expect(setGraph).toHaveBeenCalledTimes(1);
    const graphManager = setGraph.mock.calls[0][0] as GraphManager;
    expect(graphManager).toBeInstanceOf(GraphManager);
    expect(graphManager.getX6Graph()).toBeTruthy();
  });

  it("does not mount after the plugin is destroyed", () => {
    const { ctx, triggerMount, setGraph } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    config.init!();
    config.destroy!();
    triggerMount(container);
    expect(setGraph).not.toHaveBeenCalled();
  });

  it("registers all currently-known prototypes as node types", () => {
    const { ctx, triggerMount } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    config.init!();
    triggerMount(container);

    const { graphManager } = config.exports!() as { graphManager: GraphManager };
    graphManager.addNode({ id: "n1", type: "rect", x: 0, y: 0 });
    expect(graphManager.getPortDefinition("n1", "out")).toMatchObject({ id: "out", group: "out" });
  });

  it("sets up a GraphBridge that syncs the document to the graph", async () => {
    const { ctx, triggerMount } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    config.init!();
    triggerMount(container);

    const { graphManager } = config.exports!() as { graphManager: GraphManager };
    const node = await document.getContent().addNode({ type: "rect", props: {} });
    expect(graphManager.getCellById(node!.getId())).toBeTruthy();
  });

  it("sends a graph:init-failed signal and renders an error message when init throws", () => {
    const { ctx, triggerMount } = createMockContext(document);
    const initSpy = vi.spyOn(GraphManager.prototype, "init").mockImplementation(() => {
      throw new Error("boom");
    });

    const received: unknown[] = [];
    const off = ctx.editor.events.onSignal("graph:init-failed", (error) => received.push(error));

    const config = pluginX6Graph(ctx);
    config.init!();
    triggerMount(container);

    expect(received).toHaveLength(1);
    expect(container.textContent).toContain("画布初始化失败");

    off();
    initSpy.mockRestore();
  });

  it("destroy tears down the bridge, disposes the graph, and clears the editor reference", () => {
    const { ctx, triggerMount, setGraph } = createMockContext(document);
    const config = pluginX6Graph(ctx);
    config.init!();
    triggerMount(container);

    const { graphManager } = config.exports!() as { graphManager: GraphManager };
    config.destroy!();

    expect(graphManager.getX6Graph()).toBeNull();
    expect(setGraph).toHaveBeenLastCalledWith(null);
  });
});
