import { Graph, Markup, type Cell, type Edge, type Node as X6Node, type Registry } from "@antv/x6";
import { Selection } from "@antv/x6-plugin-selection";
import { Scroller } from "@antv/x6-plugin-scroller";
import { Snapline } from "@antv/x6-plugin-snapline";
import { Clipboard } from "@antv/x6-plugin-clipboard";
import { Keyboard } from "@antv/x6-plugin-keyboard";
import { Stencil } from "@antv/x6-plugin-stencil";
import type { Dnd } from "@antv/x6-plugin-dnd";
import "@antv/x6-plugin-stencil/dist/index.css";
import { register } from "@antv/x6-react-shape";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { canUsePort, getTheme, subscribeTheme, t } from "@flow-designer/model";
import type {
  IGraphManager,
  GraphOptions,
  GridConfig,
  NodeConfig,
  EdgeConfig,
  PortRef,
  GraphEvent,
  GraphEventHandler,
  GraphData,
  EdgeTypeConfig,
  ConnectionContext,
  ConnectionCheckOptions,
  ConnectionValidationResult,
  ConnectionRejectedEvent,
  ResolvedConnection,
  NodeMeta,
  NodeView,
  PortDefinition,
  ContentNode,
  BlankConnectionEvent,
} from "@flow-designer/model";
import { wrapWithErrorBoundary } from "./node-error-boundary";
import { installViewportCulling } from "./viewport-culling";
import { registerRoutedSegments } from "./safe-segments";
import { findShortPortRoute, routeWithPortStubs } from "./orthogonal-routing";
import { normalizeOrthogonalVertices } from "./edge-geometry";
import {
  registerPortCurveConnector,
  strictOrthogonalFallback,
  installEdgeRouting,
  routingAffectedEdges,
  markRoutingPersisted,
} from "./edge-routing";
import { registerBuiltinShapes, DEFAULT_PORT_ITEMS } from "./shapes";
import {
  StableViewportDnd,
  installCanvasDragPan,
  type DragEdgePanController,
} from "./viewport-input";

type ThemeColor = Registry.Attr.ComplexAttrValue;

const DIR_VECTORS: Record<string, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  bottom: { x: 0, y: 1 },
  top: { x: 0, y: -1 },
};

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 40;
const DEFAULT_EDGE_LABEL_WIDTH = 120;
const DEFAULT_EDGE_LABEL_HEIGHT = 40;
const DEFAULT_ROUTER = {
  name: "manhattan",
  args: {
    padding: 20,
    step: 16,
  },
};

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

export class GraphManager implements IGraphManager {
  private graph: Graph | null = null;
  private selectionPlugin: Selection | null = null;
  private scroller: Scroller | null = null;
  private bulkDepth = 0;
  private interactionMode: ReturnType<IGraphManager["getInteractionMode"]> = "pan";
  private nodeTypes: Map<string, { meta: NodeMeta; view: NodeView }> = new Map();
  private edgeTypes: Map<string, EdgeTypeConfig> = new Map();
  private portsByType: Map<string, PortDefinition[]> = new Map();
  private nodeTypeByCellId: Map<string, string> = new Map();
  private contentNodeByCellId = new Map<string, ContentNode>();
  private nodeDataVersion = 0;
  private themeColors = new WeakMap<Cell, Map<string, { value: ThemeColor; managed: boolean }>>();
  private explicitEdgeStrokes = new WeakSet<Edge>();
  private selectedNodeStrokes = new WeakMap<
    X6Node,
    { stroke: ThemeColor; strokeWidth: ThemeColor }
  >();
  private edgeTypeByCellId: Map<string, string> = new Map();
  private edgeReactRoots: Map<HTMLElement, Root> = new Map();
  private stencil: Stencil | null = null;
  private dnd: Dnd | null = null;
  private dragEdgePan: DragEdgePanController | null = null;
  private stencilBridgeBound = false;
  private hoveredEdgeId: string | null = null;
  private connectionRules = { allowLoop: false, allowMulti: true };
  private rejectedAttempts = new WeakMap<Edge, ConnectionRejectedEvent>();
  private connectionValidator: NonNullable<GraphOptions["connecting"]>["connectionValidator"];
  private viewportResizeObserver: ResizeObserver | null = null;
  private viewportResizeHandler: (() => void) | null = null;
  private domEventCleanups: Array<() => void> = [];
  private backgroundOption: string | undefined;
  private gridOption: boolean | GridConfig | undefined;

