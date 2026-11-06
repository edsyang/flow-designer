import { autorun } from "mobx";
import type { Document, ContentNode, GenericRelation } from "@flow-designer/model";
import { prototypeRegistry } from "@flow-designer/model";
import type { GraphManager } from "@flow-designer/graph";
import { NodeBridge } from "./node-bridge";
import { EdgeBridge } from "./edge-bridge";
import { CanvasConnectionError, commitCanvasConnection } from "../commands";

export type SyncDirection = "idle" | "model-to-graph" | "graph-to-model";
type TimelineData = Parameters<Document["applyTimelinePointData"]>[0];

export function truncateLabel(raw: string, shape?: string): string {
  const maxW = shape?.includes("diamond")
    ? 10
    : shape?.includes("circle")
      ? /^[\u0000-\u007f]*$/.test(raw)
        ? 8
        : 4
      : 12;
  let labelW = 0;
  for (const ch of raw) {
    labelW += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  }
  if (labelW <= maxW) return raw;
  let w = 0;
  let end = 0;
  for (const ch of raw) {
    const cw = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (w + cw > maxW - 1) break;
    w += cw;
    end++;
  }
  return raw.slice(0, end) + "…";
}

interface NodeBridgeEntry {
  node: NodeBridge;
  edge: EdgeBridge;
}

interface X6EdgeHandle {
  id: string;
  getSourceCellId(): string;
  getSourcePortId(): string | undefined;
  getTargetCellId(): string;
  getTargetPortId(): string | undefined;
  getVertices(): Array<{ x: number; y: number }>;
}

interface X6NodeHandle {
  id: string;
  position(): { x: number; y: number };
}

export class GraphBridge {
  private syncDirection: SyncDirection = "idle";
  private isResetting = false;
  private prevNodeIds: Set<string> = new Set();
  private nodeBridges: Map<string, NodeBridgeEntry> = new Map();
  private disposeAutorun: (() => void) | null = null;
  private eventOffs: Array<() => void> = [];
  private pendingPositionEchoes: Set<string> = new Set();

  constructor(
    private graphManager: GraphManager,
    private document: Document,
    private reportError: (error: unknown) => void = (error) => {
      console.error(error);
    },
  ) {}

  getSyncDirection(): SyncDirection {
    return this.syncDirection;
  }

  /**
   * Props.onChange notifications are microtask-deferred (see model's nextTick/queueTick
   * scheduler), so syncDirection is already reset to 'idle' by the time NodeBridge's
   * callback fires. This persistent marker survives that gap instead of a time-windowed flag.
   */
  markPositionEcho(nodeId: string): void {
    this.pendingPositionEchoes.add(nodeId);
  }

  consumePositionEcho(nodeId: string): boolean {
    return this.pendingPositionEchoes.delete(nodeId);
  }

  setup(): void {
    this.disposeAutorun = autorun(() => {
      this.syncModelToGraph();
    });
    this.bindGraphEvents();
  }

  teardown(): void {
    this.disposeAutorun?.();
    this.disposeAutorun = null;
    this.eventOffs.forEach((off) => {
      off();
    });
    this.eventOffs = [];
    this.nodeBridges.forEach((entry) => {
      entry.node.dispose();
      entry.edge.dispose();
    });
    this.nodeBridges.clear();
    this.prevNodeIds.clear();
    this.pendingPositionEchoes.clear();
  }

  resetFromData(data: TimelineData): void {
    this.isResetting = true;
    try {
      this.pendingPositionEchoes.clear();
      this.document.applyTimelinePointData(data);
      const nodes = this.document.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
      const ids = new Set(nodes.map((node) => node.getId()));
      for (const id of this.prevNodeIds) {
        if (!ids.has(id)) {
          this.graphManager.removeCell(id);
          const entry = this.nodeBridges.get(id);
          entry?.node.dispose();
          entry?.edge.dispose();
          this.nodeBridges.delete(id);
        }
      }
      this.graphManager.batchUpdate(() => {
        for (const node of nodes) {
          if (!this.prevNodeIds.has(node.getId()))
            this.graphManager.addNode(this.toNodeConfig(node));
        }
        for (const node of nodes) {
          if (!this.prevNodeIds.has(node.getId())) {
            this.attachBridges(node);
          } else {
            this.nodeBridges.get(node.getId())?.node.refresh();
            this.nodeBridges.get(node.getId())?.edge.refresh();
          }
        }
      });
      this.prevNodeIds = ids;
    } finally {
      this.isResetting = false;
    }
  }

