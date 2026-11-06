import { truncateNodeLabel } from "./node-label";
import type { GraphNodePatch } from "@flow-designer/core";
import { Markup, type Graph, type Edge, type Registry } from "@antv/x6";
import type { ContentNode } from "@flow-designer/model";
import type { NodeConfig, EdgeConfig, PortRef } from "@flow-designer/core";
import type { GraphData } from "./contracts";
import type { GraphTypeRegistry } from "./type-registry";
import type { GraphPresentation } from "./graph-presentation";
import { translatePorts } from "./port-projection";
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_EDGE_LABEL_WIDTH,
  DEFAULT_EDGE_LABEL_HEIGHT,
  DEFAULT_ROUTER,
} from "./graph-defaults";
import { DEFAULT_PORT_ITEMS } from "./shapes";
import { markRoutingPersisted } from "./edge-routing";
type ThemeColor = Registry.Attr.ComplexAttrValue;
interface RoutingProjection {
  autoSwitchEdgePorts(edge: Edge, preserveSource: boolean, preserveTarget: boolean): void;
  updateRouterDirections(edge: Edge): void;
  updateConnectorDirections(edge: Edge): void;
}
/** Sole writer of cell identity/content indexes and public config → X6 projection. */
export class GraphCellProjection {
  private nodeTypeByCellId = new Map<string, string>();
  private edgeTypeByCellId = new Map<string, string>();
  private contentNodeByCellId = new Map<string, ContentNode>();
  private nodeDataVersion = 0;
  private bulkDepth = 0;
  constructor(
    private currentGraph: () => Graph | null,
    private types: GraphTypeRegistry,
    private presentation: GraphPresentation,
    private routing: RoutingProjection,
    private resolveShape: (shape: string) => string,
  ) {}
  get nodeTypes(): ReadonlyMap<string, string> {
    return this.nodeTypeByCellId;
  }
  get edgeTypes(): ReadonlyMap<string, string> {
    return this.edgeTypeByCellId;
  }
  get contentNodes(): ReadonlyMap<string, ContentNode> {
    return this.contentNodeByCellId;
  }
  private get graph(): Graph | null {
    return this.currentGraph();
  }
  private assertGraph(): Graph {
    const graph = this.graph;
    if (!graph) throw new Error("GraphManager has not been initialized. Call init() first.");
    return graph;
  }
  patchNode(patch: GraphNodePatch): void {
    const node = this.graph?.getCellById(patch.nodeId);
    if (!node?.isNode()) return;
    if (patch.position) {
      const current = node.position();
      if (current.x !== patch.position.x || current.y !== patch.position.y)
        node.position(patch.position.x, patch.position.y);
    }
    if (patch.label !== undefined) {
      const type = this.nodeTypeByCellId.get(patch.nodeId);
      node.setAttrs({
        label: {
          text: truncateNodeLabel(
            patch.label,
            type ? this.types.nodes.get(type)?.view.shape : undefined,
          ),
        },
      });
    }
    for (const port of patch.portLabels ?? [])
      if (node.hasPort(port.portId)) node.setPortProp(port.portId, "attrs/title/text", port.label);
  }
  setEdgeTypeName(id: string, type: string): void {
    this.edgeTypeByCellId.set(id, type);
  }
  forgetCell(id: string): void {
    this.nodeTypeByCellId.delete(id);
    this.contentNodeByCellId.delete(id);
    this.edgeTypeByCellId.delete(id);
  }
  clear(): void {
    this.nodeTypeByCellId.clear();
    this.contentNodeByCellId.clear();
    this.edgeTypeByCellId.clear();
  }
  addNode(config: NodeConfig): string {
    const graph = this.assertGraph();
    const typeEntry = this.types.nodes.get(config.type);
    const shape = this.resolveShape(typeEntry?.view.shape ?? config.type);
    const customPorts = typeEntry?.view.ports?.length
      ? translatePorts(typeEntry.view.ports)
      : undefined;
    const ports = customPorts ?? { items: DEFAULT_PORT_ITEMS };
    const { contentNode, ...data } = config.data ?? {};
    if (contentNode) this.contentNodeByCellId.set(config.id, contentNode as ContentNode);
    const node = graph.addNode(
      {
        id: config.id,
        ...(this.bulkDepth ? { zIndex: 0 } : {}),
        shape,
        x: config.x,
        y: config.y,
        width: config.width ?? typeEntry?.view.defaultSize?.width ?? DEFAULT_NODE_WIDTH,
        height: config.height ?? typeEntry?.view.defaultSize?.height ?? DEFAULT_NODE_HEIGHT,
        label:
          config.label === undefined
            ? undefined
            : truncateNodeLabel(config.label, typeEntry?.view.shape),
        data,
        ports,
      },
      this.bulkDepth ? { sort: false } : undefined,
    );
    this.nodeTypeByCellId.set(node.id, config.type);
    return node.id;
  }

