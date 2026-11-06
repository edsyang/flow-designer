import { describe, it, expect, vi } from "vitest";
import Prototype from "../src/prototype";
import type { NodeDefinition } from "../src/prototype";
describe("domain node definitions", () => {
  it("exposes semantic ports, creation size, capabilities and pure settings", () => {
    const definition: NodeDefinition = {
      meta: { name: "Gateway", typeName: "gateway" },
      schema: [{ name: "condition", type: "string" }],
      connection: { ports: [{ group: "in", position: "left" }] },
      creation: { size: { width: 80, height: 60 } },
      capabilities: { copyable: false },
      settings: [{ target: "condition" }],
    };
    const prototype = new Prototype(definition);
    expect(prototype.getName()).toBe("Gateway");
    expect(prototype.getSchema()).toHaveLength(1);
    expect(prototype.getPorts()[0]?.group).toBe("in");
    expect(prototype.getInitialSize()).toEqual({ width: 80, height: 60 });
    expect(prototype.getCapabilities().copyable).toBe(false);
    expect(prototype.getSettings()[0]?.target).toBe("condition");
    expect(prototype.getDefinition()).toBe(definition);
    expect("getView" in prototype).toBe(false);
  });
  it("retains property initialization and lifecycle callbacks", () => {
    const initial = vi.fn((value) => value),
      nodeDidInit = vi.fn();
    const prototype = new Prototype({
      meta: { name: "Task", typeName: "task" },
      schema: [],
      props: [{ name: "value", initial }],
      lifecycle: { nodeDidInit },
    });
    expect(prototype.getProps()[0]?.initial).toBe(initial);
    prototype.nodeDidInit(null as never, false);
    expect(nodeDidInit).toHaveBeenCalledWith(null, false);
  });
});