  private syncModelToGraph(): void {
    const nodes = this.document.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
    const currentIds = new Set(nodes.map((node) => node.getId()));
    if (this.isResetting) return;
    const added = nodes.filter((node) => !this.prevNodeIds.has(node.getId()));
    const removedIds = [...this.prevNodeIds].filter((id) => !currentIds.has(id));

    if (!added.length && !removedIds.length) {
      return;
    }

    this.syncDirection = "model-to-graph";
    try {
      removedIds.forEach((id) => {
        this.graphManager.removeCell(id);
        this.pendingPositionEchoes.delete(id);
        const entry = this.nodeBridges.get(id);
        if (entry) {
          entry.node.dispose();
          entry.edge.dispose();
          this.nodeBridges.delete(id);
        }
      });
      this.graphManager.batchUpdate(() => {
        added.forEach((node) => this.graphManager.addNode(this.toNodeConfig(node)));
        added.forEach((node) => {
          this.attachBridges(node);
        });
      });
    } finally {
      this.syncDirection = "idle";
    }
    this.prevNodeIds = currentIds;
  }

  private attachBridges(node: ContentNode<GenericRelation>): void {
    if (this.nodeBridges.has(node.getId())) return;
    this.nodeBridges.set(node.getId(), {
      node: new NodeBridge(this.graphManager, node, this),
      edge: new EdgeBridge(this.graphManager, node, this),
    });
  }

  private toNodeConfig(node: ContentNode) {
    const prototype = prototypeRegistry.getPrototypeByType(node.getTypeName());
    const type = prototype?.getName() ?? node.getTypeName();
    const { x, y } = node.getPosition();
    const name = node.getProps().getProp("name")?.getData() as string | undefined;
    const shape = prototype?.getView().shape;
    const label = truncateLabel(prototype?.getNameForValue(name) ?? name ?? type, shape);
    return {
      id: node.getId(),
      type,
      x,
      y,
      label,
      data: { contentNode: node, __nodeType: node.getTypeName() },
    };
  }

  private toEdgeConfigs(node: ContentNode<GenericRelation>) {
    return node
      .getRelation()
      .serialize()
      .map((edge) => {
        let source: string | { cell: string; port: string } = node.getId();
        let target: string | { cell: string; port: string } = edge.targetNodeId;

        if (edge.sourcePort) {
          source = { cell: node.getId(), port: edge.sourcePort };
        } else {
          const defaultPort = this.getDefaultOutPort(node.getId());
          if (defaultPort) source = { cell: node.getId(), port: defaultPort };
        }

        if (edge.targetPort) {
          target = { cell: edge.targetNodeId, port: edge.targetPort };
        } else {
          const defaultPort = this.getDefaultInPort(edge.targetNodeId);
          if (defaultPort) target = { cell: edge.targetNodeId, port: defaultPort };
        }

        return {
          id: edge.id,
          type: edge.type,
          source,
          target,
          vertices: edge.vertices,
          data: edge.props,
          labels: [],
        };
      });
  }

  private getDefaultOutPort(nodeId: string): string | null {
    const portDef = this.getFirstPortOfGroup(nodeId, "out");
    return portDef ? (portDef.id ?? `${portDef.group}-${portDef.position}`) : null;
  }

  private getDefaultInPort(nodeId: string): string | null {
    const portDef = this.getFirstPortOfGroup(nodeId, "in");
    return portDef ? (portDef.id ?? `${portDef.group}-${portDef.position}`) : null;
  }

  private getFirstPortOfGroup(nodeId: string, group: string) {
    return this.graphManager.getFirstPortOfGroup(nodeId, group);
  }

