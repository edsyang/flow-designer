import { afterEach, describe, expect, it } from "vitest";
import { Graph, Node } from "@antv/x6";
import { shapeMaps, register } from "@antv/x6-react-shape";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { GraphManager } from "../src/graph-manager";

describe("graph-owned React shape registrations", () => {
  const managers: GraphManager[] = [];
  const containers: HTMLElement[] = [];
  const make = () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const manager = new GraphManager();
    manager.init(container);
    managers.push(manager);
    return manager;
  };
  const define = (manager: GraphManager, prefix: string, width: number, portId: string) =>
    manager.registerNodeType(
      { name: "same-name", typeName: "stable-business-type" },
      {
        type: "node",
        defaultSize: { width, height: 40 },
        ports: [{ id: portId, group: "in", position: "left" }],
        component: ({ node, selected }) =>
          createElement("span", null, prefix + ":" + node?.getId() + ":" + String(selected)),
      },
    );
  const add = (manager: GraphManager, owner: string) => {
    manager.addNode({
      id: "same-node-id",
      type: "same-name",
      x: 0,
      y: 0,
      data: { contentNode: { getId: () => owner } },
    });
    return manager.getCellById("same-node-id") as Node;
  };
  const component = (node: Node) => {
    const value = shapeMaps[node.shape]?.component;
    if (!value) throw new Error("Missing owned renderer");
    return value;
  };
  afterEach(() => {
    cleanup();
    for (const manager of managers.splice(0)) manager.dispose();
    for (const container of containers.splice(0)) container.remove();
  });
  it("isolates same names, model references, selection, size and ports and keeps serialized type public", () => {
    const a = make(),
      b = make();
    define(a, "A", 111, "a-input");
    const nodeA = add(a, "model-A");
    define(b, "B", 222, "b-input");
    const nodeB = add(b, "model-B");
    expect(nodeA.shape).not.toBe(nodeB.shape);
    expect(nodeA.shape).not.toBe("same-name");
    expect(nodeA.size().width).toBe(111);
    expect(nodeB.size().width).toBe(222);
    expect(nodeA.hasPort("a-input")).toBe(true);
    expect(nodeA.hasPort("b-input")).toBe(false);
    expect(nodeB.hasPort("b-input")).toBe(true);
    a.select(["same-node-id"]);
    const viewA = render(
      createElement(component(nodeA), { node: nodeA, graph: a.getX6Graph() as Graph }),
    );
    const viewB = render(
      createElement(component(nodeB), { node: nodeB, graph: b.getX6Graph() as Graph }),
    );
    expect(viewA.container.textContent).toBe("A:model-A:true");
    expect(viewB.container.textContent).toBe("B:model-B:false");
    expect(a.toJSON().nodes[0]?.type).toBe("same-name");
    expect(JSON.stringify(a.toJSON())).not.toContain("fd-react-owner");
    const shapeA = nodeA.shape,
      shapeB = nodeB.shape;
    a.dispose();
    expect(shapeMaps[shapeA]).toBeUndefined();
    expect(Node.registry.get(shapeA)).toBeUndefined();
    expect(shapeMaps[shapeB]).toBeDefined();
    viewB.rerender(
      createElement(component(nodeB), { node: nodeB, graph: b.getX6Graph() as Graph }),
    );
    expect(viewB.container.textContent).toBe("B:model-B:false");
  });
  it("restores definitions into a new initialization generation and does not erase another registration", () => {
    const a = make(),
      b = make();
    define(a, "A", 111, "a-input");
    define(b, "B", 222, "b-input");
    const old = add(a, "old-A"),
      nodeB = add(b, "B");
    const oldShape = old.shape;
    a.dispose();
    a.init(containers[0]!);
    const current = add(a, "new-A");
    expect(current.shape).not.toBe(oldShape);
    expect(shapeMaps[oldShape]).toBeUndefined();
    expect(shapeMaps[nodeB.shape]).toBeDefined();
    expect(
      render(createElement(component(current), { node: current, graph: a.getX6Graph() as Graph }))
        .container.textContent,
    ).toBe("A:new-A:false");
    const shape = current.shape;
    register({ shape, component: () => null });
    const replacement = shapeMaps[shape],
      definition = Node.registry.get(shape);
    a.dispose();
    expect(shapeMaps[shape]).toBe(replacement);
    expect(Node.registry.get(shape)).toBe(definition);
    delete shapeMaps[shape];
    Graph.unregisterNode(shape);
  });
});
