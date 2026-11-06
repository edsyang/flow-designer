import { describe, it, expect, vi } from "vitest";
import PrototypeRegistry from "../src/registries/prototype-registry";
import ContentTypesRegistry from "../src/registries/content-types-registry";
import type { ContentTransformer } from "../src/types";

describe("PrototypeRegistry", () => {
  it("register and retrieve by type", () => {
    const reg = new PrototypeRegistry();
    reg.register({
      meta: { name: "Approve Node", typeName: "approveNode" },
      schema: [],
    } as any);
    const p = reg.getPrototypeByType("approveNode");
    expect(p).not.toBeNull();
    expect(p!.getTypeName()).toBe("approveNode");
  });

  it("register and retrieve by name", () => {
    const reg = new PrototypeRegistry();
    reg.register({
      meta: { name: "My Node", typeName: "myNode" },
      schema: [],
    } as any);
    const p = reg.getPrototypeByName("My Node");
    expect(p).not.toBeNull();
    expect(p!.getName()).toBe("My Node");
  });

  it("getRegistry returns all registered prototypes", () => {
    const reg = new PrototypeRegistry();
    reg.register({
      meta: { name: "A", typeName: "a" },
      schema: [],
    } as any);
    reg.register({
      meta: { name: "B", typeName: "b" },
      schema: [],
    } as any);
    expect(reg.getRegistry()).toHaveLength(2);
  });

  it("emits registrychange on register", () => {
    const reg = new PrototypeRegistry();
    const fn = vi.fn();
    reg.onRegistryChange(fn);
    reg.register({
      meta: { name: "X", typeName: "x" },
      schema: [],
    } as any);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("onRegistryChange returns unsubscribe", () => {
    const reg = new PrototypeRegistry();
    const fn = vi.fn();
    const unsub = reg.onRegistryChange(fn);
    unsub();
    reg.register({
      meta: { name: "Y", typeName: "y" },
      schema: [],
    } as any);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns null for unregistered type/name", () => {
    const reg = new PrototypeRegistry();
    expect(reg.getPrototypeByType("nope")).toBeNull();
    expect(reg.getPrototypeByName("nope")).toBeNull();
  });

  it("register accepts NodeDefinition", () => {
    const reg = new PrototypeRegistry();
    reg.register({
      meta: { name: "Task", typeName: "task", description: "A task node" },
      schema: [{ name: "label", type: "string" }],
    });
    const p = reg.getPrototypeByType("task");
    expect(p).not.toBeNull();
    expect(p!.getName()).toBe("Task");
    expect(p!.getSchema()).toHaveLength(1);
  });
});

describe("ContentTypesRegistry", () => {
  it("register and getSuitableContentType exact match", () => {
    const reg = new ContentTypesRegistry();
    const ct = class MockContent {
      static readonly compatibleType = "bpmn";
      static readonly compatibleVersion = ">=1.0.0";
      constructor() {}
    };
    reg.register(ct as any);
    expect(reg.getSuitableContentType("bpmn", "1.2.0")).toBe(ct);
  });

  it("wildcard fallback when no exact match", () => {
    const reg = new ContentTypesRegistry();
    const wildcard = class WC {
      static readonly compatibleType = "*";
      static readonly compatibleVersion = "*";
      constructor() {}
    };
    reg.register(wildcard as any);
    expect(reg.getSuitableContentType("anything")).toBe(wildcard);
  });

  it("exact match takes priority over wildcard", () => {
    const reg = new ContentTypesRegistry();
    const wildcard = class WC {
      static readonly compatibleType = "*";
      static readonly compatibleVersion = "*";
    };
    const exact = class Exact {
      static readonly compatibleType = "bpmn";
      static readonly compatibleVersion = ">=1.0.0";
    };
    reg.register(wildcard as any);
    reg.register(exact as any);
    expect(reg.getSuitableContentType("bpmn", "1.0.0")).toBe(exact);
  });

  it("returns null when nothing matches", () => {
    const reg = new ContentTypesRegistry();
    expect(reg.getSuitableContentType("unknown")).toBeNull();
  });

  it("registerTransformer + transform round-trip", () => {
    const reg = new ContentTypesRegistry();
    const transformer: ContentTransformer<string> = {
      format: "json",
      contentType: "bpmn",
      transformIn(external: string) {
        return JSON.parse(external);
      },
      transformOut(data: any) {
        return JSON.stringify(data);
      },
    };
    reg.registerTransformer(transformer);
    const input = '{"a":1}';
    const internal = reg.transform("json", input);
    expect(internal).toEqual({ a: 1 });
    const output = reg.transformOut("json", internal);
    expect(output).toBe('{"a":1}');
  });

  it("transform throws on unknown format", () => {
    const reg = new ContentTypesRegistry();
    expect(() => reg.transform("xml", {})).toThrow("No transformer registered for format: xml");
    expect(() => reg.transformOut("xml", {})).toThrow("No transformer registered for format: xml");
  });
});