  addEdge(config: EdgeConfig): string {
    const graph = this.assertGraph();
    const typeEntry = config.type ? this.types.edges.get(config.type) : undefined;
    const labels = typeEntry?.component
      ? [
          {
            markup: Markup.getForeignObjectMarkup(),
            attrs: {
              fo: {
                width: DEFAULT_EDGE_LABEL_WIDTH,
                height: DEFAULT_EDGE_LABEL_HEIGHT,
                x: -DEFAULT_EDGE_LABEL_WIDTH / 2,
                y: -DEFAULT_EDGE_LABEL_HEIGHT / 2,
              },
            },
          },
        ]
      : (config.labels as any);
    const defaultEdgeAttrs = {
      line: { stroke: "#4C6079", strokeWidth: 1, targetMarker: { name: "block", size: 8 } },
    };
    const edge = graph.createEdge({
      id: config.id,
      zIndex: -1,
      source: this.toX6Terminal(config.source),
      target: this.toX6Terminal(config.target),
      vertices: config.vertices,
      labels,
      data: config.data,
      attrs: typeEntry?.defaultAttrs ?? defaultEdgeAttrs,
      router: typeEntry?.router === null ? undefined : (typeEntry?.router ?? DEFAULT_ROUTER),
      connector: typeEntry?.connector ?? { name: "normal" },
    });
    const line = typeEntry?.defaultAttrs?.line;
    if (line && typeof line === "object" && "stroke" in line)
      this.presentation.explicitEdgeStrokes.add(edge);
    else
      this.presentation.themeColors.set(
        edge,
        new Map([["line/stroke", { value: edge.attr<ThemeColor>("line/stroke"), managed: true }]]),
      );
    markRoutingPersisted(edge);
    graph.addEdge(edge, this.bulkDepth ? { sort: false } : undefined);
    if (config.type) {
      this.edgeTypeByCellId.set(edge.id, config.type);
    }
    this.routing.autoSwitchEdgePorts(
      edge,
      typeof config.source !== "string",
      typeof config.target !== "string",
    );
    this.routing.updateRouterDirections(edge);
    this.routing.updateConnectorDirections(edge);
    return edge.id;
  }

  batchUpdate<T>(operation: () => T): T {
    const graph = this.assertGraph();
    this.bulkDepth++;
    try {
      return operation();
    } finally {
      if (--this.bulkDepth === 0) graph.model.collection.sort();
    }
  }

  updateEdge(config: EdgeConfig): void {
    const edge = this.graph?.getCellById(config.id);
    if (!edge?.isEdge()) return;
    markRoutingPersisted(edge);
    edge.setSource(typeof config.source === "string" ? { cell: config.source } : config.source);
    edge.setTarget(typeof config.target === "string" ? { cell: config.target } : config.target);
    if (config.type) this.edgeTypeByCellId.set(config.id, config.type);
    this.routing.autoSwitchEdgePorts(
      edge,
      typeof config.source !== "string",
      typeof config.target !== "string",
    );
    edge.setVertices(config.vertices ?? []);
    this.routing.updateRouterDirections(edge);
    this.routing.updateConnectorDirections(edge);
    edge.setData(config.data ?? {}, { overwrite: true });
    if (config.labels) edge.setLabels(config.labels);
  }

  removeCell(id: string): void {
    this.graph?.removeCell(id);
    this.nodeTypeByCellId.delete(id);
    this.contentNodeByCellId.delete(id);
    this.edgeTypeByCellId.delete(id);
  }

  resetCells(nodes: NodeConfig[], edges: EdgeConfig[]): void {
    const graph = this.assertGraph();
    graph.clearCells();
    this.nodeTypeByCellId.clear();
    this.contentNodeByCellId.clear();
    this.edgeTypeByCellId.clear();
    nodes.forEach((node) => this.addNode(node));
    edges.forEach((edge) => this.addEdge(edge));
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const cell = this.graph?.getCellById(nodeId);
    if (cell?.isNode()) {
      const { contentNode, ...rest } = data;
      if (contentNode) this.contentNodeByCellId.set(nodeId, contentNode as ContentNode);
      cell.setData({ ...rest, __modelVersion: ++this.nodeDataVersion }, { overwrite: false });
    }
  }

  toJSON(): GraphData {
    if (!this.graph) {
      return { nodes: [], edges: [] };
    }
    const nodes = this.graph.getNodes().map((node) => {
      const { x, y } = node.position();
      const { width, height } = node.size();
      const { __modelVersion: _version, ...data } = node.getData<Record<string, unknown>>() ?? {};
      return {
        id: node.id,
        type: this.nodeTypeByCellId.get(node.id) ?? (node as unknown as { shape: string }).shape,
        x,
        y,
        width,
        height,
        data,
      };
    });
    const edges = this.graph.getEdges().map((edge) => ({
      id: edge.id,
      type: (edge as unknown as { shape: string }).shape,
      source: this.fromX6Terminal(edge.getSourceCellId(), edge.getSourcePortId()),
      target: this.fromX6Terminal(edge.getTargetCellId(), edge.getTargetPortId()),
      vertices: edge.getVertices() as Array<{ x: number; y: number }>,
      data: edge.getData<Record<string, unknown>>() ?? undefined,
    }));
    return { nodes, edges };
  }

  toX6Terminal(ref: string | PortRef): string | { cell: string; port: string } {
    return typeof ref === "string" ? ref : { cell: ref.cell, port: ref.port };
  }

  fromX6Terminal(cellId: string, portId?: string): string | PortRef {
    return portId ? { cell: cellId, port: portId } : cellId;
  }
}
