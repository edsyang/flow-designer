import { autorun } from "mobx";
import type { Document, ContentNode, GenericRelation } from "@flow-designer/model";
import { canUsePort } from "@flow-designer/model";
import type { GraphPort, GraphEdit, GraphApplicationEvent } from "@flow-designer/core";
import { NodeBridge } from "./node-bridge";
import { EdgeBridge } from "./edge-bridge";
import { CanvasConnectionError, applyCanvasGraphEdit } from "../commands";

export type SyncDirection = "idle" | "model-to-graph" | "graph-to-model";
type TimelineData = Parameters<Document["applyTimelinePointData"]>[0];

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
    const type = prototype.getName();
    const { x, y } = node.getPosition();
    const name = node.getProps().getProp("name")?.getData() as string | undefined;
    const label = prototype.getNameForValue(name);
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
    this.eventOffs.push(
      this.graphManager.subscribeEdits((edit) => {
        this.applyGraphEdit(edit);
      }),
    );
    this.eventOffs.push(
      this.graphManager.subscribeEvents((event) => {
        this.applyGraphEvent(event);
      }),
    );
  }

  private applyGraphEvent(event: GraphApplicationEvent): void {
    if (event.type === "selection-changed") {
      this.document.getSelection().setKeys([...event.ids]);
    } else if (event.type === "edge-clicked") {
      this.graphManager.select([event.edgeId]);
    }
  }

  private applyGraphEdit(edit: GraphEdit): void {
    void applyCanvasGraphEdit({
      document: this.document,
      graph: this.graphManager,
      edit,
      isActive: () => this.disposeAutorun !== null,
      mutate: (operation, movedIds) => {
        this.syncDirection = "graph-to-model";
        try {
          for (const id of movedIds) this.markPositionEcho(id);
          operation();
        } finally {
          this.syncDirection = "idle";
        }
      },
    }).catch((error: unknown) => {
      if (edit.type === "edge-connected" && this.disposeAutorun) {
        // Existing relations remain authoritative after an unsuccessful projection.
        const exists = this.document
          .getContent()
          .getNodes()
          .some((node) => (node.getRelation() as GenericRelation).getEdgeById(edit.edge.edgeId));
        if (!exists) this.graphManager.removeCell(edit.edge.edgeId);
        this.graphManager.notifyConnectionRejected({
          valid: false,
          reason:
            error instanceof CanvasConnectionError
              ? error.reason
              : "workbench.connection.incompatible",
          sourceNode: edit.edge.sourceNodeId,
          targetNode: edit.edge.targetNodeId,
        });
      }
      if (!(error instanceof CanvasConnectionError)) this.reportError(error);
    });
  }
}
