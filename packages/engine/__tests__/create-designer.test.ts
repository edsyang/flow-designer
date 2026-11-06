import { GraphManager } from "@flow-designer/graph";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDesigner } from "../src/create-designer";
import { contentTypesRegistry, GenericContent, utils } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";

beforeEach(() => {
  if (!contentTypesRegistry.getSuitableContentType("default")) {
    contentTypesRegistry.register(GenericContent as any);
  }
});

const ALL_DISABLED = [
  "plugin-x6-graph",
  "plugin-zoom",
  "plugin-undo-redo",
  "plugin-copy-paste",
  "plugin-delete",
  "plugin-stencil-panel",
  "plugin-selection-panel",
  "plugin-debug-loader",
  "plugin-schema-viewer",
  "plugin-canvas-help",
  "plugin-language-switcher",
];

describe("createDesigner", () => {
  it("initializes locale resources before plugins initialize", async () => {
    const pluginInit = vi.fn(() => {
      expect(t("scenario.test.ready")).toBe("场景已就绪");
    });
    const designer = await createDesigner({
      container: document.createElement("div"),
      documentType: "default",
      documentVersion: "1.0.0",
      localeMessages: {
        "en-US": { "scenario.test.ready": "Scenario ready" },
        "zh-CN": { "scenario.test.ready": "场景已就绪" },
      },
      plugins: [() => ({ name: "i18n-ordering-test", init: pluginInit })],
      disableBuiltinPlugins: ALL_DISABLED,
    });

    expect(pluginInit).toHaveBeenCalledOnce();
    await designer.destroy();
  });

  it("returns engine, editor, document, graph, plugins, and destroy", async () => {
    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "1.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
    });

    expect(designer.engine).toBeDefined();
    expect(designer.editor).toBeDefined();
    expect(designer.document).toBeDefined();
    expect(designer.plugins).toBeDefined();
    expect(typeof designer.destroy).toBe("function");
    expect(designer.editor.getDocument()).toBeDefined();

    await designer.destroy();
  });

  it("creates document with correct documentType", async () => {
    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "2.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
    });

    const doc = designer.document;
    expect(doc).toBeDefined();
    expect(doc.getContent()).toBeDefined();

    await designer.destroy();
  });

  it("registers custom plugins from options", async () => {
    const initFn = vi.fn();
    const customPlugin = () => ({
      name: "test-custom",
      dep: [],
      init: initFn,
    });

    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "1.0.0",
      plugins: [customPlugin],
      disableBuiltinPlugins: ALL_DISABLED,
    });

    expect(initFn).toHaveBeenCalled();
    await designer.destroy();
  });

  it("rejects creation and cleans up initialized plugins when a plugin fails", async () => {
    const destroyFirstPlugin = vi.fn();
    const firstPlugin = () => ({
      name: "test-first",
      init() {},
      destroy: destroyFirstPlugin,
    });
    const failingPlugin = () => ({
      name: "test-failing",
      init() {
        throw new Error("plugin initialization failed");
      },
    });

    await expect(
      createDesigner({
        container: document.createElement("div"),
        documentType: "default",
        documentVersion: "1.0.0",
        plugins: [firstPlugin, failingPlugin],
        disableBuiltinPlugins: ALL_DISABLED,
      }),
    ).rejects.toThrow("plugin initialization failed");
    expect(destroyFirstPlugin).toHaveBeenCalledOnce();
  });

  it("destroy cleans up graph reference", async () => {
    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "1.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
    });

    await designer.destroy();
    expect(designer.editor.getGraph()).toBeNull();
  });

  it("does not register unsavedPrompt by default", async () => {
    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "1.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
    });

    await designer.destroy();
  });
});

describe("designer resource ownership", () => {
  it("exposes only the initialized adapter matching the mounted core port", async () => {
    const adapter = new GraphManager();
    const designer = await createDesigner({
      documentType: "default",
      documentVersion: "1",
      disableBuiltinPlugins: ALL_DISABLED,
      plugins: [() => ({ name: "plugin-x6-graph", exports: () => ({ graphManager: adapter }) })],
    });
    try {
      expect(designer.graph).toBeNull();
      designer.editor.setGraph(adapter);
      expect(designer.graph).toBe(adapter);
      designer.editor.setGraph(new GraphManager());
      expect(designer.graph).toBeNull();
      designer.editor.setGraph(adapter);
      await designer.engine.plugins.delete("plugin-x6-graph");
      expect(designer.graph).toBeNull();
    } finally {
      await designer.destroy();
    }
    expect(designer.graph).toBeNull();
  });

  it("passes the container to plugins without mounting and exposes the current graph", async () => {
    const container = document.createElement("div");
    const designer = await createDesigner({
      container,
      documentType: "default",
      documentVersion: "1.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
      plugins: [
        (ctx) => ({
          name: "container-probe",
          init() {
            expect(ctx.container).toBe(container);
          },
        }),
      ],
    });
    expect(container.children.length).toBe(0);
    expect(designer.graph).toBeNull();
    expect(Object.getOwnPropertyDescriptor(designer, "graph")?.get).toBeTypeOf("function");
    const destroy = vi.spyOn(designer.document, "destroy");
    await Promise.all([designer.destroy(), designer.destroy()]);
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("releases acquired listeners when registration throws before plugin initialization", async () => {
    const dispose = vi.fn();
    const init = vi.spyOn(utils.hotkey, "init").mockReturnValue(dispose);
    try {
      await expect(
        createDesigner({
          documentType: "default",
          documentVersion: "1.0.0",
          disableBuiltinPlugins: ALL_DISABLED,
          plugins: [
            () => {
              throw new Error("factory failure");
            },
          ],
        }),
      ).rejects.toThrow("factory failure");
      expect(dispose).toHaveBeenCalledOnce();
    } finally {
      init.mockRestore();
    }
  });
  it("registers option transformers and restores the registry on destruction", async () => {
    const format = "owned-transformer-test";
    const transformer = {
      format,
      contentType: "default",
      transformIn: () => ({ owned: true }),
      transformOut: () => "owned",
    };
    const designer = await createDesigner({
      documentType: "default",
      documentVersion: "1.0.0",
      disableBuiltinPlugins: ALL_DISABLED,
      transformers: [transformer],
    });
    expect(contentTypesRegistry.transform(format, {})).toEqual({ owned: true });
    await designer.destroy();
    expect(() => contentTypesRegistry.transform(format, {})).toThrow("No transformer registered");
  });
});
