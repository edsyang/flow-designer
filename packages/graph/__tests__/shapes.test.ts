import { Node } from "@antv/x6";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerShape } from "../src/shapes";
import { GraphManager } from "../src/graph-manager";

describe("shapes", () => {
  let container: HTMLElement;
  let manager: GraphManager;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new GraphManager();
    manager.init(container);
  });

  afterEach(() => {
    manager.dispose();
    document.body.removeChild(container);
  });

  it("registerShape makes a custom shape usable by X6", () => {
    registerShape("test-custom-shape", {
      inherit: "rect",
      width: 100,
      height: 50,
      attrs: { body: { stroke: "#000" } },
    });

    manager.addNode({ id: "n1", type: "test-custom-shape", x: 0, y: 0 });
    const cell = manager.getCellById("n1") as { shape: string } | null;
    expect(cell?.shape).toBe("test-custom-shape");
  });

  it("registers built-in fd-rect/fd-diamond/fd-circle shapes on init", () => {
    manager.addNode({ id: "rect-1", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "diamond-1", type: "fd-diamond", x: 0, y: 0 });
    manager.addNode({ id: "circle-1", type: "fd-circle", x: 0, y: 0 });

    expect(manager.getCellById("rect-1")).toBeTruthy();
    expect(manager.getCellById("diamond-1")).toBeTruthy();
    expect(manager.getCellById("circle-1")).toBeTruthy();
  });
  it("releases explicit global extensions by identity without deleting a newer replacement", () => {
    const releaseA = registerShape("owned-global-shape", { inherit: "rect", width: 100 });
    const releaseB = registerShape("owned-global-shape", { inherit: "rect", width: 200 });
    const latest = Node.registry.get("owned-global-shape");
    releaseA();
    expect(Node.registry.get("owned-global-shape")).toBe(latest);
    releaseB();
    expect(Node.registry.get("owned-global-shape")).toBeUndefined();
    releaseB();
  });
});
