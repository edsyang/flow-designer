import { describe, expect, it } from "vitest";
import { getSkeleton } from "@flow-designer/skeleton";
import { CleanupError } from "@flow-designer/core";
import { Engine } from "../src/engine";
import { Document, GenericContent, contentTypesRegistry } from "@flow-designer/model";
function engineWithDocument() {
  if (!contentTypesRegistry.getSuitableContentType("*"))
    contentTypesRegistry.register(GenericContent);
  const engine = new Engine();
  engine.editor.setDocument(
    new Document({ id: "ui-binding", documentType: "*", documentVersion: "1.0.0" }, undefined, {
      registries: engine.registries,
    }),
  );
  return engine;
}
describe("engine UI binding ownership", () => {
  it("keeps UI available during plugin disposal and releases it last", async () => {
    const engine = engineWithDocument();
    const order: string[] = [];
    await engine.plugins.register((context) => ({
      name: "ui-owner",
      init: () => {
        getSkeleton(context.editor).header.add({ key: "owned", area: "header", content: "panel" });
      },
      destroy: () => {
        getSkeleton(context.editor).header.remove("owned");
        order.push("plugin");
      },
    }));
    await engine.plugins.init();
    engine.addDisposer(() => {
      expect(getSkeleton(engine.editor)).toBe(engine.skeleton);
      order.push("resource");
    });
    await Promise.all([engine.destroy(), engine.destroy()]);
    expect(order).toEqual(["plugin", "resource"]);
    expect(engine.skeleton.header.getItems()).toEqual([]);
    expect(() => getSkeleton(engine.editor)).toThrow("No skeleton");
  });
  it("releases bindings even when a plugin cleanup fails", async () => {
    const engine = engineWithDocument();
    const error = new Error("cleanup failed");
    await engine.plugins.register(() => ({
      name: "broken",
      destroy: () => {
        throw error;
      },
    }));
    await engine.plugins.init();
    const failure: unknown = await engine.destroy().catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(CleanupError);
    if (!(failure instanceof CleanupError)) throw new Error("Missing cleanup error");
    expect(failure.errors[0]).toBe(error);
    expect(() => getSkeleton(engine.editor)).toThrow("No skeleton");
  });
  it("cleans bindings after initialization failure", async () => {
    const engine = engineWithDocument();
    const error = new Error("initialization failed");
    await engine.plugins.register(() => ({
      name: "broken-init",
      init: () => {
        throw error;
      },
    }));
    await expect(engine.plugins.init()).rejects.toBe(error);
    await engine.destroy();
    expect(() => getSkeleton(engine.editor)).toThrow("No skeleton");
  });
});
