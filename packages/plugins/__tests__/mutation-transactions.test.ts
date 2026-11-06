import { describe, expect, it, vi } from "vitest";
import { Editor } from "@flow-designer/core";
import type { IPluginContext } from "@flow-designer/core";
import {
  ContentAop,
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
} from "@flow-designer/model";
import { pluginCopyPaste } from "../src/copy-paste";
import { pluginDelete } from "../src/delete";

describe("mutation commands", () => {
  it("pastes preserved props with fresh IDs in one undo step, then awaits asynchronous deletion", async () => {
    contentTypesRegistry.register(GenericContent);
    if (!prototypeRegistry.getPrototypeByType("transaction-task")) {
      prototypeRegistry.register({
        meta: { name: "Task", typeName: "transaction-task" },
        schema: [],
      });
    }
    const doc = new Document({
      id: "transaction-doc",
      documentType: "*",
      documentVersion: "1.0.0",
      elements: [
        {
          id: "first",
          typeName: "transaction-task",
          props: { label: "Edited", nested: { value: 7 } },
          position: { x: 10, y: 20 },
        },
        {
          id: "second",
          typeName: "transaction-task",
          props: { label: "Second" },
          position: { x: 50, y: 60 },
        },
      ],
    });
    const selected = ["first", "second"];
    const select = vi.fn();
    const editor = new Editor();
    editor.setDocument(doc);
    const ctx = {
      editor,
      commands: editor.commands,
      notifications: editor.notifications,
      shortcuts: { bind: () => () => {} },
      graph: { select, getSelection: () => selected, removeCell: vi.fn() },
      container: document.createElement("div"),
      logger: { error: vi.fn() },
    } as unknown as IPluginContext;
    const copy = pluginCopyPaste(ctx);
    const deletion = pluginDelete(ctx);
    copy.init?.();
    deletion.init?.();
    try {
      editor.commands.executeCommand("copy");
      await editor.commands.executeCommand("paste");
      const nodes = doc.getContent().getNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[2].getId()).not.toBe("first");
      expect(nodes[2].getProps().getPropData("nested")).toEqual({ value: 7 });
      expect(nodes[2].getPosition()).toEqual({ x: 40, y: 50 });
      expect(doc.getTimeline().getPoints()).toHaveLength(2);
      doc.getTimeline().back();
      expect(doc.getContent().getNodes()).toHaveLength(2);
      await new Promise((resolve) => setTimeout(resolve, 1));
      doc.aspect(ContentAop.NODE_REMOVING, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      const pending = editor.commands.executeCommand("delete");
      expect(doc.getContent().getNodes()).toHaveLength(2);
      await pending;
      expect(doc.getContent().getNodes()).toHaveLength(0);
      expect(doc.getTimeline().getPoints()).toHaveLength(2);
      doc.getTimeline().back();
      expect(doc.getContent().getNodes()).toHaveLength(2);
    } finally {
      copy.destroy?.();
      deletion.destroy?.();
      doc.destroy();
    }
  });
});
