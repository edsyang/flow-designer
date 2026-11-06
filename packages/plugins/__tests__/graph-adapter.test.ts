import { describe, expect, it, vi } from "vitest";
import { Editor, PluginManager } from "@flow-designer/core";
import { getGraphAdapter } from "../src/x6-graph/adapter";

function adapterFixture() {
  return {
    getEdgeTypeName: () => null,
    getEdgeTypeConfig: () => null,
    getStencilNodeGroups: () => [],
    startNodeDrag() {},
    subscribeEvents: () => () => {},
  };
}

describe("explicit graph adapter lookup", () => {
  it("supports the real manager and its proxy without exposing uninitialized or destroyed exports", async () => {
    const manager = new PluginManager(new Editor());
    expect(getGraphAdapter(manager)).toBeNull();
    const adapter = adapterFixture();
    const exports = vi.fn(() => ({ graphManager: adapter }));
    await manager.register(() => ({ name: "plugin-x6-graph", exports }));
    expect(getGraphAdapter(manager)).toBeNull();
    expect(getGraphAdapter(manager.toProxy())).toBeNull();
    expect(exports).not.toHaveBeenCalled();
    await manager.init();
    expect(getGraphAdapter(manager)).toBe(adapter);
    expect(getGraphAdapter(manager.toProxy())).toBe(adapter);
    manager.setDisabled("plugin-x6-graph", true);
    expect(getGraphAdapter(manager)).toBeNull();
    manager.setDisabled("plugin-x6-graph", false);
    await manager.get("plugin-x6-graph")!.destroy();
    expect(getGraphAdapter(manager)).toBeNull();
    await manager.dispose();
    expect(getGraphAdapter(manager)).toBeNull();
  });

  it("rejects missing or malformed adapter exports", async () => {
    for (const exported of [
      {},
      { graphManager: null },
      { graphManager: { getEdgeTypeName() {} } },
    ]) {
      const manager = new PluginManager(new Editor());
      await manager.register(() => ({ name: "plugin-x6-graph", exports: () => exported }));
      await manager.init();
      expect(getGraphAdapter(manager)).toBeNull();
      await manager.dispose();
    }
  });
});
