import { runCleanupTasks } from "./cleanup-tasks";
import type { Graph } from "@antv/x6";
import { Stencil } from "@antv/x6-plugin-stencil";
import type { Dnd } from "@antv/x6-plugin-dnd";
import type { NodeMeta, NodeView } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import { StableViewportDnd, type DragEdgePanController } from "./viewport-input";
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from "./graph-defaults";
export interface StencilGroupConfig {
  name: string;
  title?: string;
}

export interface StencilNodeItem {
  type: string;
  name: string;
  icon: string;
  shape: string;
}

export interface StencilNodeGroup {
  name: string;
  title: string;
  items: StencilNodeItem[];
}

/** Owns palette stencil and native Dnd resources, not the document it previews. */
export class StencilResources {
  private stencil: Stencil | null = null;
  private dnd: Dnd | null = null;
  private stencilBridgeBound = false;
  constructor(
    private currentGraph: () => Graph | null,
    private nodeTypes: ReadonlyMap<string, { meta: NodeMeta; view: NodeView }>,
    private getEdgePan: () => DragEdgePanController | null,
  ) {}
  private assertGraph(): Graph {
    const graph = this.currentGraph();
    if (!graph) throw new Error("GraphManager has not been initialized. Call init() first.");
    return graph;
  }
  createStencil(container: HTMLElement, groups?: StencilGroupConfig[]): void {
    const graph = this.assertGraph();
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    const categoryTitles = new Map<string, string>();
    this.getLatestNodeTypeEntries().forEach(({ meta, view }) => {
      if (view.draggable === false) return;
      const groupName = meta.category || "default";
      if (!categoryTitles.has(groupName))
        categoryTitles.set(groupName, meta.categoryTitle || groupName);
      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }
      const icon = typeof meta.icon === "string" ? meta.icon : "";
      const baseShape = this.stencilBaseShape(view.shape);
      const isCircle = baseShape === "circle";
      const isDiamond = baseShape === "polygon";

      const stencilW = isCircle || isDiamond ? 36 : 140;
      const stencilH = isCircle || isDiamond ? 36 : 32;

      grouped.get(groupName)!.push({
        shape: baseShape,
        width: stencilW,
        height: stencilH,
        label: isCircle || isDiamond ? icon : `${icon}  ${meta.name}`,
        data: { __nodeType: meta.typeName },
        attrs: {
          body: {
            stroke: "#d9d9d9",
            strokeWidth: 1,
            fill: "#ffffff",
            rx: 4,
            ry: 4,
            ...(isDiamond ? { refPoints: "0,10 10,0 20,10 10,20" } : {}),
          },
          label: {
            fill: "#333",
            fontSize: isCircle || isDiamond ? 14 : 12,
            textAnchor: isCircle || isDiamond ? "middle" : "middle",
          },
        },
      });
    });

    const stencilGroups = groups?.length
      ? groups
      : Array.from(grouped.keys()).map((name) => ({
          name,
          title: categoryTitles.get(name) || this.localizeStencilCategory(name),
        }));

    const totalNodes = Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0);
    const graphHeight = Math.max(totalNodes * 52 + 60, 180);

    this.stencil = new Stencil({
      title: t("graph.stencil.title"),
      target: graph,
      groups: stencilGroups,
      stencilGraphWidth: 180,
      stencilGraphHeight: graphHeight,
      layoutOptions: {
        columns: 1,
        columnWidth: 160,
        rowHeight: 48,
        dx: 16,
        dy: 8,
      },
    });
    container.appendChild((this.stencil as unknown as { container: HTMLElement }).container);

    stencilGroups.forEach((group) => {
      const nodes = grouped.get(group.name) ?? [];
      if (nodes.length) {
        this.stencil!.load(nodes, group.name);
      }
    });

    if (!this.stencilBridgeBound) {
      this.stencilBridgeBound = true;
      graph.on("node:added", (args: { options?: { stencil?: string } }) => {
        if (args.options?.stencil) {
          graph.trigger("node:added-by-stencil", args);
        }
      });
    }
  }

  stencilBaseShape(shape?: string): string {
    if (!shape) return "rect";
    if (shape.includes("circle")) return "circle";
    if (shape.includes("diamond")) return "polygon";
    return "rect";
  }

  getLatestNodeTypeEntries(): Array<{ meta: NodeMeta; view: NodeView }> {
    const latest = new Map<string, { meta: NodeMeta; view: NodeView }>();
    this.nodeTypes.forEach((entry) => latest.set(entry.meta.typeName, entry));
    return Array.from(latest.values());
  }

  localizeStencilCategory(name: string): string {
    return name === "default" ? t("graph.category.default") : name;
  }

  getStencilNodeGroups(): StencilNodeGroup[] {
    const grouped = new Map<string, StencilNodeItem[]>();
    const categoryTitles = new Map<string, string>();
    this.getLatestNodeTypeEntries().forEach(({ meta, view }) => {
      if (view.draggable === false) return;
      const groupName = meta.category || "default";
      if (!categoryTitles.has(groupName))
        categoryTitles.set(groupName, meta.categoryTitle || groupName);
      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }
      grouped.get(groupName)!.push({
        type: meta.name,
        name: meta.name,
        icon: typeof meta.icon === "string" ? meta.icon : "",
        shape: view.shape || "fd-rect",
      });
    });
    return Array.from(grouped.entries()).map(([name, items]) => ({
      name,
      title: categoryTitles.get(name) || this.localizeStencilCategory(name),
      items,
    }));
  }

  startNodeDrag(nodeType: string, event: MouseEvent): void {
    const graph = this.assertGraph();
    if (!this.dnd) {
      const edgePan = this.getEdgePan();
      if (!edgePan) throw new Error("Canvas drag input is not initialized");
      this.dnd = new StableViewportDnd({ target: graph }, edgePan);
      if (!this.stencilBridgeBound) {
        this.stencilBridgeBound = true;
        graph.on("node:added", (args: { options?: { stencil?: string } }) => {
          if (args.options?.stencil) {
            graph.trigger("node:added-by-stencil", args);
          }
        });
      }
    }
    const entry = this.nodeTypes.get(nodeType);
    if (!entry) return;
    const baseShape = this.stencilBaseShape(entry.view.shape);
    const w = entry.view.defaultSize?.width ?? DEFAULT_NODE_WIDTH;
    const h = entry.view.defaultSize?.height ?? DEFAULT_NODE_HEIGHT;
    const node = graph.createNode({
      shape: baseShape,
      width: w,
      height: h,
      label: entry.meta.name,
      data: { __nodeType: entry.meta.typeName },
      attrs: {
        body: {
          stroke: "#d9d9d9",
          strokeWidth: 1,
          fill: "#ffffff",
          rx: 4,
          ry: 4,
          ...(baseShape === "polygon" ? { refPoints: "0,10 10,0 20,10 10,20" } : {}),
        },
        label: { fill: "#333", fontSize: 12 },
      },
    });
    const dnd = this.dnd;
    if (dnd) dnd.start(node, event);
  }
  dispose(): void {
    const stencil = this.stencil,
      dnd = this.dnd;
    this.stencil = null;
    this.dnd = null;
    this.stencilBridgeBound = false;
    runCleanupTasks([() => stencil?.dispose(), () => dnd?.dispose()]);
  }
}
