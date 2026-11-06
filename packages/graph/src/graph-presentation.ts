import type { Graph, Cell, Edge, Node as X6Node, Registry } from "@antv/x6";
import { getTheme } from "@flow-designer/model";
import type { GridConfig } from "./contracts";
type ThemeColor = Registry.Attr.ComplexAttrValue;
/** Owns transient paint and theme bookkeeping, never model state. */
export class GraphPresentation {
  themeColors = new WeakMap<Cell, Map<string, { value: ThemeColor; managed: boolean }>>();
  explicitEdgeStrokes = new WeakSet<Edge>();
  selectedNodeStrokes = new WeakMap<X6Node, { stroke: ThemeColor; strokeWidth: ThemeColor }>();
  hoveredEdgeId: string | null = null;
  backgroundOption: string | undefined;
  gridOption: boolean | GridConfig | undefined;
  constructor(
    private currentGraph: () => Graph | null,
    private getSelection: () => string[],
  ) {}
  private get graph(): Graph | null {
    return this.currentGraph();
  }
  private assertGraph(): Graph {
    const graph = this.graph;
    if (!graph) throw new Error("GraphManager has not been initialized. Call init() first.");
    return graph;
  }
  injectPortHoverStyle(_container: HTMLElement): void {
    if (document.querySelector("style[data-fd-ports]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-fd-ports", "");
    style.textContent = [
      ".x6-port-body { opacity: 0; transition: opacity 150ms ease; }",
      ".x6-cell.x6-node:hover .x6-port-body { opacity: 1; }",
      ".x6-cell.x6-node.x6-node-selected .x6-port-body { opacity: 1; }",
      ".x6-graph-connecting .x6-port-body { opacity: 1; }",
      ".x6-graph-scroller { z-index: 1; scrollbar-width: none !important; -ms-overflow-style: none !important; }",
      ".x6-graph-scroller::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }",
      ".x6-graph-scroller-content { position: relative; z-index: 1; }",
      ".x6-graph { overflow: visible !important; }",
      ".x6-graph svg { overflow: visible !important; }",
      ".x6-widget-snapline-horizontal, .x6-widget-snapline-vertical { stroke: #d4d4d4 !important; stroke-dasharray: 4 3; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  setupSelectionHighlight(): void {
    const graph = this.assertGraph();

    graph.on("render:done", () => {
      const ids = new Set(this.getSelection());
      if (this.hoveredEdgeId) ids.add(this.hoveredEdgeId);
      for (const id of ids) {
        const cell = graph.getCellById(id);
        if (cell?.isEdge()) this.paintEdgeHighlight(cell);
      }
    });

    graph.on("selection:changed", ({ added, removed }: { added?: Cell[]; removed?: Cell[] }) => {
      for (const cell of removed ?? []) {
        if (cell.isNode()) {
          const saved = this.selectedNodeStrokes.get(cell);
          if (saved) {
            cell.attr("body/stroke", saved.stroke);
            cell.attr("body/strokeWidth", saved.strokeWidth);
            this.selectedNodeStrokes.delete(cell);
          }
          graph.findViewByCell(cell)?.container.classList.remove("x6-node-selected");
        } else if (cell.isEdge()) {
          this.paintEdgeHighlight(cell);
        }
      }
      for (const cell of added ?? []) {
        if (cell.isNode()) {
          this.selectedNodeStrokes.set(cell, {
            stroke: cell.attr("body/stroke"),
            strokeWidth: cell.attr("body/strokeWidth"),
          });
          cell.attr("body/stroke", "#4d7cfe");
          cell.attr("body/strokeWidth", 2);
          graph.findViewByCell(cell)?.container.classList.add("x6-node-selected");
        } else if (cell.isEdge()) {
          this.paintEdgeHighlight(cell);
        }
      }
    });
  }

  paintEdgeHighlight(edge: Cell, hover = this.hoveredEdgeId === edge.id): void {
    const path = this.graph?.findViewByCell(edge)?.findOne("line");
    if (!path) return;
    const selected = this.getSelection().includes(edge.id);
    const stroke = selected || hover ? "#4d7cfe" : (edge.attr("line/stroke") ?? "#4C6079");
    const width = selected ? 2.5 : hover ? 2 : (edge.attr("line/strokeWidth") ?? 1);
    // X6 reapplies presentation attributes during an asynchronous update. Inline
    // styles keep transient highlighting through that update without touching model attrs.
    const element = path as SVGElement;
    if (selected || hover) {
      element.style.setProperty("stroke", String(stroke));
      element.style.setProperty("stroke-width", String(width));
    } else {
      element.style.removeProperty("stroke");
      element.style.removeProperty("stroke-width");
    }
  }

  resolveBackgroundColor(explicit: string | undefined = this.backgroundOption): string {
    if (explicit) return explicit;
    return getTheme() === "dark" ? "#121722" : "#fffefd";
  }

  resolveGridColor(): string {
    return getTheme() === "dark" ? "#242c3c" : "#e8ebf0";
  }

  translateGrid(grid?: boolean | GridConfig): boolean | Record<string, unknown> {
    if (grid === false) return false;
    const color = this.resolveGridColor();
    if (grid === true || grid === undefined) {
      return { size: 10, visible: true, type: "mesh", args: [{ color, thickness: 1 }] };
    }
    return {
      size: grid.size ?? 10,
      visible: grid.visible ?? true,
      type: grid.type ?? "mesh",
      args: [{ color, thickness: 1 }],
    };
  }

  resolveCanvasPalette(): {
    bodyFill: string;
    eventFill: string;
    bodyStroke: string;
    label: string;
    portFill: string;
    edgeStroke: string;
  } {
    return getTheme() === "dark"
      ? {
          bodyFill: "#1d2432",
          eventFill: "rgba(250, 173, 20, 0.18)",
          bodyStroke: "#3b4860",
          label: "#e7ebf3",
          portFill: "#161b26",
          edgeStroke: "#7d8aa0",
        }
      : {
          bodyFill: "#ffffff",
          eventFill: "#fff7e6",
          bodyStroke: "#d9d9d9",
          label: "#262626",
          portFill: "#ffffff",
          edgeStroke: "#4C6079",
        };
  }

  themeColor(
    cell: Cell,
    path: string,
    current: ThemeColor,
    initial: ThemeColor,
    next: string,
    explicit = false,
  ): ThemeColor {
    let colors = this.themeColors.get(cell);
    if (!colors) {
      colors = new Map();
      this.themeColors.set(cell, colors);
    }
    const previous = colors.get(path);
    const managed = previous
      ? previous.managed && current === previous.value
      : !explicit && (current === undefined || current === initial);
    const value = managed ? next : current;
    colors.set(path, { value, managed });
    return value;
  }

  applyNodeTheme(node: X6Node): void {
    if (typeof node.shape !== "string" || !node.shape.startsWith("fd-")) return;
    const palette = this.resolveCanvasPalette();
    const selected = this.selectedNodeStrokes.get(node);
    const stroke = this.themeColor(
      node,
      "body/stroke",
      selected?.stroke ?? node.attr("body/stroke"),
      "#d9d9d9",
      palette.bodyStroke,
    );
    if (selected) selected.stroke = stroke;
    node.attr({
      body: {
        fill: this.themeColor(
          node,
          "body/fill",
          node.attr("body/fill"),
          node.shape === "fd-rect-event" ? "#fff7e6" : "#ffffff",
          node.shape === "fd-rect-event" ? palette.eventFill : palette.bodyFill,
        ),
        ...(!selected ? { stroke } : {}),
      },
      label: {
        fill: this.themeColor(
          node,
          "label/fill",
          node.attr("label/fill"),
          "#262626",
          palette.label,
        ),
      },
    });
    for (const port of node.getPorts()) {
      if (!port.id) continue;
      const current: ThemeColor = node.getPortProp(port.id, "attrs/circle/fill");
      const fill = this.themeColor(
        node,
        `port/${port.id}/fill`,
        current,
        "#fff",
        palette.portFill,
        current !== undefined,
      );
      if (fill !== current) node.setPortProp(port.id, "attrs/circle/fill", fill);
    }
  }

  applyEdgeTheme(edge: Edge): void {
    const current: ThemeColor = edge.attr("line/stroke");
    const stroke = this.themeColor(
      edge,
      "line/stroke",
      current,
      "#4C6079",
      this.resolveCanvasPalette().edgeStroke,
      this.explicitEdgeStrokes.has(edge),
    );
    if (stroke !== current) edge.attr("line/stroke", stroke);
  }

  applyCanvasTheme(): void {
    const graph = this.graph;
    if (!graph) return;
    graph.drawBackground({ color: this.resolveBackgroundColor() });
    const grid = this.translateGrid(this.gridOption);
    if (grid !== false) {
      graph.drawGrid(grid as Parameters<Graph["drawGrid"]>[0]);
    }
    graph.getNodes().forEach((node) => {
      this.applyNodeTheme(node);
    });
    graph.getEdges().forEach((edge) => {
      this.applyEdgeTheme(edge);
    });
  }
  dispose(): void {
    this.themeColors = new WeakMap();
    this.explicitEdgeStrokes = new WeakSet();
    this.selectedNodeStrokes = new WeakMap();
    this.hoveredEdgeId = null;
  }
}
