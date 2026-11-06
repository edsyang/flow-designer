import { autorun } from "mobx";
import type { Document, ContentNode, GenericRelation } from "@flow-designer/model";
import { canUsePort } from "@flow-designer/model";
import type {
  GraphPort,
  GraphEdgeSnapshot,
  GraphEdit,
  GraphApplicationEvent,
} from "@flow-designer/core";
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

export class GraphBridge {
  private syncDirection: SyncDirection = "idle";
  private isResetting = false;
  private prevNodeIds: Set<string> = new Set();
  private nodeBridges: Map<string, NodeBridgeEntry> = new Map();
  private disposeAutorun: (() => void) | null = null;
  private eventOffs: Array<() => void> = [];
  private pendingPositionEchoes: Set<string> = new Set();

  constructor(
    private graphManager: GraphPort,
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
    const prototype = node.getPrototype();
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
    return (
      this.graphManager
        .getNodePorts(nodeId)
        .find((port) =>
          group === "in" || group === "out"
            ? canUsePort(port, group === "in" ? "target" : "source")
            : port.group === group,
        ) ?? null
    );
  }

  private bindGraphEvents(): void {
    this.eventOffs.push(this.graphManager.subscribeEdits((edit) => this.applyGraphEdit(edit)));
    this.eventOffs.push(this.graphManager.subscribeEvents((event) => this.applyGraphEvent(event)));
  }

  private applyGraphEvent(event: GraphApplicationEvent): void {
    if (event.type === "selection-changed") {
      this.document.getSelection().setKeys([...event.ids]);
    } else if (event.type === "edge-clicked") {
      this.graphManager.select([event.edgeId]);
    }
  }

  private applyGraphEdit(edit: GraphEdit): void {
    if (edit.type === "node-moved") {
      const node = this.document.getContent().getNode(edit.nodeId);
      if (!node) return;
      this.syncDirection = "graph-to-model";
      try {
        this.markPositionEcho(edit.nodeId);
        void this.document
          .transaction("Move node", () => {
            node.setPosition(edit.position.x, edit.position.y);
            for (const edge of edit.edges) {
              const source = this.document
                .getContent()
                .getNode(edge.sourceNodeId) as ContentNode<GenericRelation> | null;
              const relation = source?.getRelation();
              if (relation?.getEdgeById(edge.edgeId))
                relation.updateEdge(edge.edgeId, {
                  sourcePort: edge.sourcePortId,
                  targetPort: edge.targetPortId,
                  vertices: edge.vertices.map((point) => ({ ...point })),
                });
            }
          })
          .catch(this.reportError);
      } finally {
        this.syncDirection = "idle";
      }
    } else if (edit.type === "edge-connected") {
      this.applyConnection(edit.edge);
    } else if (edit.type === "edge-vertices-edited") {
      const nodes = this.document.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
      const relation = nodes
        .map((node) => node.getRelation())
        .find((item) => item.getEdgeById(edit.edgeId));
      const existing = relation?.getEdgeById(edit.edgeId);
      if (existing && JSON.stringify(existing.vertices ?? []) !== JSON.stringify(edit.vertices)) {
        void this.document
          .transaction("Edit edge vertices", () => {
            relation?.updateEdge(edit.edgeId, {
              vertices: edit.vertices.map((point) => ({ ...point })),
            });
          })
          .catch(this.reportError);
      }
    } else {
      this.graphManager.removeCell(edit.temporaryNodeId);
      if (!edit.nodeType) return;
      void this.document
        .transaction("Create node", async () => {
          const newNode = await this.document
            .getContent()
            .addNode({ type: edit.nodeType, props: { __position: { ...edit.position } } });
          if (newNode && this.disposeAutorun) {
            this.graphManager.select([newNode.getId()]);
            this.document.getSelection().setKeys([newNode.getId()]);
          }
        })
        .catch(this.reportError);
    }
  }

  private applyConnection(edge: GraphEdgeSnapshot): void {
    if (!edge.targetNodeId) return;
    this.syncDirection = "graph-to-model";
    try {
      const sourceNode = this.document
        .getContent()
        .getNode(edge.sourceNodeId) as ContentNode<GenericRelation> | null;
      if (!sourceNode) {
        this.graphManager.select([edge.edgeId]);
        return;
      }
      const nodes = this.document.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
      const previous = nodes.find((node) => node.getRelation().getEdgeById(edge.edgeId));
      const existing = previous?.getRelation().getEdgeById(edge.edgeId);
      if (existing && previous) {
        const patch = {
          targetNodeId: edge.targetNodeId,
          sourcePort: edge.sourcePortId,
          targetPort: edge.targetPortId,
        };
        if (previous.getId() === sourceNode.getId())
          previous.getRelation().updateEdge(edge.edgeId, patch);
        else
          void this.document
            .transaction("Reconnect edge", () => {
              previous.getRelation().removeEdgeById(edge.edgeId);
              sourceNode.getRelation().addEdge({ ...existing, ...patch });
            })
            .catch(this.reportError);
        this.graphManager.select([edge.edgeId]);
        return;
      }
      const edgeTypeName = edge.edgeType ?? this.graphManager.getDefaultEdgeType() ?? undefined;
      void this.document
        .transaction("Create connection", () => {
          try {
            commitCanvasConnection({
              document: this.document,
              graph: this.graphManager,
              edgeId: edge.edgeId,
              edgeType: edgeTypeName,
              source: { nodeId: edge.sourceNodeId, portId: edge.sourcePortId ?? null },
              target: { nodeId: edge.targetNodeId, portId: edge.targetPortId ?? null },
              vertices: edge.vertices.map((point) => ({ ...point })),
            });
            const created = sourceNode.getRelation().getEdgeById(edge.edgeId);
            this.graphManager.updateEdge({
              id: edge.edgeId,
              type: edgeTypeName,
              source: edge.sourcePortId
                ? { cell: edge.sourceNodeId, port: edge.sourcePortId }
                : edge.sourceNodeId,
              target: edge.targetPortId
                ? { cell: edge.targetNodeId, port: edge.targetPortId }
                : edge.targetNodeId,
              vertices: edge.vertices.map((point) => ({ ...point })),
              data: created?.props,
              labels: [],
            });
          } catch (error) {
            sourceNode.getRelation().removeEdgeById(edge.edgeId);
            throw error;
          }
        })
        .then(() => {
          if (this.disposeAutorun) this.graphManager.select([edge.edgeId]);
        })
        .catch((error: unknown) => {
          this.graphManager.removeCell(edge.edgeId);
          this.graphManager.notifyConnectionRejected({
            valid: false,
            reason:
              error instanceof CanvasConnectionError
                ? error.reason
                : "workbench.connection.incompatible",
            sourceNode: edge.sourceNodeId,
            targetNode: edge.targetNodeId,
          });
          if (!(error instanceof CanvasConnectionError)) this.reportError(error);
        });
    } finally {
      this.syncDirection = "idle";
    }
  }
}