  private bindGraphEvents(): void {
    const onNodeMoved = (...args: unknown[]) => {
      const payload = args[0] as
        { cell?: X6NodeHandle; node?: X6NodeHandle; routingEdgeIds?: string[] } | undefined;
      const cell = payload?.cell ?? payload?.node;
      if (!cell) return;
      this.syncDirection = "graph-to-model";
      try {
        const contentNode = this.document.getContent().getNode(cell.id);
        if (contentNode) {
          const pos = cell.position();
          this.markPositionEcho(cell.id);
          void this.document.transaction("Move node", () => {
            contentNode.setPosition(pos.x, pos.y);
            const graph = this.graphManager.getX6Graph() as {
              getCellById(id: string): X6NodeHandle | X6EdgeHandle | null;
              getConnectedEdges(node: X6NodeHandle): X6EdgeHandle[];
            } | null;
            const graphNode = graph?.getCellById(cell.id) as X6NodeHandle | null | undefined;
            const routingIds = new Set(payload?.routingEdgeIds ?? []);
            const connected = graph && graphNode ? graph.getConnectedEdges(graphNode) : [];
            const rerouted = [...routingIds]
              .map((id) => graph?.getCellById(id) as X6EdgeHandle | null | undefined)
              .filter((edge): edge is X6EdgeHandle => Boolean(edge));
            const edges = new Map([...connected, ...rerouted].map((edge) => [edge.id, edge]));
            for (const edge of edges.values()) {
              if (
                edge.getSourceCellId() !== cell.id &&
                edge.getTargetCellId() !== cell.id &&
                !routingIds.has(edge.id)
              )
                continue;
              const source = this.document
                .getContent()
                .getNode(edge.getSourceCellId()) as ContentNode<GenericRelation> | null;
              const relation = source?.getRelation();
              if (relation?.getEdgeById(edge.id))
                relation.updateEdge(edge.id, {
                  sourcePort: edge.getSourcePortId(),
                  targetPort: edge.getTargetPortId(),
                  vertices: edge.getVertices(),
                });
            }
          });
        }
      } finally {
        this.syncDirection = "idle";
      }
    };
    this.graphManager.on("node:moved", onNodeMoved);
    this.eventOffs.push(() => {
      this.graphManager.off("node:moved", onNodeMoved);
    });

    const onSelectionChanged = () => {
      this.document.getSelection().setKeys(this.graphManager.getSelection());
    };
    this.graphManager.on("selection:changed", onSelectionChanged);
    this.eventOffs.push(() => {
      this.graphManager.off("selection:changed", onSelectionChanged);
    });

    const onEdgeClick = (...args: unknown[]) => {
      const payload = args[0] as { edge?: { id: string } } | undefined;
      const edge = payload?.edge;
      if (!edge) return;
      this.graphManager.select([edge.id]);
    };
    this.graphManager.on("edge:click", onEdgeClick);
    this.eventOffs.push(() => {
      this.graphManager.off("edge:click", onEdgeClick);
    });

    const onEdgeConnected = (...args: unknown[]) => {
      const payload = args[0] as { edge?: X6EdgeHandle } | undefined;
      const edge = payload?.edge;
      if (!edge) return;
      // Drops over empty canvas never carry a target cell; the workbench turns
      // them into `connection:blank` instead of persisting a dangling relation.
      if (!edge.getTargetCellId()) return;
      this.syncDirection = "graph-to-model";
      try {
        const sourceNode = this.document
          .getContent()
          .getNode(edge.getSourceCellId()) as ContentNode<GenericRelation> | null;
        if (sourceNode) {
          const nodes = this.document.getContent().getNodes() as Array<
            ContentNode<GenericRelation>
          >;
          const previous = nodes.find((node) => node.getRelation().getEdgeById(edge.id));
          const existing = previous?.getRelation().getEdgeById(edge.id);
          if (existing && previous) {
            const patch = {
              targetNodeId: edge.getTargetCellId(),
              sourcePort: edge.getSourcePortId(),
              targetPort: edge.getTargetPortId(),
            };
            if (previous.getId() === sourceNode.getId()) {
              previous.getRelation().updateEdge(edge.id, patch);
            } else {
              void this.document.transaction("Reconnect edge", () => {
                previous.getRelation().removeEdgeById(edge.id);
                sourceNode.getRelation().addEdge({ ...existing, ...patch });
              });
            }
            this.graphManager.select([edge.id]);
            return;
          }
          const edgeTypeName =
            this.graphManager.getEdgeTypeName(edge.id) ??
            this.graphManager.getDefaultEdgeType() ??
            undefined;
          void this.document
            .transaction("Create connection", () => {
              try {
                commitCanvasConnection({
                  document: this.document,
                  graph: this.graphManager,
                  edgeId: edge.id,
                  edgeType: edgeTypeName,
                  source: {
                    nodeId: edge.getSourceCellId(),
                    portId: edge.getSourcePortId() ?? null,
                  },
                  target: {
                    nodeId: edge.getTargetCellId(),
                    portId: edge.getTargetPortId() ?? null,
                  },
                  vertices: edge.getVertices(),
                });
                const created = sourceNode.getRelation().getEdgeById(edge.id);
                this.graphManager.updateEdge({
                  id: edge.id,
                  type: edgeTypeName,
                  source: edge.getSourcePortId()
                    ? { cell: sourceNode.getId(), port: edge.getSourcePortId() as string }
                    : sourceNode.getId(),
                  target: edge.getTargetPortId()
                    ? { cell: edge.getTargetCellId(), port: edge.getTargetPortId() as string }
                    : edge.getTargetCellId(),
                  vertices: edge.getVertices(),
                  data: created?.props,
                  labels: [],
                });
                if (edgeTypeName) this.graphManager.setEdgeTypeName(edge.id, edgeTypeName);
              } catch (error) {
                sourceNode.getRelation().removeEdgeById(edge.id);
                throw error;
              }
            })
            .then(() => {
              if (this.disposeAutorun) this.graphManager.select([edge.id]);
            })
            .catch((error: unknown) => {
              this.graphManager.removeCell(edge.id);
              const graph = this.graphManager.getX6Graph() as {
                trigger(name: string, payload: unknown): unknown;
              } | null;
              void graph?.trigger("connection:rejected", {
                valid: false,
                reason:
                  error instanceof CanvasConnectionError
                    ? error.reason
                    : "workbench.connection.incompatible",
                sourceNode: edge.getSourceCellId(),
                targetNode: edge.getTargetCellId(),
              });
              if (!(error instanceof CanvasConnectionError)) this.reportError(error);
            });
          return;
        }
        this.graphManager.select([edge.id]);
      } finally {
        this.syncDirection = "idle";
      }
    };
    const onEdgeMouseUp = (...args: unknown[]) => {
      const edge = (args[0] as { edge?: X6EdgeHandle } | undefined)?.edge;
      if (!edge) return;
      const nodes = this.document.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
      const relation = nodes
        .map((node) => node.getRelation())
        .find((item) => item.getEdgeById(edge.id));
      const existing = relation?.getEdgeById(edge.id);
      const vertices = edge.getVertices();
      if (existing && JSON.stringify(existing.vertices ?? []) !== JSON.stringify(vertices)) {
        void this.document.transaction("Edit edge vertices", () => {
          relation?.updateEdge(edge.id, { vertices });
        });
      }
    };
    this.graphManager.on("edge:vertices:committed", onEdgeMouseUp);
    this.eventOffs.push(() => {
      this.graphManager.off("edge:vertices:committed", onEdgeMouseUp);
    });

    this.graphManager.on("edge:connected", onEdgeConnected);
    this.eventOffs.push(() => {
      this.graphManager.off("edge:connected", onEdgeConnected);
    });

    const onNodeAddedByStencil = (...args: unknown[]) => {
      const payload = args[0] as
        { cell?: X6NodeHandle & { getData<T = Record<string, unknown>>(): T } } | undefined;
      const cell = payload?.cell;
      if (!cell) return;
      const pos = cell.position();
      const nodeType = (cell.getData<{ __nodeType?: string }>() ?? {}).__nodeType;
      // The dropped cell is a bare X6 clone from the stencil's mini-graph, not yet backed
      // by a Model node; remove it and let the normal Model->Graph sync path (autorun in
      // syncModelToGraph) create the real cell once content.addNode() resolves, avoiding
      // an id collision between the temp drop and the model-driven cell.
      this.graphManager.removeCell(cell.id);
      if (!nodeType) return;
      void this.document.transaction("Create node", async () => {
        const newNode = await this.document
          .getContent()
          .addNode({ type: nodeType, props: { __position: pos } });
        if (newNode && this.disposeAutorun) {
          this.graphManager.select([newNode.getId()]);
          this.document.getSelection().setKeys([newNode.getId()]);
        }
      });
    };
    this.graphManager.on("node:added-by-stencil", onNodeAddedByStencil);
    this.eventOffs.push(() => {
      this.graphManager.off("node:added-by-stencil", onNodeAddedByStencil);
    });
  }
}