  init(container: HTMLElement, options: GraphOptions = {}): void {
    registerBuiltinShapes();
    registerPortCurveConnector();
    registerRoutedSegments();
    const viewport = container.parentElement ?? container;
    const width = viewport.clientWidth || container.clientWidth;
    const height = viewport.clientHeight || container.clientHeight;
    const connectionValidator = options.connecting?.connectionValidator;
    this.connectionValidator = connectionValidator;
    this.connectionRules = {
      allowLoop: options.connecting?.allowLoop ?? false,
      allowMulti: options.connecting?.allowMulti ?? true,
    };
    this.backgroundOption = options.background;
    this.gridOption = options.grid;
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
          const typeConfig = defaultType ? self.edgeTypes.get(defaultType) : undefined;
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
      this.nodeTypeByCellId.delete(cell.id);
      this.contentNodeByCellId.delete(cell.id);
      this.edgeTypeByCellId.delete(cell.id);
    });
    if (typeof window !== "undefined") {
      (window as any).__x6_graph = graph;
      (window as any).__graph_manager = this;
    }

    graph.use(
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
    graph.use(scroller);
    scroller.togglePanning(this.interactionMode === "pan");
    this.selectionPlugin?.toggleRubberband(this.interactionMode === "select");
    this.setupScrollerAutoFit(graph, scroller);
    const input = installCanvasDragPan(graph, scroller);
    this.dragEdgePan = input.edgePan;
    this.domEventCleanups.push(input.dispose);
    this.observeViewportSize(viewport, graph);
    if (options.snapline !== false) {
      graph.use(new Snapline());
    }
    graph.use(new Clipboard());
    graph.use(new Keyboard());
    this.injectPortHoverStyle(container);
    this.setupSelectionHighlight();
    this.setupEdgeToolsOnHover();
    this.setupPortAutoSwitch();
    if ((options.connecting?.onBlankDrop ?? "choose-node") === "choose-node")
      this.setupBlankConnection();
    this.setupEdgeZOrder();
    this.setupTemporaryPan(container, scroller);
    if (options.viewportCulling !== false)
      this.domEventCleanups.push(installViewportCulling(graph, scroller));
  }

  private setupTemporaryPan(container: HTMLElement, scroller: Scroller): void {
    if (!container.hasAttribute("tabindex")) container.tabIndex = 0;
    const owner = container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? container;
    let space = false;
    let dragging: { x: number; y: number; left: number; top: number } | null = null;
    const keydown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        event.code === "Space" &&
        !event.defaultPrevented &&
        !event.isComposing &&
        active instanceof Element &&
        owner.contains(active) &&
        !active.closest("input, textarea, select, button, [role=textbox], [contenteditable=true]")
      ) {
        space = true;
        event.preventDefault();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") space = false;
    };
    const down = (event: MouseEvent) => {
      if (
        event.button === 0 &&
        !space &&
        event.target instanceof Element &&
        !event.target.closest("input, textarea, [contenteditable=true]")
      )
        container.focus({ preventScroll: true });
      if (event.button !== 1 && !(event.button === 0 && space)) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.container.scrollLeft,
        top: scroller.container.scrollTop,
      };
    };
    const move = (event: MouseEvent) => {
      if (!dragging) return;
      scroller.container.scrollLeft = dragging.left - (event.clientX - dragging.x);
      scroller.container.scrollTop = dragging.top - (event.clientY - dragging.y);
    };
    const up = () => {
      dragging = null;
    };
    const reset = () => {
      space = false;
      dragging = null;
    };
    const focusout = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !owner.contains(event.relatedTarget)) reset();
    };
    owner.addEventListener("keydown", keydown);
    owner.addEventListener("keyup", keyup);
    owner.addEventListener("focusout", focusout);
    window.addEventListener("blur", reset);
    scroller.container.addEventListener("mousedown", down, true);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    this.domEventCleanups.push(() => {
      owner.removeEventListener("keydown", keydown);
      owner.removeEventListener("keyup", keyup);
      owner.removeEventListener("focusout", focusout);
      window.removeEventListener("blur", reset);
      scroller.container.removeEventListener("mousedown", down, true);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    });
  }

  private observeViewportSize(viewport: HTMLElement, graph: Graph): void {
    const resize = (width = viewport.clientWidth, height = viewport.clientHeight) => {
      if (width > 0 && height > 0 && this.graph === graph) {
        this.resizeGraph(graph, width, height);
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      this.viewportResizeObserver = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (entry) resize(entry.contentRect.width, entry.contentRect.height);
      });
      this.viewportResizeObserver.observe(viewport);
    }

    if (typeof window !== "undefined") {
      this.viewportResizeHandler = () => {
        resize();
      };
      window.addEventListener("resize", this.viewportResizeHandler);
    }
  }

  private resizeGraph(graph: Graph, width: number, height: number): void {
    graph.resize(width, height);
    graph.transform.resize(width, height);
  }

  private setupScrollerAutoFit(graph: Graph, scroller: Scroller): void {
    let updateQueued = false;
    const scheduleUpdate = () => {
      if (updateQueued) return;
      updateQueued = true;
      queueMicrotask(() => {
        updateQueued = false;
        if (this.graph === graph) {
          scroller.enableAutoResize();
          try {
            scroller.updateScroller();
          } finally {
            scroller.disableAutoResize();
          }
        }
      });
    };

    graph.on("cell:added", scheduleUpdate);
    graph.on("cell:removed", scheduleUpdate);
    graph.on("node:moved", scheduleUpdate);
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

  dispose(): void {
    for (const cleanup of this.domEventCleanups.splice(0)) cleanup();
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = null;
    if (this.viewportResizeHandler && typeof window !== "undefined") {
      window.removeEventListener("resize", this.viewportResizeHandler);
    }
    this.viewportResizeHandler = null;
    this.graph?.dispose();
    this.graph = null;
    this.selectionPlugin = null;
    this.themeColors = new WeakMap();
    this.explicitEdgeStrokes = new WeakSet();
    this.selectedNodeStrokes = new WeakMap();
    this.scroller = null;
    this.dragEdgePan = null;
    this.nodeTypeByCellId.clear();
    this.contentNodeByCellId.clear();
    this.edgeTypeByCellId.clear();
    this.edgeReactRoots.forEach((root) => {
      root.unmount();
    });
    this.edgeReactRoots.clear();
    this.stencil?.dispose();
    this.stencil = null;
    this.dnd?.dispose();
    this.dnd = null;
    this.stencilBridgeBound = false;
    this.hoveredEdgeId = null;
  }

  registerNodeType(meta: NodeMeta, view: NodeView): void {
    for (const [registeredName, entry] of this.nodeTypes) {
      if (entry.meta.typeName === meta.typeName && registeredName !== meta.name) {
        this.nodeTypes.delete(registeredName);
        this.portsByType.delete(registeredName);
      }
    }
    this.nodeTypes.set(meta.name, { meta, view });
    if (view.ports?.length) {
      this.portsByType.set(meta.name, view.ports);
    }

    if (view.component) {
      const ErrorBoundaryWrapped = wrapWithErrorBoundary(view.component, meta.name);
      const adapter = ({ node }: { node: X6Node; graph: Graph }) => {
        const raw = node.getData<Record<string, unknown>>() ?? {};
        const { __modelVersion: _version, ...data } = raw;
        const selected = this.getSelection().includes(node.id);
        return createElement(ErrorBoundaryWrapped, {
          node: this.contentNodeByCellId.get(node.id) as ContentNode,
          selected,
          data,
        });
      };
      register({
        shape: meta.name,
        width: view.defaultSize?.width ?? DEFAULT_NODE_WIDTH,
        height: view.defaultSize?.height ?? DEFAULT_NODE_HEIGHT,
        component: adapter as any,
        ports: this.translatePorts(view.ports),
      });
    }
  }

  registerEdgeType(name: string, config: EdgeTypeConfig): void {
    this.edgeTypes.set(name, config);
  }

  getEdgeTypeName(cellId: string): string | null {
    return this.edgeTypeByCellId.get(cellId) ?? null;
  }

  getEdgeTypeConfig(name: string): EdgeTypeConfig | null {
    return this.edgeTypes.get(name) ?? null;
  }

  getDefaultEdgeType(): string | null {
    const first = this.edgeTypes.keys().next();
    return first.done ? null : first.value;
  }

  addNode(config: NodeConfig): string {
    const graph = this.assertGraph();
    const typeEntry = this.nodeTypes.get(config.type);
    const shape = typeEntry?.view.shape ?? config.type;
    const customPorts = typeEntry?.view.ports?.length
      ? this.translatePorts(typeEntry.view.ports)
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
        label: config.label,
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
    const typeEntry = config.type ? this.edgeTypes.get(config.type) : undefined;
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
    if (line && typeof line === "object" && "stroke" in line) this.explicitEdgeStrokes.add(edge);
    else
      this.themeColors.set(
        edge,
        new Map([["line/stroke", { value: edge.attr<ThemeColor>("line/stroke"), managed: true }]]),
      );
    markRoutingPersisted(edge);
    graph.addEdge(edge, this.bulkDepth ? { sort: false } : undefined);
    if (config.type) {
      this.edgeTypeByCellId.set(edge.id, config.type);
    }
    this.autoSwitchEdgePorts(
      edge,
      typeof config.source !== "string",
      typeof config.target !== "string",
    );
    this.updateRouterDirections(edge);
    this.updateConnectorDirections(edge);
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
    this.autoSwitchEdgePorts(
      edge,
      typeof config.source !== "string",
      typeof config.target !== "string",
    );
    edge.setVertices(config.vertices ?? []);
    this.updateRouterDirections(edge);
    this.updateConnectorDirections(edge);
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

  getCellById(id: string): unknown {
    return this.graph?.getCellById(id) ?? null;
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const cell = this.graph?.getCellById(nodeId);
    if (cell?.isNode()) {
      const { contentNode, ...rest } = data;
      if (contentNode) this.contentNodeByCellId.set(nodeId, contentNode as ContentNode);
      cell.setData({ ...rest, __modelVersion: ++this.nodeDataVersion }, { overwrite: false });
    }
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

  setInteractionMode(mode: ReturnType<IGraphManager["getInteractionMode"]>): void {
    if (this.interactionMode === mode) return;
    this.interactionMode = mode;
    this.scroller?.togglePanning(mode === "pan");
    this.selectionPlugin?.toggleRubberband(mode === "select");
    this.graph?.trigger("interaction:change" as never, { mode } as never);
  }

  getInteractionMode(): ReturnType<IGraphManager["getInteractionMode"]> {
    return this.interactionMode;
  }

  getFirstPortOfGroup(nodeId: string, group: string): PortDefinition | null {
    const type = this.nodeTypeByCellId.get(nodeId);
    return (
      (type
        ? this.portsByType
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
    this.edgeTypeByCellId.set(id, type);
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
    const typeName = this.nodeTypeByCellId.get(nodeId);
    if (!typeName) return null;
    const ports = this.portsByType.get(typeName);
    if (!ports) {
      const node = this.graph?.getCellById(nodeId);
      const fallback = DEFAULT_PORT_ITEMS.find((port) => port.id === portId);
      if (node?.isNode() && fallback && node.hasPort(portId))
        return {
          id: portId,
          group: fallback.group,
          position: portId as PortDefinition["position"],
        };
      return null;
    }
    const byId = ports.find((port) => (port.id ?? `${port.group}-${port.position}`) === portId);
    if (byId) return byId;
    return ports.find((port) => port.position === portId) ?? null;
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

  private stencilBaseShape(shape?: string): string {
    if (!shape) return "rect";
    if (shape.includes("circle")) return "circle";
    if (shape.includes("diamond")) return "polygon";
    return "rect";
  }

  private getLatestNodeTypeEntries(): Array<{ meta: NodeMeta; view: NodeView }> {
    const latest = new Map<string, { meta: NodeMeta; view: NodeView }>();
    this.nodeTypes.forEach((entry) => latest.set(entry.meta.typeName, entry));
    return Array.from(latest.values());
  }

  private localizeStencilCategory(name: string): string {
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
      if (!this.dragEdgePan) throw new Error("Canvas drag input is not initialized");
      this.dnd = new StableViewportDnd({ target: graph }, this.dragEdgePan);
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

  private injectPortHoverStyle(_container: HTMLElement): void {
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

  private setupSelectionHighlight(): void {
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

  private paintEdgeHighlight(edge: Cell, hover = this.hoveredEdgeId === edge.id): void {
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

  private setupEdgeToolsOnHover(): void {
    const graph = this.assertGraph();
    let isDragging = false;
    let deferredLeaveEdge: any = null;
    const colorEdge = (edge: Cell, hover: boolean) => {
      this.paintEdgeHighlight(edge, hover);
    };

    // NOTE: any correction that mutates edge.setVertices() must NOT run
    // synchronously inside a document/graph 'mouseup' or 'mouseleave'
    // handler, because X6's own Segments tool (Handle.onMouseUp) also runs
    // synchronously on document 'mouseup' and re-renders its handles based
    // on the vertex array right afterward. Mutating vertices in between
    // (same tick, before X6's own handler finishes) corrupts its internal
    // handle state and can throw inside its render(), which aborts before it
    // calls `graph.view.delegateEvents()` — permanently disabling
    // click/selection on the whole graph. We use the tool's own `onChanged`
    // callback (fires after X6 finishes its internal re-render) for the
    // drag-end snap, and a microtask for all other vertex-mutating cleanup so
    // it never races with X6's synchronous mouseup/mouseleave handling.
    // Toggling the dash style through edge.attr() triggers a full CellView
    // re-render, which recreates the Segments tool's Handle DOM node — if
    // that happens WHILE the user's mouse button is still down on a handle,
    // its document-level mouseup listener is destroyed before it ever fires,
    // permanently breaking graph.view's click delegation. Mutate the live
    // <path> element directly instead, so the model/view layer is untouched.
    const setDashed = (edge: any, dashed: boolean) => {
      const view = graph.findViewByCell(edge) as any;
      const pathEl = view?.findOne("line") as SVGPathElement | null;
      pathEl?.setAttribute("stroke-dasharray", dashed ? "6 4" : "none");
    };

    const unhoverEdge = (edge: any) => {
      colorEdge(edge, false);
      edge.removeTools?.();
    };

    const clearHoveredEdge = () => {
      if (!this.hoveredEdgeId) return;
      const edge = graph.getCellById(this.hoveredEdgeId) as any;
      if (edge) unhoverEdge(edge);
      this.hoveredEdgeId = null;
      deferredLeaveEdge = null;
    };

    // Tool redraws can replace the hovered SVG before X6 emits mouseleave.
    // Check the pointer's owning cell without clearing tools beneath a drag.
    const owner =
      graph.container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? graph.container;
    const onOwnerMove = (event: MouseEvent) => {
      if (!this.hoveredEdgeId || isDragging || event.buttons !== 0) return;
      const cell = event.target instanceof Element ? event.target.closest("[data-cell-id]") : null;
      if (cell?.getAttribute("data-cell-id") !== this.hoveredEdgeId) clearHoveredEdge();
    };
    const onOwnerLeave = (event: MouseEvent) => {
      if (!isDragging && event.buttons === 0) clearHoveredEdge();
    };
    owner.addEventListener("mousemove", onOwnerMove, true);
    owner.addEventListener("mouseleave", onOwnerLeave);
    this.domEventCleanups.push(() => {
      owner.removeEventListener("mousemove", onOwnerMove, true);
      owner.removeEventListener("mouseleave", onOwnerLeave);
    });

    let isEdgeDragging = false;

    const onSegmentDragChanged = ({ edge }: { edge: any }) => {
      setDashed(edge, false);
      this.enforceOrthogonalVertices(edge);
      this.updateRouterDirections(edge);
      isEdgeDragging = false;
      graph.trigger("edge:vertices:committed" as never, { edge } as never);
      // Defensive safety net: X6's own Segments Handle.onMouseUp is supposed
      // to call graph.view.delegateEvents() right after this callback runs,
      // but that restoration is unreliable once the vertex array has been
      // mutated mid-flight (our enforceOrthogonalVertices call above changes
      // the vertex count, which desyncs the tool's handle indices). Without
      // this, clicking/selecting nodes stops working after any edge drag.
      queueMicrotask(() => {
        graph.view?.delegateEvents?.();
      });
    };

    const onMouseDown = () => {
      isDragging = true;
    };
    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;

      if (deferredLeaveEdge) {
        const edge = deferredLeaveEdge;
        deferredLeaveEdge = null;
        queueMicrotask(() => {
          if (this.hoveredEdgeId === edge.id) {
            this.hoveredEdgeId = null;
          }
          setDashed(edge, false);
          unhoverEdge(edge);
        });
      }
    };
    graph.container.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", onMouseUp);
    this.domEventCleanups.push(() => {
      graph.container.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp);
    });

    graph.on("edge:change:vertices", ({ edge }: { edge: any }) => {
      if (this.hoveredEdgeId === edge.id && isDragging && !isEdgeDragging) {
        isEdgeDragging = true;
        setDashed(edge, true);
      }
    });

    graph.on("edge:mouseenter", ({ edge }: { edge: any }) => {
      if (this.hoveredEdgeId && this.hoveredEdgeId !== edge.id) {
        const prev = graph.getCellById(this.hoveredEdgeId) as any;
        if (prev) unhoverEdge(prev);
      }
      if (deferredLeaveEdge && deferredLeaveEdge.id !== edge.id) {
        unhoverEdge(deferredLeaveEdge);
      }
      deferredLeaveEdge = null;
      this.hoveredEdgeId = edge.id;
      colorEdge(edge, true);
      const type = this.edgeTypeByCellId.get(edge.id);
      const curved = type && this.edgeTypes.get(type)?.router === null;
      if (curved && !edge.hasTools()) {
        edge.addTools([
          {
            name: "flow-curve-vertices",
            args: {
              addable: true,
              removable: true,
              removeRedundancies: true,
              stopPropagation: true,
              attrs: { fill: "#4d7cfe", r: 5 },
              onChanged: ({ edge: edited }: { edge: Cell }) =>
                graph.trigger("edge:vertices:committed" as never, { edge: edited } as never),
            },
          },
        ]);
      }
      if (!curved && !edge.hasTools()) {
        edge.addTools([
          {
            name: "flow-routed-segments",
            args: {
              validate: (edited: Edge) =>
                this.hasShortConnectionRoute(
                  this.connectionContext(edited),
                  edited.id,
                  edited.getVertices() as Array<{ x: number; y: number }>,
                ),
              onRejected: (edited: Edge) =>
                this.reportConnectionRejection(edited, {
                  valid: false,
                  reason: "workbench.connection.routeUnavailable",
                }),
              snapRadius: 20,
              threshold: 40,
              stopPropagation: false,
              anchor: undefined,
              attrs: { fill: "#4d7cfe", width: 10, height: 10 },
              onChanged: onSegmentDragChanged,
            },
          },
        ]);
      }
    });

    graph.on("edge:mouseleave", ({ edge }: { edge: any }) => {
      if (isDragging) {
        deferredLeaveEdge = edge;
        return;
      }
      if (this.hoveredEdgeId === edge.id) {
        this.hoveredEdgeId = null;
      }
      unhoverEdge(edge);
    });

    graph.on("blank:click", clearHoveredEdge);
    graph.on("blank:mousedown", clearHoveredEdge);
    graph.on("node:click", clearHoveredEdge);
    graph.on("node:mousedown", clearHoveredEdge);
  }

  private setupBlankConnection(): void {
    const graph = this.assertGraph();
    // X6 compares terminal objects by their `cell`/`port` fields only, so a
    // free-point target is "equal" to another free-point target and
    // `edge:connected` never fires for a drop on blank canvas. Track the
    // temporary edge that a magnet drag creates and finish the drop when the
    // pointer is released instead.
    const pendingEdges = new Set<Edge>();

    graph.on("edge:added", ({ cell }: { cell: Cell }) => {
      if (!cell.isEdge()) return;
      if (cell.getSourceCellId() && !cell.getTargetCellId()) {
        pendingEdges.add(cell);
      }
    });

    graph.on("edge:removed", ({ cell }: { cell: Cell }) => {
      if (!cell.isEdge()) return;
      pendingEdges.delete(cell);
    });

    graph.on("edge:mouseup", ({ edge }: { edge: Edge }) => {
      if (!pendingEdges.delete(edge)) return;
      const targetCellId = edge.getTargetCellId();
      if (targetCellId) return;
      const sourceCellId = edge.getSourceCellId();
      const sourcePortId = edge.getSourcePortId() ?? null;
      const point = edge.getTarget() as { x?: number; y?: number };
      // Keep the temporary edge on screen: the workbench shows a node picker and
      // only removes this edge once the drop is resolved or cancelled.
      if (!sourceCellId) {
        edge.remove();
        return;
      }
      void graph.trigger("connection:blank", {
        sourceCellId,
        sourcePortId,
        ...(!canUsePort(
          sourcePortId ? this.getPortDefinition(sourceCellId, sourcePortId) : null,
          "source",
        )
          ? {
              reason: sourcePortId
                ? ("workbench.connection.sourceCannotConnect" as const)
                : ("workbench.connection.sourcePortRequired" as const),
            }
          : {}),
        edgeId: edge.id,
        x: point.x ?? 0,
        y: point.y ?? 0,
      } satisfies BlankConnectionEvent);
    });
  }

  private setupPortAutoSwitch(): void {
    const graph = this.assertGraph();

    graph.on("edge:connected", ({ edge }: { edge: Edge }) => {
      if (!edge.getTargetCell()) return;
      markRoutingPersisted(edge);
      if (!this.edgeTypeByCellId.has(edge.id)) {
        const defaultType = this.getDefaultEdgeType();
        if (defaultType) this.edgeTypeByCellId.set(edge.id, defaultType);
      }
      this.updateRouterDirections(edge);
      this.updateConnectorDirections(edge);
    });

    type SavedEdge = {
      edge: Edge;
      source: Edge.TerminalData;
      target: Edge.TerminalData;
      vertices: Array<{ x: number; y: number }>;
    };
    let gesture: {
      node: X6Node;
      position: { x: number; y: number };
      edges: SavedEdge[];
      positions: Array<{ node: X6Node; position: { x: number; y: number } }>;
      rejected: boolean;
      lastRejected?: boolean;
    } | null = null;
    const snapshot = (node: X6Node) => {
      const selected = graph.getSelectedCells().filter((cell): cell is X6Node => cell.isNode());
      const nodes = selected.some((cell) => cell.id === node.id) ? selected : [node];
      const edges = [
        ...new Set([
          ...nodes.flatMap((item) => graph.getConnectedEdges(item)),
          ...(gesture?.node === node ? gesture.edges.map((item) => item.edge) : []),
        ]),
      ];
      return {
        node,
        position: { ...node.position() },
        positions: nodes.map((item) => ({ node: item, position: { ...item.position() } })),
        edges: edges.map((edge) => ({
          edge,
          source: edge.getSource(),
          target: edge.getTarget(),
          vertices: edge.getVertices() as Array<{ x: number; y: number }>,
        })),
        rejected: false,
      };
    };
    let initial: ReturnType<typeof snapshot> | null = null;
    const restore = (saved: NonNullable<typeof gesture>) => {
      for (const item of saved.positions) item.node.position(item.position.x, item.position.y);
      for (const item of saved.edges) {
        item.edge.setSource(item.source);
        item.edge.setTarget(item.target);
        item.edge.setVertices(item.vertices);
        this.updateRouterDirections(item.edge);
        this.updateConnectorDirections(item.edge);
      }
    };
    graph.on("node:mousedown", ({ node }: { node: X6Node }) => {
      gesture = snapshot(node);
      initial = snapshot(node);
    });
    type MovePayload = { node?: X6Node; cell?: Cell; routingEdgeIds?: string[] };
    const movingNode = (args: MovePayload): X6Node | null => {
      const node = args.node ?? args.cell;
      return node?.isNode() ? node : null;
    };
    const reroute = (args: MovePayload) => {
      const node = movingNode(args);
      if (!node) return;
      const members = gesture?.node === node ? gesture.positions.map((item) => item.node) : [node];
      for (const edge of new Set(members.flatMap((item) => graph.getConnectedEdges(item)))) {
        const source = this.getPortDefinition(edge.getSourceCellId(), edge.getSourcePortId()!);
        const target = this.getPortDefinition(edge.getTargetCellId(), edge.getTargetPortId()!);
        const directional = (port: PortDefinition | null) =>
          !!port && !port.id && !port.label && !port.dataType;
        this.autoSwitchEdgePorts(edge, !directional(source), !directional(target), true);
        if (edge.getVertices().length) edge.setVertices([]);
        this.updateRouterDirections(edge);
        this.updateConnectorDirections(edge);
      }
      if (gesture?.node !== node) return;
      // Include unrelated links: the dragged node may have become a new obstacle.
      const affected = [
        ...new Set(
          gesture.positions.flatMap((item) => [
            ...routingAffectedEdges(graph, item.node, item.position),
            ...graph.getConnectedEdges(item.node).map((edge) => edge.id),
          ]),
        ),
      ];
      const invalid = affected
        .map((id) => graph.getCellById(id))
        .filter((cell): cell is Edge => cell.isEdge())
        .find(
          (edge) =>
            edge.getSourceCell() &&
            edge.getTargetCell() &&
            !this.hasShortConnectionRoute(this.connectionContext(edge), edge.id) &&
            (() => {
              for (const saved of [gesture, initial])
                if (saved && !saved.edges.some((item) => item.edge.id === edge.id))
                  saved.edges.push({
                    edge,
                    source: edge.getSource(),
                    target: edge.getTarget(),
                    vertices: edge.getVertices() as Array<{ x: number; y: number }>,
                  });
              return !this.tryAlternativeDirectionalPorts(edge);
            })(),
        );
      if (invalid) {
        const saved = gesture;
        saved.lastRejected = true;
        restore(saved);
        // Snapline runs later in this native pointer dispatch and may translate again.
        // Reapply before paint, while retaining synchronous state for downstream listeners.
        queueMicrotask(() => {
          if (this.graph === graph && gesture === saved && saved.lastRejected) restore(saved);
        });
        if (!saved.rejected) {
          saved.rejected = true;
          this.reportConnectionRejection(invalid, {
            valid: false,
            reason: "workbench.connection.routeUnavailable",
          });
        }
      } else {
        const rejected = gesture.rejected;
        gesture = snapshot(node);
        gesture.rejected = rejected;
      }
    };
    graph.on("node:moving", reroute);
    graph.on("node:moved", (args: MovePayload) => {
      if (!movingNode(args)) return;
      if (gesture?.lastRejected && initial) restore(initial);
      else reroute(args);
      Object.assign(args, {
        routingEdgeIds: [
          ...new Set([
            ...(args.routingEdgeIds ?? []),
            ...(initial?.edges.map((item) => item.edge.id) ?? []),
          ]),
        ],
      });
      gesture = null;
      initial = null;
    });
  }

  private autoSwitchEdgePorts(
    edge: any,
    preserveSource = false,
    preserveTarget = false,
    directionalOnly = false,
  ): void {
    const sourceCell = edge.getSourceCell() as X6Node | null;
    const targetCell = edge.getTargetCell() as X6Node | null;
    if (!sourceCell || !targetCell) return;
    if (directionalOnly) {
      this.selectDirectionalPorts(edge, true);
      return;
    }
    const sBBox = sourceCell.getBBox();
    const tBBox = targetCell.getBBox();
    const sc = { x: sBBox.x + sBBox.width / 2, y: sBBox.y + sBBox.height / 2 };
    const tc = { x: tBBox.x + tBBox.width / 2, y: tBBox.y + tBBox.height / 2 };
    const dx = tc.x - sc.x;
    const dy = tc.y - sc.y;

    const sourceType = this.nodeTypeByCellId.get(sourceCell.id);
    const targetType = this.nodeTypeByCellId.get(targetCell.id);
    const sourcePorts = sourceType ? this.portsByType.get(sourceType) : undefined;
    const targetPorts = targetType ? this.portsByType.get(targetType) : undefined;

    let sourceDir: string | null = null;
    if (sourcePorts) {
      const outPorts = sourcePorts.filter((p) => canUsePort(p, "source"));
      const best = this.pickBestPort(outPorts, dx, dy);
      if (best) {
        sourceDir = preserveSource ? this.getPortDirectionFromDef(edge, "source") : best.position;
        const portId = best.id ?? `${best.group}-${best.position}`;
        if (!preserveSource && edge.getSourcePortId() !== portId) {
          edge.setSource({ cell: sourceCell.id, port: portId });
        }
      }
    }
    if (targetPorts) {
      const inPorts = targetPorts.filter((p) => canUsePort(p, "target"));
      let tdx = -dx;
      let tdy = -dy;
      if (sourceDir) {
        const opposite: Record<string, string> = {
          bottom: "top",
          top: "bottom",
          right: "left",
          left: "right",
        };
        const preferred = opposite[sourceDir];
        if (preferred) {
          const v = DIR_VECTORS[preferred];
          if (v) {
            tdx = v.x;
            tdy = v.y;
          }
        }
      }
      const best = this.pickBestPort(inPorts, tdx, tdy);
      if (best) {
        const portId = best.id ?? `${best.group}-${best.position}`;
        if (!preserveTarget && edge.getTargetPortId() !== portId) {
          edge.setTarget({ cell: targetCell.id, port: portId });
        }
      }
    }
  }

  /** Interchangeable geometry-only ports may escape an obstacle; semantic ports never change. */
  private tryAlternativeDirectionalPorts(edge: Edge): boolean {
    return this.selectDirectionalPorts(edge, false);
  }

  /** Decide preferred and fallback pairs without exposing rejected intermediate terminals. */
  private selectDirectionalPorts(edge: Edge, geometryFirst: boolean): boolean {
    const source = edge.getSourceCell();
    const target = edge.getTargetCell();
    if (!source?.isNode() || !target?.isNode()) return false;
    const sc = source.getBBox().getCenter(),
      tc = target.getBBox().getCenter();
    const dx = tc.x - sc.x,
      dy = tc.y - sc.y;
    const choices = (node: X6Node, portId: string | undefined, terminal: "source" | "target") => {
      const current = portId ? this.getPortDefinition(node.id, portId) : null;
      if (!current || current.id || current.label || current.dataType)
        return portId ? [portId] : [];
      const type = this.nodeTypeByCellId.get(node.id);
      const definitions = type ? this.portsByType.get(type) : undefined;
      return [
        ...new Set([
          ...(portId ? [portId] : []),
          ...(definitions ?? [])
            .filter((p) => !p.id && !p.label && !p.dataType && canUsePort(p, terminal))
            .map((p) => `${p.group}-${p.position}`),
        ]),
      ];
    };
    const score = (node: X6Node, id: string, sign: number) => {
      const port = this.getPortDefinition(node.id, id);
      const v = port ? DIR_VECTORS[port.position] : null;
      return v ? (v.x * dx + v.y * dy) * sign : 0;
    };
    const pairs = choices(source, edge.getSourcePortId(), "source").flatMap((sp) =>
      choices(target, edge.getTargetPortId(), "target").map((tp) => ({
        sp,
        tp,
        current: sp === edge.getSourcePortId() && tp === edge.getTargetPortId(),
        score: score(source, sp, 1) + score(target, tp, -1),
      })),
    );
    pairs.sort(
      (a, b) => (geometryFirst ? 0 : Number(b.current) - Number(a.current)) || b.score - a.score,
    );
    for (const { sp, tp } of pairs) {
      const context: ConnectionContext = {
        sourceNode: source.id,
        targetNode: target.id,
        sourcePort: this.getPortDefinition(source.id, sp),
        targetPort: this.getPortDefinition(target.id, tp),
      };
      if (
        (!this.connectionValidator || this.connectionValidator(context)) &&
        this.hasShortConnectionRoute(context, edge.id)
      ) {
        if (edge.getSourcePortId() !== sp) edge.setSource({ cell: source.id, port: sp });
        if (edge.getTargetPortId() !== tp) edge.setTarget({ cell: target.id, port: tp });
        this.updateRouterDirections(edge);
        this.updateConnectorDirections(edge);
        return true;
      }
    }
    return false;
  }

  private pickBestPort(ports: PortDefinition[], dx: number, dy: number): PortDefinition | null {
    if (!ports.length) return null;
    const dirVectors: Record<string, { x: number; y: number }> = {
      top: { x: 0, y: -1 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    let best: PortDefinition | null = null;
    let bestScore = -Infinity;
    for (const port of ports) {
      const v = dirVectors[port.position];
      if (!v) continue;
      const score = ndx * v.x + ndy * v.y;
      if (score > bestScore) {
        bestScore = score;
        best = port;
      }
    }
    return best;
  }

  private updateRouterDirections(edge: any): void {
    const sourcePortId: string | null = edge.getSourcePortId?.() ?? null;
    const targetPortId: string | null = edge.getTargetPortId?.() ?? null;
    const sourceDir =
      this.getPortDirectionFromDef(edge, "source") ?? this.getPortDirection(sourcePortId);
    const targetDir =
      this.getPortDirectionFromDef(edge, "target") ?? this.getPortDirection(targetPortId);

    const edgeType = this.edgeTypeByCellId.get(edge.id);
    const typeConfig = edgeType ? this.edgeTypes.get(edgeType) : undefined;
    if (typeConfig?.router === null) {
      edge.removeRouter();
      return;
    }
    const baseRouter = typeConfig?.router ?? DEFAULT_ROUTER;
    const routerName = typeof baseRouter === "string" ? baseRouter : baseRouter.name;
    const baseArgs = typeof baseRouter === "string" ? {} : (baseRouter.args ?? {});

    if (routerName === "manhattan" || routerName === "orth") {
      const args: Record<string, unknown> = {
        ...baseArgs,
        perpendicular: false,
        fallbackRouter: strictOrthogonalFallback,
      };
      if (sourceDir) {
        args.startDirections = [sourceDir];
      }
      if (targetDir) {
        args.endDirections = [targetDir];
      }
      edge.setRouter({ name: "flow-orthogonal", args });
    } else if (routerName === "er") {
      const isHorizontal =
        sourceDir === "left" ||
        sourceDir === "right" ||
        targetDir === "left" ||
        targetDir === "right";
      edge.setRouter({
        name: "er",
        args: {
          ...baseArgs,
          direction: isHorizontal ? "H" : "V",
        },
      });
    } else {
      edge.setRouter({
        name: routerName,
        args: {
          ...baseArgs,
          startDirections: sourceDir ? [sourceDir] : ["top", "right", "bottom", "left"],
          endDirections: targetDir ? [targetDir] : ["top", "right", "bottom", "left"],
        },
      });
    }
  }

  private getPortDirection(portId: string | null): string | null {
    if (!portId) return null;
    const parts = portId.split("-");
    const direction = parts[parts.length - 1];
    if (direction && ["top", "right", "bottom", "left"].includes(direction)) {
      return direction;
    }
    return null;
  }

  private getPortDirectionFromDef(edge: any, which: "source" | "target"): string | null {
    const cell = which === "source" ? edge.getSourceCell() : edge.getTargetCell();
    const portId = which === "source" ? edge.getSourcePortId?.() : edge.getTargetPortId?.();
    if (!cell || !portId) return null;
    const nodeType = this.nodeTypeByCellId.get(cell.id);
    if (!nodeType) return null;
    const ports = this.portsByType.get(nodeType);
    if (!ports) return null;
    const portDef = ports.find((p) => p.id === portId || `${p.group}-${p.position}` === portId);
    return portDef?.position ?? null;
  }

  private updateConnectorDirections(edge: any): void {
    const edgeType = this.edgeTypeByCellId.get(edge.id);
    const typeConfig = edgeType ? this.edgeTypes.get(edgeType) : undefined;
    if (!typeConfig?.connector) return;
    const connector = typeConfig.connector;
    const name = typeof connector === "string" ? connector : connector.name;
    if (name !== "port-curve") {
      edge.setConnector(
        name === "normal" && edge.getRouter()?.name === "flow-orthogonal"
          ? { name: "flow-normal", args: typeof connector === "string" ? {} : connector.args }
          : connector,
      );
      return;
    }

    const srcDir =
      this.getPortDirectionFromDef(edge, "source") ??
      this.getPortDirection(edge.getSourcePortId?.());
    const tgtDir =
      this.getPortDirectionFromDef(edge, "target") ??
      this.getPortDirection(edge.getTargetPortId?.());

    edge.setConnector({
      name: "port-curve",
      args: {
        ...(typeof connector === "string" ? {} : connector.args),
        sourceDir: srcDir,
        targetDir: tgtDir,
      },
    });
  }

  private enforceOrthogonalVertices(edge: any): void {
    const source = edge.getSourcePoint();
    const target = edge.getTargetPoint();
    if (!source || !target) return;
    const sourceDir =
      this.getPortDirectionFromDef(edge, "source") ??
      this.getPortDirection(edge.getSourcePortId?.() ?? null);
    const targetDir =
      this.getPortDirectionFromDef(edge, "target") ??
      this.getPortDirection(edge.getTargetPortId?.() ?? null);
    edge.setVertices(
      normalizeOrthogonalVertices(edge.getVertices() ?? [], source, target, sourceDir, targetDir),
      { silent: true },
    );
  }

  private assertGraph(): Graph {
    if (!this.graph) {
      throw new Error("GraphManager has not been initialized. Call init() first.");
    }
    return this.graph;
  }

  private handleEdgeLabelRendered(args: {
    edge: { id: string; getData<T = Record<string, unknown>>(): T };
    label: unknown;
    container: Element;
    selectors?: Record<string, Element | Element[]>;
  }): (() => void) | undefined {
    const typeName = this.edgeTypeByCellId.get(args.edge.id);
    if (!typeName) return undefined;
    const typeEntry = this.edgeTypes.get(typeName);
    if (!typeEntry?.component) return undefined;

    const foContent = args.selectors?.foContent;
    const mountEl = (Array.isArray(foContent) ? foContent[0] : foContent) ?? args.container;
    const root = createRoot(mountEl);
    this.edgeReactRoots.set(mountEl as HTMLElement, root);
    const data = args.edge.getData() ?? {};
    root.render(createElement(typeEntry.component, { edge: args.edge, data }));

    return () => {
      root.unmount();
      this.edgeReactRoots.delete(mountEl as HTMLElement);
    };
  }

  private resolveBackgroundColor(explicit: string | undefined = this.backgroundOption): string {
    if (explicit) return explicit;
    return getTheme() === "dark" ? "#121722" : "#fffefd";
  }

  private resolveGridColor(): string {
    return getTheme() === "dark" ? "#242c3c" : "#e8ebf0";
  }

  private translateGrid(grid?: boolean | GridConfig): boolean | Record<string, unknown> {
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

  private resolveCanvasPalette(): {
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

  /** A caller change detaches that colour from the palette for this cell. */
  private themeColor(
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

  private applyNodeTheme(node: X6Node): void {
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

  private applyEdgeTheme(edge: Edge): void {
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

  /** Repaint everything that X6 draws itself, keeping canvas and chrome in step. */
  private applyCanvasTheme(): void {
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

  /** Commit-phase boolean compatibility wrapper; evaluateConnection also returns reasons. */
  checkConnection(context: ConnectionContext): boolean {
    return this.evaluateConnection(context).valid;
  }

  evaluateConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ConnectionValidationResult {
    return this.evaluateConnectionRules(context, options, true);
  }

  resolveConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ResolvedConnection {
    const initial = this.evaluateConnection(context, options);
    const id = (port: PortDefinition | null) =>
      port ? (port.id ?? `${port.group}-${port.position}`) : undefined;
    const result = (candidate: ConnectionContext): ResolvedConnection => ({
      valid: true,
      sourcePortId: id(candidate.sourcePort),
      targetPortId: id(candidate.targetPort),
    });
    if (initial.valid) return { ...initial, ...result(context) };
    if (options.phase === "candidate" || initial.reason !== "workbench.connection.routeUnavailable")
      return initial;
    const choices = (
      nodeId: string,
      current: PortDefinition | null,
      terminal: "source" | "target",
    ) => {
      if (!current || current.id || current.label || current.dataType)
        return current ? [current] : [];
      const type = this.nodeTypeByCellId.get(nodeId);
      const definitions = type ? this.portsByType.get(type) : undefined;
      return [
        current,
        ...(definitions ?? []).filter(
          (p) =>
            id(p) !== id(current) && !p.id && !p.label && !p.dataType && canUsePort(p, terminal),
        ),
      ];
    };
    const candidates: Array<{ context: ConnectionContext; sourcePriority: number; score: number }> =
      [];
    for (const sourcePort of choices(context.sourceNode, context.sourcePort, "source"))
      for (const targetPort of choices(context.targetNode, context.targetPort, "target")) {
        const candidate = { ...context, sourcePort, targetPort };
        if (!this.evaluateConnection(candidate, options).valid) continue;
        const score = { value: Infinity };
        this.hasShortConnectionRoute(candidate, options.edgeId, [], score);
        candidates.push({
          context: candidate,
          sourcePriority: id(sourcePort) === id(context.sourcePort) ? 0 : 1,
          score: score.value,
        });
      }
    candidates.sort((a, b) => a.sourcePriority - b.sourcePriority || a.score - b.score);
    const best = candidates[0];
    return best ? result(best.context) : initial;
  }

  private evaluateConnectionRules(
    context: ConnectionContext,
    options: ConnectionCheckOptions,
    checkRoute: boolean,
  ): ConnectionValidationResult {
    const reject = (
      reason: NonNullable<ConnectionValidationResult["reason"]>,
    ): ConnectionValidationResult => ({ valid: false, reason });
    if (!context.sourcePort) return reject("workbench.connection.sourcePortRequired");
    if (!canUsePort(context.sourcePort, "source"))
      return reject("workbench.connection.sourceCannotConnect");
    if (!context.targetPort) return reject("workbench.connection.targetPortRequired");
    if (!canUsePort(context.targetPort, "target"))
      return reject("workbench.connection.targetCannotReceive");
    // A prototype is not an instance. Never pass an empty target ID to an instance validator.
    if (options.phase === "candidate") {
      if (
        this.connectionValidator?.validatePorts &&
        !this.connectionValidator.validatePorts(context)
      )
        return reject("workbench.connection.incompatible");
      return { valid: true, deferred: true };
    }
    const graph = this.graph;
    const sourceCell = graph?.getCellById(context.sourceNode) as Cell | null | undefined;
    const targetCell = graph?.getCellById(context.targetNode) as Cell | null | undefined;
    if (!graph || !sourceCell?.isNode() || !targetCell?.isNode())
      return reject("workbench.connection.endpointMissing");
    const sourcePortId =
      context.sourcePort.id ?? `${context.sourcePort.group}-${context.sourcePort.position}`;
    const targetPortId =
      context.targetPort.id ?? `${context.targetPort.group}-${context.targetPort.position}`;
    if (!sourceCell.hasPort(sourcePortId)) return reject("workbench.connection.sourcePortRequired");
    if (!targetCell.hasPort(targetPortId)) return reject("workbench.connection.targetPortRequired");
    if (!this.connectionRules.allowLoop && context.sourceNode === context.targetNode)
      return reject("workbench.connection.loopNotAllowed");
    if (
      !this.connectionRules.allowMulti &&
      graph
        .getEdges()
        .some(
          (edge) =>
            edge.id !== options.edgeId &&
            edge.getSourceCellId() === context.sourceNode &&
            edge.getTargetCellId() === context.targetNode,
        )
    )
      return reject("workbench.connection.duplicateNotAllowed");
    if (this.connectionValidator && !this.connectionValidator(context))
      return reject("workbench.connection.incompatible");
    if (checkRoute && !this.hasShortConnectionRoute(context, options.edgeId))
      return reject("workbench.connection.routeUnavailable");
    return { valid: true };
  }

  private hasShortConnectionRoute(
    context: ConnectionContext,
    edgeId?: string,
    vertices: Array<{ x: number; y: number }> = [],
    score?: { value: number },
  ): boolean {
    const graph = this.assertGraph();
    const type = (edgeId ? this.edgeTypeByCellId.get(edgeId) : null) ?? this.getDefaultEdgeType();
    if (!type) return true;
    const curved = this.edgeTypes.get(type)?.router === null;
    const endpoint = (id: string, port: PortDefinition | null) => {
      const node = graph.getCellById(id) as Cell | null | undefined;
      if (!node?.isNode() || !port) return null;
      const portId = port.id ?? `${port.group}-${port.position}`;
      const actual = node.getPort(portId);
      if (!actual?.group) return null;
      const local = node.getPortsPosition(actual.group)[portId]?.position;
      if (!local) return null;
      const origin = node.position();
      return { x: origin.x + local.x, y: origin.y + local.y };
    };
    const source = endpoint(context.sourceNode, context.sourcePort);
    const target = endpoint(context.targetNode, context.targetPort);
    if (!source || !target || !context.sourcePort || !context.targetPort) return false;
    const boxes = graph.getNodes().map((node) => {
      const b = node.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });
    const route = (curved ? routeWithPortStubs : findShortPortRoute)(
      source,
      target,
      context.sourcePort.position,
      context.targetPort.position,
      boxes,
      vertices,
    );
    if (route && score)
      score.value =
        route.slice(1).reduce((sum, p, i) => {
          const prev = route[i];
          return sum + (prev ? Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) : 0);
        }, 0) +
        Math.max(0, route.length - 2) * 12;
    return !!route;
  }

  private connectionContext(edge: Edge): ConnectionContext {
    const sourceNode = edge.getSourceCellId();
    const targetNode = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();
    return {
      sourceNode,
      targetNode,
      sourcePort: sourcePortId ? this.getPortDefinition(sourceNode, sourcePortId) : null,
      targetPort: targetPortId ? this.getPortDefinition(targetNode, targetPortId) : null,
    };
  }

  private reportConnectionRejection(
    edge: Edge,
    result: ConnectionValidationResult,
    context: Pick<ConnectionContext, "sourceNode" | "targetNode"> = this.connectionContext(edge),
  ): false {
    this.rejectedAttempts.delete(edge);
    void this.graph?.trigger("connection:rejected", {
      ...result,
      sourceNode: context.sourceNode,
      targetNode: context.targetNode,
    } satisfies ConnectionRejectedEvent);
    return false;
  }

  private validateDroppedConnection(
    edge: Edge,
    terminal: "source" | "target",
    previous: Edge.TerminalData,
  ): boolean {
    const context = this.connectionContext(edge);
    if (context.sourceNode && context.targetNode) {
      const result = this.resolveConnection(context, { edgeId: edge.id });
      if (!result.valid) return this.reportConnectionRejection(edge, result, context);
      if (result.sourcePortId && result.sourcePortId !== edge.getSourcePortId())
        edge.setSource({ cell: context.sourceNode, port: result.sourcePortId });
      if (result.targetPortId && result.targetPortId !== edge.getTargetPortId())
        edge.setTarget({ cell: context.targetNode, port: result.targetPortId });
      this.updateRouterDirections(edge);
      this.updateConnectorDirections(edge);
      return true;
    }
    // Detaching a saved relation must revert its old terminal, never leave graph/model split.
    if (typeof previous === "object" && "cell" in previous && previous.cell)
      return this.reportConnectionRejection(edge, {
        valid: false,
        reason: "workbench.connection.endpointMissing",
      });
    if (terminal === "source" || !context.sourceNode)
      return this.reportConnectionRejection(edge, {
        valid: false,
        reason: "workbench.connection.sourcePortRequired",
      });
    const point = edge.getTargetPoint();
    const rejected = this.rejectedAttempts.get(edge);
    const rejectedNode = rejected?.targetNode ? this.graph?.getCellById(rejected.targetNode) : null;
    if (
      rejected &&
      rejectedNode?.isNode() &&
      rejectedNode.getBBox().inflate(12).containsPoint(point)
    )
      return this.reportConnectionRejection(edge, rejected, rejected);
    // Dropping on a body without a usable port is not a blank-canvas create gesture.
    const hit = this.graph?.getNodes().find((node) => node.getBBox().containsPoint(point));
    if (hit)
      return this.reportConnectionRejection(
        edge,
        { valid: false, reason: "workbench.connection.targetPortRequired" },
        { ...context, targetNode: hit.id },
      );
    return true;
  }

  private validateConnection(args: {
    edge?: Edge | null;
    sourceCell?: Cell | null;
    targetCell?: Cell | null;
    sourcePort?: string | null;
    targetPort?: string | null;
  }): boolean {
    // A new blank drop stays reachable even for an incoming-only source so the
    // picker can explain why no target is offered. No persistent relation is made.
    if (!args.targetCell) return true;
    const sourceNode = args.sourceCell?.id ?? "";
    const targetNode = args.targetCell.id;
    const context: ConnectionContext = {
      sourceNode,
      targetNode,
      sourcePort: args.sourcePort ? this.getPortDefinition(sourceNode, args.sourcePort) : null,
      targetPort: args.targetPort ? this.getPortDefinition(targetNode, args.targetPort) : null,
    };
    const result = this.evaluateConnectionRules(context, { edgeId: args.edge?.id }, false);
    if (args.edge) {
      if (result.valid) this.rejectedAttempts.delete(args.edge);
      else this.rejectedAttempts.set(args.edge, { ...result, sourceNode, targetNode });
    }
    return result.valid;
  }

  private toX6Terminal(ref: string | PortRef): string | { cell: string; port: string } {
    return typeof ref === "string" ? ref : { cell: ref.cell, port: ref.port };
  }

  private fromX6Terminal(cellId: string, portId?: string): string | PortRef {
    return portId ? { cell: cellId, port: portId } : cellId;
  }

  private translatePorts(ports?: PortDefinition[]): X6Node["ports"] | undefined {
    if (!ports?.length) return undefined;
    const groups: NonNullable<X6Node["ports"]["groups"]> = {};
    const items: X6Node["ports"]["items"] = [];
    ports.forEach((port) => {
      const groupKey = `${port.group}-${port.position}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          position: port.position,
          markup: [
            { tagName: "circle", selector: "circle" },
            { tagName: "title", selector: "title" },
          ],
          attrs: { circle: { r: 5, magnet: true, stroke: port.color ?? "#5F95FF", fill: "#fff" } },
        };
      }
      items.push({
        id: port.id ?? groupKey,
        group: groupKey,
        attrs: {
          ...(port.label ? { title: { text: port.label } } : undefined),
          ...port.attrs,
        },
      });
    });
    return { groups, items };
  }
}
