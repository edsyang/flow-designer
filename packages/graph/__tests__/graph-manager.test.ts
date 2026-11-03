import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Graph, type Node, type Edge } from "@antv/x6";
import { Scroller } from "@antv/x6-plugin-scroller";
import { GraphManager } from "../src/graph-manager";

describe("GraphManager", () => {
  let container: HTMLElement;
  let manager: GraphManager;

  beforeEach(() => {
    container = document.createElement("div");
    container.dataset.fdArea = "workbench";
    container.style.width = "800px";
    container.style.height = "600px";
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    document.body.appendChild(container);
    manager = new GraphManager();
  });

  afterEach(() => {
    manager.dispose();
    document.body.removeChild(container);
    document.querySelectorAll('[data-fd-area="inspector"]').forEach((element) => element.remove());
  });

  describe("init / dispose", () => {
    it("initializes without throwing", () => {
      expect(() => manager.init(container)).not.toThrow();
    });

    it("getX6Graph returns null before init", () => {
      expect(manager.getX6Graph()).toBeNull();
    });

    it("starts in pan interaction mode", () => {
      expect(manager.getInteractionMode()).toBe("pan");
      manager.init(container);
      expect(manager.getInteractionMode()).toBe("pan");
    });

    it("getX6Graph returns the underlying graph instance after init", () => {
      manager.init(container);
      expect(manager.getX6Graph()).toBeTruthy();
    });

    it("uses the mount size and disables continuous content fitting", () => {
      manager.init(container);
      const graph = manager.getX6Graph() as Graph;
      const scroller = graph.getPlugin<Scroller>("scroller");

      expect(graph.options.autoResize).toBe(false);
      expect(graph.options.width).toBe(800);
      expect(graph.options.height).toBe(600);
      expect(scroller?.options.autoResize).toBe(false);
    });

    it("lets the scroller clip the canvas instead of the inner graph surface", () => {
      manager.init(container);

      const style = document.querySelector("style[data-fd-ports]");

      expect(style?.textContent).toContain(".x6-graph { overflow: visible !important; }");
    });

    it("dispose clears the underlying graph", () => {
      manager.init(container);
      manager.dispose();
      expect(manager.getX6Graph()).toBeNull();
    });

    it("removes document-level drag listeners on dispose", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      const removeSpy = vi.spyOn(document, "removeEventListener");
      manager.init(container);
      const graph = manager.getX6Graph();
      if (!graph) throw new Error("Expected graph after initialization");
      const mouseUpListener = addSpy.mock.calls
        .filter(([type]) => type === "mouseup")
        .slice(-1)[0]?.[1];
      const removeGraphSpy = vi.spyOn(graph.container, "removeEventListener");

      manager.dispose();

      expect(mouseUpListener).toBeDefined();
      expect(removeSpy).toHaveBeenCalledWith("mouseup", mouseUpListener);
      expect(removeGraphSpy).toHaveBeenCalledWith("mousedown", expect.any(Function), true);
      addSpy.mockRestore();
      removeSpy.mockRestore();
      removeGraphSpy.mockRestore();
    });
  });

  describe("node CRUD", () => {
    beforeEach(() => {
      manager.init(container);
    });

    it("addNode creates a node and returns its id", () => {
      const id = manager.addNode({ id: "n1", type: "fd-rect", x: 10, y: 20 });
      expect(id).toBe("n1");
      expect(manager.getCellById("n1")).toBeTruthy();
    });

    it("removeCell removes the node", () => {
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });
      manager.removeCell("n1");
      expect(manager.getCellById("n1")).toBeNull();
    });

    it("updateNodeData merges data onto the cell", () => {
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0, data: { foo: "bar" } });
      manager.updateNodeData("n1", { baz: "qux" });
      const cell = manager.getCellById("n1") as { getData(): Record<string, unknown> };
      expect(cell.getData()).toMatchObject({ foo: "bar", baz: "qux" });
    });

    it("keeps model references out of X6 data and releases them with cells", () => {
      const model = { marker: "original model" };
      manager.addNode({
        id: "n1",
        type: "fd-rect",
        x: 0,
        y: 0,
        data: { contentNode: model, title: "first" },
      });
      const cell = manager.getCellById("n1") as { getData(): Record<string, unknown> };
      expect(cell.getData()).toMatchObject({ title: "first" });
      expect(cell.getData()).not.toHaveProperty("contentNode");
      expect(JSON.stringify(manager.toJSON())).not.toContain("original model");
      manager.updateNodeData("n1", { contentNode: model, title: "second" });
      expect(cell.getData()).toMatchObject({ title: "second" });
      const refs = (manager as unknown as { contentNodeByCellId: Map<string, unknown> })
        .contentNodeByCellId;
      expect(refs.get("n1")).toBe(model);
      manager.removeCell("n1");
      expect(refs.size).toBe(0);
      manager.addNode({ id: "n2", type: "fd-rect", x: 0, y: 0, data: { contentNode: model } });
      manager.dispose();
      expect(refs.size).toBe(0);
    });

    it("resetCells clears existing cells and adds new ones", () => {
      manager.addNode({ id: "old", type: "fd-rect", x: 0, y: 0 });
      manager.resetCells(
        [
          { id: "n1", type: "fd-rect", x: 0, y: 0 },
          { id: "n2", type: "fd-circle", x: 100, y: 100 },
        ],
        [],
      );
      expect(manager.getCellById("old")).toBeNull();
      expect(manager.getCellById("n1")).toBeTruthy();
      expect(manager.getCellById("n2")).toBeTruthy();
    });
  });

  describe("edge CRUD", () => {
    beforeEach(() => {
      manager.init(container);
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });
      manager.addNode({ id: "n2", type: "fd-rect", x: 200, y: 0 });
    });

    it("addEdge connects two nodes by id", () => {
      const id = manager.addEdge({ id: "e1", source: "n1", target: "n2" });
      expect(id).toBe("e1");
      expect(manager.getCellById("e1")).toBeTruthy();
    });

    it("addEdge supports PortRef source/target", () => {
      const id = manager.addEdge({
        id: "e2",
        source: { cell: "n1", port: "out" },
        target: { cell: "n2", port: "in" },
      });
      expect(manager.getCellById(id)).toBeTruthy();
    });

    it("fills missing ports for manual vertices and retains them during updates", () => {
      manager.registerNodeType(
        { name: "ports", typeName: "ports" },
        {
          type: "node",
          shape: "fd-rect",
          ports: [
            { id: "out-right", group: "out", position: "right" },
            { id: "in-left", group: "in", position: "left" },
          ],
        },
      );
      manager.addNode({ id: "a", type: "ports", x: 0, y: 0 });
      manager.addNode({ id: "b", type: "ports", x: 300, y: 0 });
      manager.addEdge({ id: "manual", source: "a", target: "b", vertices: [{ x: 200, y: 50 }] });
      const edge = manager.getCellById("manual") as {
        getSourcePortId(): string;
        getTargetPortId(): string;
      };
      expect(edge.getSourcePortId()).toBe("out-right");
      expect(edge.getTargetPortId()).toBe("in-left");
      manager.updateEdge({
        id: "manual",
        source: "a",
        target: "b",
        vertices: [{ x: 200, y: 50 }],
        labels: ["label"],
      });
      expect(edge.getSourcePortId()).toBe("out-right");
      expect(edge.getTargetPortId()).toBe("in-left");
    });

    it("keeps curved edges router-free on projection and update", () => {
      manager.registerEdgeType("curve", { router: null, connector: { name: "port-curve" } });
      manager.addEdge({ id: "curve-edge", type: "curve", source: "n1", target: "n2" });
      const edge = manager.getCellById("curve-edge") as {
        getRouter(): unknown;
        hasTool(name: string): boolean;
      };
      expect(edge.getRouter()).toBeFalsy();
      manager.updateEdge({
        id: "curve-edge",
        type: "curve",
        source: "n1",
        target: "n2",
        vertices: [{ x: 100, y: 20 }],
      });
      expect(edge.getRouter()).toBeFalsy();
      (manager.getX6Graph() as Graph).trigger("edge:mouseenter", { edge } as never);
      expect(edge.hasTool("flow-routed-segments")).toBe(false);
    });

    it("addEdge does not attach tools by default (tools appear on hover)", () => {
      manager.addEdge({ id: "e3", source: "n1", target: "n2" });
      const edge = manager.getCellById("e3") as { hasTool(name: string): boolean };
      expect(edge.hasTool("vertices")).toBe(false);
      expect(edge.hasTool("segments")).toBe(false);
    });
  });

  describe("custom edge components (registerEdgeType)", () => {
    beforeEach(() => {
      manager.init(container);
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });
      manager.addNode({ id: "n2", type: "fd-rect", x: 200, y: 0 });
    });

    it("renders a registered EdgeComponentProps component into the edge label", async () => {
      manager.registerEdgeType("labeled-edge", {
        component: ({ data }) =>
          `edge-label:${(data as { text?: string } | undefined)?.text ?? ""}`,
      });
      expect(() => {
        manager.addEdge({
          id: "e1",
          type: "labeled-edge",
          source: "n1",
          target: "n2",
          data: { text: "hello" },
        });
      }).not.toThrow();

      await vi.waitFor(() => {
        expect(container.textContent).toContain("edge-label:hello");
      });
    });

    it("applies defaultAttrs/router/connector from the registered edge type", () => {
      manager.registerEdgeType("styled-edge", {
        defaultAttrs: { line: { stroke: "#ff0000" } },
        router: "manhattan",
        connector: "rounded",
      });
      const id = manager.addEdge({ id: "e2", type: "styled-edge", source: "n1", target: "n2" });
      expect(manager.getCellById(id)).toBeTruthy();
    });
  });

  describe("viewport", () => {
    beforeEach(() => {
      manager.init(container);
    });

    it("getZoom defaults to 1", () => {
      expect(manager.getZoom()).toBe(1);
    });

    it("zoomTo updates the zoom level", () => {
      manager.zoomTo(1.5);
      expect(manager.getZoom()).toBeCloseTo(1.5);
    });

    it("resize and centerContent do not throw", () => {
      expect(() => manager.resize(640, 480)).not.toThrow();
      const graph = manager.getX6Graph() as Graph;
      expect(graph.options.width).toBe(640);
      expect(graph.options.height).toBe(480);
      expect(() => manager.centerContent()).not.toThrow();
    });

    it("extends the scroller when an existing node is dragged against its edge", () => {
      const graph = manager.getX6Graph() as Graph;
      const scroller = graph.getPlugin<Scroller>("scroller")!;
      let edgeScrollLeft = 100;
      Object.defineProperties(scroller.container, {
        clientWidth: { configurable: true, value: 800 },
        clientHeight: { configurable: true, value: 600 },
        scrollWidth: { configurable: true, value: 900 },
        scrollHeight: { configurable: true, value: 700 },
        scrollLeft: {
          configurable: true,
          get: () => edgeScrollLeft,
          set: (value: number) => {
            edgeScrollLeft = Math.min(value, 100);
          },
        },
        scrollTop: { configurable: true, writable: true, value: 0 },
      });
      scroller.container.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      });
      const centerPoint = vi.spyOn(scroller, "centerPoint");
      const nodeId = manager.addNode({ id: "moving-node", type: "fd-rect", x: 100, y: 100 });
      const node = graph.getCellById(nodeId);
      const center = graph.clientToLocal(400, 300);

      graph.trigger("node:moving", {
        e: new MouseEvent("mousemove", { clientX: 799, clientY: 300 }),
        node,
      } as never);

      expect(centerPoint).toHaveBeenCalledTimes(1);
      expect(centerPoint.mock.calls[0][0]).toBeGreaterThan(center.x);
    });

    it("requires panel dwell before edge pan and keeps owner/foreign panels isolated", async () => {
      const graph = manager.getX6Graph() as Graph;
      const scroller = graph.getPlugin<Scroller>("scroller")!;
      let scrollLeft = 100;
      Object.defineProperties(scroller.container, {
        clientWidth: { configurable: true, value: 800 },
        clientHeight: { configurable: true, value: 600 },
        scrollWidth: { configurable: true, value: 900 },
        scrollHeight: { configurable: true, value: 700 },
        scrollLeft: {
          configurable: true,
          get: () => scrollLeft,
          set: (value: number) => {
            scrollLeft = Math.min(value, 100);
          },
        },
        scrollTop: { configurable: true, writable: true, value: 0 },
      });
      scroller.container.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      });
      graph.container.getBoundingClientRect = scroller.container.getBoundingClientRect;
      const centerPoint = vi.spyOn(scroller, "centerPoint");
      manager.registerNodeType(
        { name: "task", typeName: "task" },
        { type: "node", shape: "fd-rect" },
      );
      const overlay = document.createElement("div");
      overlay.dataset.fdArea = "inspector";
      overlay.getBoundingClientRect = () => ({
        x: 700,
        y: 250,
        left: 700,
        top: 250,
        right: 800,
        bottom: 350,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      });
      const otherWorkbench = document.createElement("div");
      otherWorkbench.dataset.fdArea = "workbench";
      const otherPanel = document.createElement("div");
      otherPanel.dataset.fdArea = "inspector";
      otherPanel.getBoundingClientRect = () => ({
        x: 300,
        y: 250,
        left: 300,
        top: 250,
        right: 500,
        bottom: 350,
        width: 200,
        height: 100,
        toJSON: () => ({}),
      });
      otherWorkbench.appendChild(otherPanel);
      const containerParent = container.parentElement;
      if (!containerParent) throw new Error("Expected graph container parent");
      containerParent.insertBefore(otherWorkbench, container);
      container.appendChild(overlay);
      let droppedNode: ReturnType<typeof graph.getCellById> | null = null;
      manager.on("node:added-by-stencil" as never, (args: unknown) => {
        droppedNode = (args as { cell?: ReturnType<typeof graph.getCellById> }).cell ?? null;
      });

      const center = graph.clientToLocal(400, 300);
      manager.startNodeDrag(
        "task",
        new MouseEvent("mousedown", { clientX: 20, clientY: 20, bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 799, clientY: 300, bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 550));
      expect(centerPoint).not.toHaveBeenCalled();
      document.dispatchEvent(
        new MouseEvent("mouseup", { clientX: 799, clientY: 300, bubbles: true }),
      );
      expect(droppedNode).toBeNull();

      manager.startNodeDrag(
        "task",
        new MouseEvent("mousedown", { clientX: 20, clientY: 20, bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 795, clientY: 400, bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(centerPoint).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(centerPoint.mock.calls[0][0]).toBeGreaterThan(center.x);
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 400, clientY: 300, bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mouseup", { clientX: 400, clientY: 300, bubbles: true }),
      );

      if (!droppedNode?.isNode()) throw new Error("Expected panel-dropped node");
      const bbox = droppedNode.getBBox();
      const topLeft = graph.localToClient(bbox.x, bbox.y);
      const bottomRight = graph.localToClient(bbox.x + bbox.width, bbox.y + bbox.height);
      expect(topLeft.x).toBeGreaterThanOrEqual(0);
      expect(bottomRight.x).toBeLessThanOrEqual(800);
      const droppedCenter = graph.localToClient(bbox.getCenter());
      expect(Math.abs(droppedCenter.x - 400)).toBeLessThanOrEqual(graph.getGridSize());
      expect(Math.abs(droppedCenter.y - 300)).toBeLessThanOrEqual(graph.getGridSize());
      expect(topLeft.x < 800 && bottomRight.x > 700 && topLeft.y < 350 && bottomRight.y > 250).toBe(
        false,
      );
      overlay.remove();
      otherWorkbench.remove();
    });

    it("does not offset an existing node when it is released at the viewport edge", () => {
      const graph = manager.getX6Graph() as Graph;
      const scroller = graph.getPlugin<Scroller>("scroller")!;
      const nodeId = manager.addNode({ id: "edge-node", type: "fd-rect", x: 100, y: 100 });
      const node = graph.getCellById(nodeId);
      if (!node?.isNode()) throw new Error("Expected graph node");

      const bbox = node.getBBox();
      const topLeft = graph.localToClient(bbox.x, bbox.y);
      const bottomRight = graph.localToClient(bbox.x + bbox.width, bbox.y + bbox.height);
      scroller.container.getBoundingClientRect = () => ({
        x: topLeft.x - 20,
        y: topLeft.y - 20,
        left: topLeft.x - 20,
        top: topLeft.y - 20,
        right: bottomRight.x - 10,
        bottom: bottomRight.y + 20,
        width: bottomRight.x - topLeft.x + 10,
        height: bottomRight.y - topLeft.y + 40,
        toJSON: () => ({}),
      });

      graph.trigger("node:moved", { node } as never);

      expect(node.getBBox()).toEqual(bbox);
      expect(graph.localToClient(node.getBBox().x, node.getBBox().y)).toEqual(topLeft);
    });
  });

  describe("selection", () => {
    beforeEach(() => {
      manager.init(container);
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });
      manager.addNode({ id: "n2", type: "fd-rect", x: 200, y: 0 });
    });

    it("getSelection starts empty", () => {
      expect(manager.getSelection()).toEqual([]);
    });

    it("select sets the current selection", () => {
      manager.select(["n1"]);
      expect(manager.getSelection()).toEqual(["n1"]);
    });

    it("select replaces the previous selection", () => {
      manager.select(["n1"]);
      manager.select(["n2"]);
      expect(manager.getSelection()).toEqual(["n2"]);
    });
  });

  describe("coordinate transforms", () => {
    beforeEach(() => {
      manager.init(container);
    });

    it("clientToLocal returns a point", () => {
      const point = manager.clientToLocal(0, 0);
      expect(point).toHaveProperty("x");
      expect(point).toHaveProperty("y");
    });

    it("localToClient returns a point", () => {
      const point = manager.localToClient(0, 0);
      expect(point).toHaveProperty("x");
      expect(point).toHaveProperty("y");
    });
  });

  describe("events", () => {
    beforeEach(() => {
      manager.init(container);
    });

    it("on/off registers and unregisters a handler", () => {
      let called = false;
      const handler = () => {
        called = true;
      };
      manager.on("blank:click", handler);
      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });
      manager.off("blank:click", handler);
      expect(called).toBe(false);
    });
  });

  describe("ports", () => {
    it("switches only generic directional ports when a node crosses sides", () => {
      const ports = [
        { group: "out" as const, position: "right" as const },
        { group: "out" as const, position: "bottom" as const },
        { id: "semantic", group: "out" as const, position: "left" as const, dataType: "VALUE" },
        { group: "in" as const, position: "left" as const },
        { group: "in" as const, position: "top" as const },
      ];
      manager.registerNodeType(
        { name: "directional", typeName: "directional" },
        { type: "node", shape: "fd-rect", ports },
      );
      manager.addNode({ id: "a", type: "directional", x: 0, y: 0 });
      manager.addNode({ id: "b", type: "directional", x: 300, y: 0 });
      const graph = manager.getX6Graph()!;
      manager.addEdge({
        id: "generic",
        source: { cell: "a", port: "out-right" },
        target: { cell: "b", port: "in-left" },
        vertices: [{ x: 200, y: 60 }],
      });
      manager.addEdge({
        id: "typed",
        source: { cell: "a", port: "semantic" },
        target: { cell: "b", port: "in-left" },
      });
      const node = graph.getCellById("a") as Node;
      node.position(300, -300);
      graph.trigger("node:moved", { node } as never);
      const edge = graph.getCellById("generic") as Edge;
      expect(edge.getSourcePortId()).toBe("out-bottom");
      expect(edge.getTargetPortId()).toBe("in-top");
      expect(edge.getVertices()).toEqual([]);
      expect((graph.getCellById("typed") as Edge).getSourcePortId()).toBe("semantic");
      node.position(600, 0);
      graph.trigger("node:moved", { node } as never);
      expect(edge.getSourcePortId()).not.toBe("semantic");
    });

    beforeEach(() => {
      manager.init(container);
    });

    it("retains existing endpoints when the semantic validator rejects the geometric candidate", () => {
      manager.dispose();
      manager.init(container, {
        connecting: { connectionValidator: (context) => context.sourcePort?.position === "right" },
      });
      manager.registerNodeType(
        { name: "validated", typeName: "validated" },
        {
          type: "node",
          shape: "fd-rect",
          ports: [
            { group: "out", position: "right" },
            { group: "out", position: "bottom" },
            { group: "in", position: "left" },
            { group: "in", position: "top" },
          ],
        },
      );
      manager.addNode({ id: "a", type: "validated", x: 0, y: 0 });
      manager.addNode({ id: "b", type: "validated", x: 300, y: 0 });
      manager.addEdge({
        id: "edge",
        source: { cell: "a", port: "out-right" },
        target: { cell: "b", port: "in-left" },
      });
      const graph = manager.getX6Graph()!;
      const node = graph.getCellById("a") as Node;
      node.position(300, -300);
      graph.trigger("node:moved", { node } as never);
      const edge = graph.getCellById("edge") as Edge;
      expect(edge.getSourcePortId()).toBe("out-right");
      expect(edge.getTargetPortId()).toBe("in-left");
    });

    it("preserves configured router options for manual vertices and resolves named port axes", () => {
      manager.registerNodeType(
        { name: "named", typeName: "named" },
        {
          type: "node",
          shape: "fd-rect",
          ports: [
            { id: "output", group: "out", position: "bottom", dataType: "VALUE" },
            { id: "input", group: "in", position: "top", dataType: "VALUE" },
          ],
        },
      );
      manager.registerEdgeType("configured-orth", {
        router: { name: "manhattan", args: { padding: 32, step: 12 } },
      });
      manager.addNode({ id: "a", type: "named", x: 0, y: 0 });
      manager.addNode({ id: "b", type: "named", x: 300, y: 200 });
      const config = {
        id: "manual-route",
        type: "configured-orth",
        source: { cell: "a", port: "output" },
        target: { cell: "b", port: "input" },
        vertices: [{ x: 200, y: 100 }],
      };
      manager.addEdge(config);
      const edge = manager.getCellById(config.id) as Edge;
      const assertRoute = () => {
        expect(edge.getRouter()).toMatchObject({
          name: "flow-orthogonal",
          args: { padding: 32, step: 12, startDirections: ["bottom"], endDirections: ["top"] },
        });
      };
      assertRoute();
      manager.updateEdge(config);
      assertRoute();
    });

    it("projects curve port tangents on first render and retains custom curve connectors", () => {
      manager.registerNodeType(
        { name: "curve-node", typeName: "curve-node" },
        {
          type: "node",
          shape: "fd-rect",
          ports: [
            { id: "output", group: "out", position: "right", dataType: "VALUE" },
            { id: "input", group: "in", position: "left", dataType: "VALUE" },
          ],
        },
      );
      manager.addNode({ id: "a", type: "curve-node", x: 0, y: 0 });
      manager.addNode({ id: "b", type: "curve-node", x: 300, y: 200 });
      manager.registerEdgeType("curve-tangent", {
        router: null,
        connector: { name: "port-curve" },
      });
      manager.registerEdgeType("custom-curve", { router: null, connector: { name: "smooth" } });
      for (const type of ["curve-tangent", "custom-curve"]) {
        const config = {
          id: type,
          type,
          source: { cell: "a", port: "output" },
          target: { cell: "b", port: "input" },
        };
        manager.addEdge(config);
        const edge = manager.getCellById(type) as Edge;
        expect(edge.getRouter()).toBeFalsy();
        if (type === "curve-tangent")
          expect(edge.getConnector()).toMatchObject({
            name: "port-curve",
            args: { sourceDir: "right", targetDir: "left" },
          });
        manager.updateEdge(config);
        expect(edge.getConnector()?.name).toBe(type === "custom-curve" ? "smooth" : "port-curve");
      }
    });

    it("registerNodeType stores port definitions retrievable via getPortDefinition", () => {
      manager.registerNodeType(
        { name: "custom-node", typeName: "CustomNode" },
        {
          type: "node",
          shape: "fd-rect",
          ports: [{ id: "out", group: "out", position: "right", dataType: "string" }],
        },
      );
      manager.addNode({ id: "n1", type: "custom-node", x: 0, y: 0 });
      const port = manager.getPortDefinition("n1", "out");
      expect(port).toMatchObject({ id: "out", group: "out", dataType: "string" });
    });

    it("getPortDefinition returns null for unknown node", () => {
      expect(manager.getPortDefinition("missing", "out")).toBeNull();
    });

    it("translates port label into a title markup for hover display", () => {
      manager.registerNodeType(
        { name: "labeled-node", typeName: "labeled-node" },
        {
          type: "node",
          component: () => null,
          ports: [{ id: "out", group: "out", position: "right", label: "Output" }],
        },
      );
      manager.addNode({ id: "n1", type: "labeled-node", x: 0, y: 0 });
      const cell = manager.getCellById("n1") as {
        getPort(id: string): { attrs?: { title?: { text?: string } } };
      };
      expect(cell.getPort("out")?.attrs?.title?.text).toBe("Output");
    });
  });

  describe("serialization", () => {
    beforeEach(() => {
      manager.init(container);
    });

    it("toJSON returns empty graph data when uninitialized content", () => {
      const data = manager.toJSON();
      expect(data.nodes).toEqual([]);
      expect(data.edges).toEqual([]);
    });

    it("toJSON reflects added nodes and edges", () => {
      manager.addNode({ id: "n1", type: "fd-rect", x: 10, y: 20 });
      manager.addNode({ id: "n2", type: "fd-rect", x: 100, y: 20 });
      manager.addEdge({ id: "e1", source: "n1", target: "n2" });

      const data = manager.toJSON();
      expect(data.nodes).toHaveLength(2);
      expect(data.edges).toHaveLength(1);
      expect(data.nodes.find((n) => n.id === "n1")).toMatchObject({ x: 10, y: 20 });
    });

    it("fromJSON rebuilds the graph from GraphData", () => {
      manager.fromJSON({
        nodes: [{ id: "n1", type: "fd-rect", x: 0, y: 0 }],
        edges: [],
      });
      expect(manager.getCellById("n1")).toBeTruthy();
    });
  });

  describe("escape hatches", () => {
    it("useX6Plugin does not throw when graph is initialized", () => {
      manager.init(container);
      expect(() => manager.useX6Plugin({ name: "noop", init() {}, dispose() {} })).not.toThrow();
    });
  });

  describe("stencil", () => {
    let stencilContainer: HTMLElement;

    beforeEach(() => {
      manager.init(container);
      stencilContainer = document.createElement("div");
      document.body.appendChild(stencilContainer);
    });

    afterEach(() => {
      document.body.removeChild(stencilContainer);
    });

    it("groups registered node types by NodeMeta.category and mounts into the container", () => {
      manager.registerNodeType(
        { name: "task", typeName: "task", category: "flow" },
        { type: "node", shape: "fd-rect" },
      );
      manager.registerNodeType(
        { name: "gateway", typeName: "gateway", category: "flow" },
        { type: "node", shape: "fd-diamond" },
      );
      manager.registerNodeType(
        { name: "start", typeName: "start", category: "events" },
        { type: "node", shape: "fd-circle" },
      );

      expect(() => manager.createStencil(stencilContainer)).not.toThrow();
      expect(stencilContainer.children.length).toBeGreaterThan(0);
    });

    it("replaces localized metadata for a node type when its translated name changes", () => {
      manager.registerNodeType(
        { name: "开始", typeName: "StartEvent", category: "events", categoryTitle: "事件" },
        { type: "node", shape: "fd-circle" },
      );
      manager.registerNodeType(
        { name: "Start", typeName: "StartEvent", category: "events", categoryTitle: "Events" },
        { type: "node", shape: "fd-circle" },
      );

      expect(manager.getStencilNodeGroups()).toEqual([
        {
          name: "events",
          title: "Events",
          items: [{ type: "Start", name: "Start", icon: "", shape: "fd-circle" }],
        },
      ]);
    });

    it("uses explicit groups when provided instead of auto-derived categories", () => {
      manager.registerNodeType(
        { name: "task", typeName: "task", category: "flow" },
        { type: "node", shape: "fd-rect" },
      );
      expect(() => {
        manager.createStencil(stencilContainer, [{ name: "flow", title: "Flow Nodes" }]);
      }).not.toThrow();
    });

    it("synthesizes node:added-by-stencil when a cell is added with a stencil marker", () => {
      manager.createStencil(stencilContainer);
      const handler = vi.fn();
      manager.on("node:added-by-stencil" as never, handler);

      const graph = manager.getX6Graph() as { addNode(metadata: unknown, options?: unknown): void };
      graph.addNode(
        { shape: "fd-rect", id: "dropped-1", x: 0, y: 0 },
        { stencil: "fake-stencil-id" },
      );

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not fire node:added-by-stencil for programmatic addNode calls", () => {
      manager.createStencil(stencilContainer);
      const handler = vi.fn();
      manager.on("node:added-by-stencil" as never, handler);

      manager.addNode({ id: "n1", type: "fd-rect", x: 0, y: 0 });

      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts stencil drops in the scroller viewport when the graph has been panned", async () => {
      manager.registerNodeType(
        { name: "task", typeName: "task" },
        { type: "node", shape: "fd-rect" },
      );
      const graph = manager.getX6Graph() as Graph;
      const scroller = graph.getPlugin<Scroller>("scroller");
      const graphContainer = graph.container;
      const originalGraphRect = graphContainer.getBoundingClientRect;
      const originalScrollerRect = scroller!.container.getBoundingClientRect;

      Object.defineProperties(scroller!.container, {
        clientWidth: { configurable: true, value: 800 },
        clientHeight: { configurable: true, value: 600 },
      });
      scroller!.container.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      });
      graphContainer.getBoundingClientRect = () => ({
        x: 0,
        y: -500,
        left: 0,
        top: -500,
        right: 800,
        bottom: 100,
        width: 800,
        height: 600,
        toJSON: () => ({}),
      });

      const handler = vi.fn();
      manager.on("node:added-by-stencil" as never, handler);
      manager.startNodeDrag(
        "task",
        new MouseEvent("mousedown", { clientX: 20, clientY: 20, bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 400, clientY: 300, bubbles: true }),
      );
      document.dispatchEvent(
        new MouseEvent("mouseup", { clientX: 400, clientY: 300, bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(handler).toHaveBeenCalledTimes(1);

      graphContainer.getBoundingClientRect = originalGraphRect;
      scroller!.container.getBoundingClientRect = originalScrollerRect;
    });
  });
});
