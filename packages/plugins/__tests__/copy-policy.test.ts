import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@flow-designer/core";
import type { IPluginContext } from "@flow-designer/core";
import {
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
} from "@flow-designer/model";
import { pluginCopyPaste } from "../src/copy-paste";

const messages = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn() }));
afterEach(() => vi.clearAllMocks());

function fixture() {
  contentTypesRegistry.register(GenericContent);
  for (const [typeName, name, copyable] of [
    ["copy-allowed", "Allowed", true],
    ["copy-blocked", "Blocked", false],
  ] as const) {
    prototypeRegistry.register({
      meta: { typeName, name },
      capabilities: { copyable },
      schema: [],
    });
  }
  const doc = new Document({
    id: "copy-policy",
    documentType: "*",
    documentVersion: "1",
    elements: [
      {
        id: "allowed",
        typeName: "copy-allowed",
        props: { name: "User name", nested: { value: 7 } },
        position: { x: 10, y: 20 },
      },
      { id: "blocked", typeName: "copy-blocked", props: {}, position: { x: 100, y: 20 } },
      { id: "edge", typeName: "link", sourceRef: "allowed", targetRef: "blocked", props: {} },
    ],
  });
  const editor = new Editor({ registries: doc.getRegistries() });
  editor.setDocument(doc);
  editor.notifications.bindSink(({ level, message }) => {
    if (level === "warning") messages.warning(message);
    if (level === "success") messages.success(message);
  });
  const select = vi.fn((ids: string[]) => doc.getSelection().setKeys(ids));
  const graph = { getSelection: () => doc.getSelection().getKeys(), select };
  const ctx = {
    editor,
    commands: editor.commands,
    notifications: editor.notifications,
    shortcuts: { bind: () => () => {} },
    graph,
    container: document.createElement("div"),
    logger: { error: vi.fn() },
  } as unknown as IPluginContext;
  const plugin = pluginCopyPaste(ctx);
  plugin.init?.();
  return {
    doc,
    editor,
    graph,
    destroy: () => {
      plugin.destroy?.();
      doc.destroy();
    },
  };
}

describe("model-backed copy policy", () => {
  it("preserves blocked-node/edge messages, selection and history while copying without native cell mutation", async () => {
    const fixtureState = fixture();
    const { doc, graph } = fixtureState;
    try {
      doc.getSelection().setKeys(["allowed", "blocked", "edge"]);
      const before = doc.getData();
      const points = doc.getTimeline().getPoints().length;
      fixtureState.editor.commands.executeCommand("copy");
      expect(messages.warning).toHaveBeenCalledWith(expect.stringContaining("Blocked、连线"));
      expect(messages.success).toHaveBeenCalledWith(expect.stringContaining("Allowed"));
      expect(doc.getData()).toEqual(before);
      expect(doc.getSelection().getKeys()).toEqual(["allowed", "blocked", "edge"]);
      expect(doc.getTimeline().getPoints()).toHaveLength(points);
      await fixtureState.editor.commands.executeCommand("paste");
      const pasted = doc
        .getContent()
        .getNodes()
        .filter((node) => !["allowed", "blocked"].includes(node.getId()));
      expect(pasted).toHaveLength(1);
      expect(pasted[0]!.getTypeName()).toBe("copy-allowed");
      expect(pasted[0]!.getPosition()).toEqual({ x: 40, y: 50 });
      expect(pasted[0]!.getProps().getPropData("nested")).toEqual({ value: 7 });
      expect(graph.select).toHaveBeenCalledWith([pasted[0]!.getId()]);
      expect(doc.getTimeline().getPoints()).toHaveLength(points + 1);
      doc.getTimeline().back();
      expect(doc.getData()).toEqual(before);
    } finally {
      fixtureState.destroy();
    }
  });

  it("keeps the last valid clipboard when a later selection is entirely blocked", async () => {
    const fixtureState = fixture();
    const { doc } = fixtureState;
    try {
      doc.getSelection().setKeys(["allowed"]);
      fixtureState.editor.commands.executeCommand("copy");
      messages.success.mockClear();
      doc.getSelection().setKeys(["blocked", "edge"]);
      fixtureState.editor.commands.executeCommand("copy");
      expect(messages.warning).toHaveBeenCalledOnce();
      expect(messages.success).not.toHaveBeenCalled();
      await fixtureState.editor.commands.executeCommand("paste");
      expect(
        doc
          .getContent()
          .getNodes()
          .filter((node) => node.getTypeName() === "copy-allowed"),
      ).toHaveLength(2);
    } finally {
      fixtureState.destroy();
    }
  });
});
