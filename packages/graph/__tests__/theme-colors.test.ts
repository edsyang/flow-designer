import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme, setTheme } from "@flow-designer/model";
import { GraphManager } from "../src/graph-manager";

let manager: GraphManager;
let container: HTMLElement;
beforeEach(() => {
  setTheme("light");
  container = document.createElement("div");
  container.dataset.fdArea = "workbench";
  Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  document.body.appendChild(container);
  manager = new GraphManager();
  manager.init(container);
});
afterEach(() => {
  manager.dispose();
  container.remove();
  setTheme("light");
});
function graph() {
  const graph = manager.getX6Graph();
  if (!graph) throw new Error("Graph missing");
  return graph;
}

describe("theme-owned versus caller-owned diagram colours", () => {
  it("still updates default node and edge colours in both directions", () => {
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.addEdge({ id: "default", source: "a", target: "b" });
    const node = graph().getCellById("a");
    const edge = graph().getCellById("default");
    setTheme("dark");
    expect(node.attr("body/fill")).toBe("#1d2432");
    expect(edge.attr("line/stroke")).toBe("#7d8aa0");
    setTheme("light");
    expect(node.attr("body/fill")).toBe("#ffffff");
    expect(edge.attr("line/stroke")).toBe("#4C6079");
  });

  it("preserves custom body and label attrs, selection and zoom across a palette switch", () => {
    manager.addNode({ id: "custom", type: "fd-rect", x: 0, y: 0 });
    const node = graph().getCellById("custom");
    node.attr({
      body: { fill: "#cc8844", stroke: "#aa2277", strokeWidth: 4 },
      label: { fill: "#225588" },
    });
    manager.zoomTo(0.7);
    manager.select([node.id]);
    setTheme("dark");
    expect(node.attr("body/fill")).toBe("#cc8844");
    expect(node.attr("label/fill")).toBe("#225588");
    expect(node.attr("body/stroke")).toBe("#4d7cfe");
    expect(manager.getSelection()).toEqual([node.id]);
    expect(manager.getZoom()).toBe(0.7);
    manager.select([]);
    expect(node.attr("body/stroke")).toBe("#aa2277");
    expect(node.attr("body/strokeWidth")).toBe(4);
    setTheme("light");
    expect(node.attr("body/fill")).toBe("#cc8844");
    expect(node.attr("body/stroke")).toBe("#aa2277");
  });

  it("preserves explicit edge defaultAttrs even when they equal the light palette", () => {
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.registerEdgeType("custom", { defaultAttrs: { line: { stroke: "#aa2277" } } });
    manager.registerEdgeType("explicit-light", { defaultAttrs: { line: { stroke: "#4C6079" } } });
    manager.addEdge({ id: "custom-edge", type: "custom", source: "a", target: "b" });
    manager.addEdge({ id: "explicit-edge", type: "explicit-light", source: "a", target: "b" });
    expect(graph().getCellById("custom-edge").attr("line/stroke")).toBe("#aa2277");
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(graph().getCellById("custom-edge").attr("line/stroke")).toBe("#aa2277");
    expect(graph().getCellById("explicit-edge").attr("line/stroke")).toBe("#4C6079");
  });

  it("preserves typed-port semantic stroke and explicitly supplied fill", () => {
    manager.registerNodeType(
      { name: "typed", title: "Typed" },
      {
        type: "node",
        shape: "fd-rect",
        ports: [
          {
            id: "typed-out",
            group: "out",
            position: "right",
            dataType: "FLOAT",
            color: "#a455cc",
            attrs: { circle: { fill: "#fff" } },
          },
        ],
      },
    );
    manager.addNode({ id: "typed", type: "typed", x: 0, y: 0 });
    const node = graph().getCellById("typed");
    if (!node.isNode()) throw new Error("Expected node");
    setTheme("dark");
    expect(node.getPortProp("typed-out", "attrs/circle/fill")).toBe("#fff");
    expect(node.getPorts().find((port) => port.id === "typed-out")?.group).toBe("out-right");
    expect(node.getPropByPath("ports/groups/out-right/attrs/circle/stroke")).toBe("#a455cc");
  });
  it("updates the selected default base without removing its selection highlight", () => {
    manager.addNode({ id: "selected-default", type: "fd-rect", x: 0, y: 0 });
    const node = graph().getCellById("selected-default");
    manager.select([node.id]);
    setTheme("dark");
    expect(node.attr("body/stroke")).toBe("#4d7cfe");
    manager.select([]);
    expect(node.attr("body/stroke")).toBe("#3b4860");
    setTheme("light");
    expect(node.attr("body/stroke")).toBe("#d9d9d9");
  });

  it("keeps edge hover/selection transient while custom and default bases follow their owners", async () => {
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.registerEdgeType("custom", { defaultAttrs: { line: { stroke: "#aa2277" } } });
    manager.addEdge({ id: "custom-edge", type: "custom", source: "a", target: "b" });
    manager.addEdge({ id: "default-edge", source: "a", target: "b" });
    for (const [id, expected] of [
      ["custom-edge", "#aa2277"],
      ["default-edge", "#7d8aa0"],
    ]) {
      setTheme("light");
      const edge = graph().getCellById(id!);
      await vi.waitFor(() => expect(graph().findViewByCell(edge)?.findOne("line")).toBeTruthy());
      manager.select([edge.id]);
      graph().trigger("edge:mouseenter", { edge });
      setTheme("dark");
      const line = graph().findViewByCell(edge)!.findOne("line") as SVGElement;
      expect(line.style.getPropertyValue("stroke")).toBe("#4d7cfe");
      expect(edge.attr("line/stroke")).toBe(expected);
      manager.select([]);
      graph().trigger("edge:mouseleave", { edge });
      expect(line.style.getPropertyValue("stroke")).toBe("");
      expect(edge.attr("line/stroke")).toBe(expected);
    }
  });

  it("honours explicit edge configuration for cells first added in dark mode", () => {
    setTheme("dark");
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.registerEdgeType("explicit-light", { defaultAttrs: { line: { stroke: "#4C6079" } } });
    manager.addEdge({ id: "new-custom", type: "explicit-light", source: "a", target: "b" });
    expect(graph().getCellById("new-custom").attr("line/stroke")).toBe("#4C6079");
    expect(graph().getCellById("a").attr("body/fill")).toBe("#1d2432");
  });
  it("themes an edge type with partial attrs but no caller stroke", () => {
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.registerEdgeType("palette-default", { defaultAttrs: { line: { strokeWidth: 2 } } });
    manager.addEdge({ id: "typed-default", type: "palette-default", source: "a", target: "b" });
    setTheme("dark");
    expect(graph().getCellById("typed-default").attr("line/stroke")).toBe("#7d8aa0");
    setTheme("light");
    expect(graph().getCellById("typed-default").attr("line/stroke")).toBe("#4C6079");
  });
  it("clears stale edge hover on an owner pointer move after deselection and releases the guard", async () => {
    manager.addNode({ id: "a", type: "fd-rect", x: 0, y: 0 });
    manager.addNode({ id: "b", type: "fd-rect", x: 400, y: 0 });
    manager.addEdge({ id: "hovered", source: "a", target: "b" });
    const edge = graph().getCellById("hovered");
    edge.attr("line/stroke", "#9351a6");
    await vi.waitFor(() => expect(graph().findViewByCell(edge)?.findOne("line")).toBeTruthy());
    graph().trigger("edge:mouseenter", { edge });
    manager.select([edge.id]);
    const line = graph().findViewByCell(edge)!.findOne("line") as SVGElement;
    line.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    // Tools are separate DOM siblings carrying the same owning-cell marker.
    const tools = document.createElement("span");
    tools.dataset.cellId = edge.id;
    container.appendChild(tools);
    tools.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(line.style.getPropertyValue("stroke")).toBe("#4d7cfe");
    manager.select([]);
    const blank = document.createElement("span");
    container.appendChild(blank);
    for (const buttons of [1, 4]) {
      blank.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons }));
      expect(line.style.getPropertyValue("stroke")).toBe("#4d7cfe");
    }
    blank.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(line.style.getPropertyValue("stroke")).toBe("");
    expect(edge.attr("line/stroke")).toBe("#9351a6");
    const remove = vi.spyOn(container, "removeEventListener");
    manager.dispose();
    expect(remove).toHaveBeenCalledWith("mousemove", expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith("mouseleave", expect.any(Function));
  });
});
