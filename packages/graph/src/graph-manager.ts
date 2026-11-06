import { GraphNotifications } from "./graph-notifications";
import type {
  GraphEdit,
  GraphApplicationEvent,
  GraphNodePatch,
  GraphEdgeTypeMetadata,
  GraphConnectionRejection,
  Unsubscribe,
} from "@flow-designer/core";
import { runCleanupTasks } from "./cleanup-tasks";
import { GraphTypeRegistry } from "./type-registry";
import { GraphCellProjection } from "./cell-projection";
import { ViewportResources } from "./viewport-resources";
import {
  StencilResources,
  type StencilGroupConfig,
  type StencilNodeGroup,
} from "./stencil-resources";
import { GraphInteractionSessions } from "./interaction-sessions";
import { DEFAULT_ROUTER } from "./graph-defaults";
import { GraphPresentation } from "./graph-presentation";
import { ConnectionCoordinator } from "./connection-coordinator";
import { Graph, type Cell, type Edge, type Node as X6Node } from "@antv/x6";
import { Selection } from "@antv/x6-plugin-selection";
import { Scroller } from "@antv/x6-plugin-scroller";
import { Snapline } from "@antv/x6-plugin-snapline";
import { Clipboard } from "@antv/x6-plugin-clipboard";
import { Keyboard } from "@antv/x6-plugin-keyboard";
import "@antv/x6-plugin-stencil/dist/index.css";
import { canUsePort } from "@flow-designer/model";
import { subscribeTheme } from "@flow-designer/core";
import type { NodeMeta, NodeView, PortDefinition } from "@flow-designer/model";
import type {
  NodeConfig,
  EdgeConfig,
  ConnectionContext,
  ConnectionCheckOptions,
  ConnectionValidationResult,
  ResolvedConnection,
} from "@flow-designer/core";
import type {
  GraphAdapterPort,
  GraphOptions,
  GridConfig,
  GraphEvent,
  GraphEventHandler,
  GraphData,
  EdgeTypeConfig,
} from "./contracts";
import { GraphReactRendering } from "./react-rendering";
import { installViewportCulling } from "./viewport-culling";
import { registerRoutedSegments } from "./safe-segments";
import { registerPortCurveConnector, installEdgeRouting } from "./edge-routing";
import { registerBuiltinShapes } from "./shapes";
import { installCanvasDragPan, type DragEdgePanController } from "./viewport-input";

export type { StencilGroupConfig, StencilNodeItem, StencilNodeGroup } from "./stencil-resources";

/** Public X6 facade. Internal owners manage definitions, projections, paint and live resources. */
export class GraphManager implements GraphAdapterPort {
  private graph: Graph | null = null;
  private selectionPlugin: Selection | null = null;
  private scroller: Scroller | null = null;
  private interactionMode: ReturnType<GraphAdapterPort["getInteractionMode"]> = "pan";
  private types = new GraphTypeRegistry();
  private presentation = new GraphPresentation(
    () => this.graph,
    () => this.getSelection(),
  );
  private projection: GraphCellProjection = new GraphCellProjection(
    () => this.graph,
    this.types,
    this.presentation,
    {
      autoSwitchEdgePorts: (edge, source, target) => {
        this.connections.autoSwitchEdgePorts(edge, source, target);
      },
      updateRouterDirections: (edge) => {
        this.connections.updateRouterDirections(edge);
      },
      updateConnectorDirections: (edge) => {
        this.connections.updateConnectorDirections(edge);
      },
    },
    (shape) => this.rendering.resolveShape(shape),
  );
  private rendering: GraphReactRendering = new GraphReactRendering(
    (id) => this.projection.contentNodes.get(id),
    (id) => this.getSelection().includes(id),
    (id) => this.projection.edgeTypes.get(id),
    (type) => this.types.edges.get(type),
  );
  private stencilResources = new StencilResources(
    () => this.graph,
    this.types.nodes,
    () => this.dragEdgePan,
  );
  private dragEdgePan: DragEdgePanController | null = null;
  private connections = new ConnectionCoordinator(
    () => this.graph,
    this.projection.nodeTypes,
    this.types.ports,
    this.projection.edgeTypes,
    this.types.edges,
  );
  private notifications = new GraphNotifications((id) => this.getEdgeTypeName(id));
  private sessions = new GraphInteractionSessions(
    () => this.graph,
    this.connections,
    this.presentation,
    this.projection.edgeTypes,
    this.types.edges,
    (id, type) => {
      this.projection.setEdgeTypeName(id, type);
    },
    this.notifications,
  );
  private viewport = new ViewportResources(() => this.graph);
  private domEventCleanups: Array<() => void> = [];

  init(container: HTMLElement, options: GraphOptions = {}): void {
    try {
      this.rendering.begin();
      for (const { meta, view } of this.types.nodes.values())
        this.rendering.registerNode(meta, view);
      registerBuiltinShapes();
      registerPortCurveConnector();
      registerRoutedSegments();
      const viewport = container.parentElement ?? container;
      const width = viewport.clientWidth || container.clientWidth;
      const height = viewport.clientHeight || container.clientHeight;
      const connectionValidator = options.connecting?.connectionValidator;
      this.connections.connectionValidator = connectionValidator;
      this.connections.connectionRules = {
        allowLoop: options.connecting?.allowLoop ?? false,
        allowMulti: options.connecting?.allowMulti ?? true,
      };
      this.presentation.backgroundOption = options.background;
      this.presentation.gridOption = options.grid;
      const self = this;
      const graph: Graph = new Graph({
        container,
        autoResize: false,
        virtual: options.virtual ?? false,
        width: width || undefined,
        height: height || undefined,
        grid: this.translateGrid(options.grid),
        background: { color: this.resolveBackgroundColor(options.background) },
        mousewheel: {
          enabled: true,
          global: true,
          guard: (event: WheelEvent) => {
            const target = event.target;
            return (
              target instanceof Element &&
              !!self.scroller?.container.contains(target) &&
              !target.closest('input, textarea, select, [contenteditable="true"]')
            );
          },
          modifiers: null,
          zoomAtMousePosition: true,
          factor: 1.05,
          minScale: 0.01,
          maxScale: 3,
        },
        highlighting: {
          magnetAdsorbed: {
            name: "stroke",
            args: { padding: 3, attrs: { stroke: "#4d7cfe", strokeWidth: 2 } },
          },
        },
        // Edges must only move via the Segments tool's own handles or by
        // following a connected node. Clicking anywhere on the edge body and
        // dragging (X6's default free-form edge-move interaction) must be
        // disabled, or it produces uncontrolled diagonal segments.
        interacting: {
          edgeMovable: false,
        },
        connecting: {
          snap: { radius: 80 },
          // Blank drops are handled below (`connection:blank`) so the workbench can
          // offer a node picker; when that is disabled, fall back to X6 behaviour.
          allowBlank:
            (options.connecting?.onBlankDrop ?? "choose-node") === "choose-node"
              ? true
              : (options.connecting?.allowBlank ?? false),
          allowLoop: options.connecting?.allowLoop ?? false,
          allowMulti: options.connecting?.allowMulti ?? true,
          allowNode: false,
          highlight: true,
          connectionPoint: { name: "anchor" },
          createEdge() {
            const defaultType = self.getDefaultEdgeType();
            const typeConfig = defaultType ? self.types.edges.get(defaultType) : undefined;
            const attrs = typeConfig?.defaultAttrs ?? {
              line: {
                stroke: "#4C6079",
                strokeWidth: 1,
                targetMarker: { name: "block", size: 8 },
              },
            };
            const router =
              typeConfig?.router === null ? undefined : (typeConfig?.router ?? DEFAULT_ROUTER);
            const connector = typeConfig?.connector ?? { name: "normal" };
            return graph.createEdge({ attrs, router, connector });
          },
          validateConnection: (args) => this.validateConnection(args),
          validateEdge: ({ edge, type, previous }) =>
            this.validateDroppedConnection(edge, type, previous),
        },
        onEdgeLabelRendered: (args) => this.handleEdgeLabelRendered(args),
      });
      this.graph = graph;
      this.notifications.install(graph);
      this.domEventCleanups.push(installEdgeRouting(graph));
      this.domEventCleanups.push(
        subscribeTheme(() => {
          this.applyCanvasTheme();
        }),
      );
      graph.on("cell:added", ({ cell }: { cell: Cell }) => {
        // Colours live in the graph, not in CSS, so every new cell has to pick up
        // the active palette explicitly.
        if (cell.isNode()) {
          this.applyNodeTheme(cell);
        } else if (cell.isEdge()) {
          this.applyEdgeTheme(cell);
        }
      });
      graph.on("cell:removed", ({ cell }) => {
        this.projection.forgetCell(cell.id);
      });
      if (typeof window !== "undefined") {
        const debugWindow = window as Window & {
          __x6_graph?: Graph;
          __graph_manager?: GraphManager;
        };
        debugWindow.__x6_graph = graph;
        debugWindow.__graph_manager = this;
      }

      this.installPlugin(
        graph,
        new Selection({
          enabled: true,
          multiple: true,
          rubberband: true,
          rubberEdge: true,
          showNodeSelectionBox: false,
        }),
      );
      this.selectionPlugin = graph.getPlugin<Selection>("selection") ?? null;
      const scroller = new Scroller({
        enabled: true,
        pannable: false,
        padding: 600,
        autoResize: false,
      });
      this.scroller = scroller;
      this.installPlugin(graph, scroller);
      scroller.togglePanning(this.interactionMode === "pan");
      this.selectionPlugin?.toggleRubberband(this.interactionMode === "select");
      this.setupScrollerAutoFit(graph, scroller);
      const input = installCanvasDragPan(graph, scroller);
      this.dragEdgePan = input.edgePan;
      this.domEventCleanups.push(input.dispose);
      this.observeViewportSize(viewport, graph);
      if (options.snapline !== false) {
        this.installPlugin(graph, new Snapline());
      }
      this.installPlugin(graph, new Clipboard());
      this.installPlugin(graph, new Keyboard());
      this.injectPortHoverStyle(container);
      this.setupSelectionHighlight();
      this.setupEdgeToolsOnHover();
      this.domEventCleanups.push(() => {
        this.sessions.dispose();
      });
      this.setupPortAutoSwitch();
      if ((options.connecting?.onBlankDrop ?? "choose-node") === "choose-node")
        this.setupBlankConnection();
      this.setupEdgeZOrder();
      this.setupTemporaryPan(container, scroller);
      this.domEventCleanups.push(() => {
        this.viewport.disposeListeners();
      });
      if (options.viewportCulling !== false)
        this.domEventCleanups.push(installViewportCulling(graph, scroller));
    } catch (error) {
      try {
        this.dispose();
      } catch (cleanupError) {
        console.error("[flow-designer] graph initialization cleanup failed:", cleanupError);
      }
      throw error;
    }
  }

  private setupTemporaryPan(container: HTMLElement, scroller: Scroller): void {
    this.viewport.setupTemporaryPan(container, scroller);
  }

  private observeViewportSize(viewport: HTMLElement, graph: Graph): void {
    this.viewport.observeViewportSize(viewport, graph);
  }

  private resizeGraph(graph: Graph, width: number, height: number): void {
    this.viewport.resizeGraph(graph, width, height);
  }

  private setupScrollerAutoFit(graph: Graph, scroller: Scroller): void {
    this.viewport.setupScrollerAutoFit(graph, scroller);
  }

  private setupEdgeZOrder(): void {
    const graph = this.assertGraph();
    // Edges must always render below nodes (and other cells) so that when a
    // connection overlaps a node, the node stays fully readable. Send every
    // newly added edge to the back; nodes added later still land on top
    // because new cells receive the highest z by default.
    graph.on("edge:added", ({ edge }: { edge: Cell }) => {
      if (edge.getZIndex() !== -1) edge.setZIndex(-1);
    });
  }

  private installPlugin(graph: Graph, plugin: Parameters<Graph["use"]>[0]): void {
    try {
      graph.use(plugin);
    } catch (error) {
      try {
        plugin.dispose();
      } catch (cleanupError) {
        console.error("[flow-designer] plugin initialization cleanup failed:", cleanupError);
      }
      throw error;
    }
  }
  dispose(): void {
    const graph = this.graph;
    // Detach first: queued work and repeated dispose cannot reuse a failed owner.
    this.graph = null;
    this.selectionPlugin = null;
    this.scroller = null;
    this.dragEdgePan = null;
    runCleanupTasks([
      () => {
        this.notifications.dispose();
      },
      ...this.domEventCleanups.splice(0),
      () => {
        this.sessions.dispose();
      },
      () => {
        this.viewport.disposeListeners();
      },
      () => {
        this.viewport.disposeObserver();
      },
      () => graph?.dispose(),
      () => {
        this.presentation.dispose();
      },
      () => {
        this.projection.clear();
      },
      () => {
        this.rendering.dispose();
      },
      () => {
        this.stencilResources.dispose();
      },
      () => {
        if (typeof window === "undefined") return;
        const debugWindow = window as Window & {
          __x6_graph?: Graph;
          __graph_manager?: GraphManager;
        };
        if (debugWindow.__x6_graph === graph) delete debugWindow.__x6_graph;
        if (debugWindow.__graph_manager === this) delete debugWindow.__graph_manager;
      },
    ]);
  }

  patchNode(patch: GraphNodePatch): void {
    this.projection.patchNode(patch);
  }
  subscribeEdits(listener: (edit: GraphEdit) => void): Unsubscribe {
    return this.notifications.subscribeEdits(listener);
  }
  subscribeEvents(listener: (event: GraphApplicationEvent) => void): Unsubscribe {
    return this.notifications.subscribeEvents(listener);
  }
  notifyConnectionRejected(rejection: GraphConnectionRejection): void {
    void this.graph?.trigger("connection:rejected", { ...rejection });
  }
  getNodePorts(nodeId: string): readonly PortDefinition[] {
    const type = this.projection.nodeTypes.get(nodeId);
    if (!type) return [];
    const ports = this.types.ports.get(type);
    return ports?.map((port) => ({ ...port })) ?? [];
  }

  getEdgeTypeMetadata(name: string): GraphEdgeTypeMetadata | null {
    const config = this.types.edges.get(name);
    return config
      ? {
          ...(config.schema
            ? {
                schema: config.schema.map((field) => ({
                  ...field,
                  ...(field.defaultValue === undefined
                    ? {}
                    : { defaultValue: structuredClone(field.defaultValue) }),
                })),
              }
            : {}),
        }
      : null;
  }

  registerNodeType(meta: NodeMeta, view: NodeView): void {
    this.types.registerNodeType(meta, view);
    this.rendering.registerNode(meta, view);
  }

  registerEdgeType(name: string, config: EdgeTypeConfig): void {
    this.types.registerEdgeType(name, config);
  }

  getEdgeTypeName(cellId: string): string | null {
    return this.projection.edgeTypes.get(cellId) ?? null;
  }

  getEdgeTypeConfig(name: string): EdgeTypeConfig | null {
    return this.types.edges.get(name) ?? null;
  }

  getDefaultEdgeType(): string | null {
    const first = this.types.edges.keys().next();
    return first.done ? null : first.value;
  }

  addNode(config: NodeConfig): string {
    return this.projection.addNode(config);
  }

  addEdge(config: EdgeConfig): string {
    return this.projection.addEdge(config);
  }

  batchUpdate<T>(operation: () => T): T {
    return this.projection.batchUpdate(operation);
  }

  updateEdge(config: EdgeConfig): void {
    this.projection.updateEdge(config);
  }

  removeCell(id: string): void {
    this.projection.removeCell(id);
  }

  resetCells(nodes: NodeConfig[], edges: EdgeConfig[]): void {
    this.projection.resetCells(nodes, edges);
  }

  getCellById(id: string): unknown {
    return this.graph?.getCellById(id) ?? null;
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    this.projection.updateNodeData(nodeId, data);
  }

  zoomTo(factor: number): void {
    this.graph?.zoomTo(factor);
  }

  getZoom(): number {
    return this.graph?.zoom() ?? 1;
  }

  centerContent(): void {
    this.graph?.centerContent({ padding: 40 });
  }

  zoomToFit(): void {
    this.graph?.zoomToFit({ padding: 60, maxScale: 1 });
  }

  resize(width: number, height: number): void {
    if (this.graph) this.resizeGraph(this.graph, width, height);
  }

  select(ids: string[]): void {
    this.selectionPlugin?.reset(ids);
  }

  getSelection(): string[] {
    return this.selectionPlugin?.getSelectedCells().map((cell) => cell.id) ?? [];
  }

  setInteractionMode(mode: ReturnType<GraphAdapterPort["getInteractionMode"]>): void {
    if (this.interactionMode === mode) return;
    this.interactionMode = mode;
    this.scroller?.togglePanning(mode === "pan");
    this.selectionPlugin?.toggleRubberband(mode === "select");
    this.graph?.trigger("interaction:change" as never, { mode } as never);
  }

  getInteractionMode(): ReturnType<GraphAdapterPort["getInteractionMode"]> {
    return this.interactionMode;
  }

  getFirstPortOfGroup(nodeId: string, group: string): PortDefinition | null {
    const type = this.projection.nodeTypes.get(nodeId);
    return (
      (type
        ? this.types.ports
            .get(type)
            ?.find((port) =>
              group === "in" || group === "out"
                ? canUsePort(port, group === "in" ? "target" : "source")
                : port.group === group,
            )
        : undefined) ?? null
    );
  }

  setEdgeTypeName(id: string, type: string): void {
    this.projection.setEdgeTypeName(id, type);
  }

  clientToLocal(x: number, y: number): { x: number; y: number } {
    const graph = this.assertGraph();
    const point = graph.clientToLocal(x, y);
    return { x: point.x, y: point.y };
  }

  localToClient(x: number, y: number): { x: number; y: number } {
    const graph = this.assertGraph();
    const point = graph.localToClient(x, y);
    return { x: point.x, y: point.y };
  }

  on(event: GraphEvent, handler: GraphEventHandler): void {
    this.graph?.on(event, handler as any);
  }

  off(event: GraphEvent, handler: GraphEventHandler): void {
    this.graph?.off(event, handler as any);
  }

  getPortDefinition(nodeId: string, portId: string): PortDefinition | null {
    return this.connections.getPortDefinition(nodeId, portId);
  }

  toJSON(): GraphData {
    return this.projection.toJSON();
  }

  fromJSON(data: GraphData): void {
    this.resetCells(data.nodes, data.edges);
  }

  getX6Graph(): unknown {
    return this.graph;
  }

  useX6Plugin(plugin: unknown): void {
    this.graph?.use(plugin as any);
  }

  /**
   * Groups currently-registered node types by NodeMeta.category into a drag-and-drop
   * panel, and synthesizes a 'node:added-by-stencil' event when a node is dropped onto
   * the main graph (X6's Dnd plugin tags the resulting addCell() call with
   * `options.stencil`, which is the only reliable way to distinguish a stencil drop
   * from any other programmatic addNode()).
   */
  createStencil(container: HTMLElement, groups?: StencilGroupConfig[]): void {
    this.stencilResources.createStencil(container, groups);
  }

  getStencilNodeGroups(): StencilNodeGroup[] {
    return this.stencilResources.getStencilNodeGroups();
  }

  startNodeDrag(nodeType: string, event: MouseEvent): void {
    this.stencilResources.startNodeDrag(nodeType, event);
  }

  private injectPortHoverStyle(_container: HTMLElement): void {
    this.presentation.injectPortHoverStyle(_container);
  }

  private setupSelectionHighlight(): void {
    this.presentation.setupSelectionHighlight();
  }

  private setupEdgeToolsOnHover(): void {
    this.sessions.setupEdgeToolsOnHover();
  }

  private setupBlankConnection(): void {
    this.sessions.setupBlankConnection();
  }

  private setupPortAutoSwitch(): void {
    this.sessions.setupPortAutoSwitch();
  }

  private assertGraph(): Graph {
    if (!this.graph) {
      throw new Error("GraphManager has not been initialized. Call init() first.");
    }
    return this.graph;
  }

  private handleEdgeLabelRendered(
    args: Parameters<GraphReactRendering["renderEdgeLabel"]>[0],
  ): (() => void) | undefined {
    return this.rendering.renderEdgeLabel(args);
  }

  private resolveBackgroundColor(
    explicit: string | undefined = this.presentation.backgroundOption,
  ): string {
    return this.presentation.resolveBackgroundColor(explicit);
  }

  private translateGrid(grid?: boolean | GridConfig): boolean | Record<string, unknown> {
    return this.presentation.translateGrid(grid);
  }

  private applyNodeTheme(node: X6Node): void {
    this.presentation.applyNodeTheme(node);
  }

  private applyEdgeTheme(edge: Edge): void {
    this.presentation.applyEdgeTheme(edge);
  }

  /** Repaint everything that X6 draws itself, keeping canvas and chrome in step. */
  private applyCanvasTheme(): void {
    this.presentation.applyCanvasTheme();
  }

  /** Commit-phase boolean compatibility wrapper; evaluateConnection also returns reasons. */
  checkConnection(context: ConnectionContext): boolean {
    return this.connections.checkConnection(context);
  }

  evaluateConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ConnectionValidationResult {
    return this.connections.evaluateConnection(context, options);
  }

  resolveConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ResolvedConnection {
    return this.connections.resolveConnection(context, options);
  }

  private validateDroppedConnection(
    edge: Edge,
    terminal: "source" | "target",
    previous: Edge.TerminalData,
  ): boolean {
    return this.connections.validateDroppedConnection(edge, terminal, previous);
  }

  private validateConnection(args: {
    edge?: Edge | null;
    sourceCell?: Cell | null;
    targetCell?: Cell | null;
    sourcePort?: string | null;
    targetPort?: string | null;
  }): boolean {
    return this.connections.validateConnection(args);
  }
}
