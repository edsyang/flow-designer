import type { ContentNode, GenericRelation } from "@flow-designer/model";
import type { GraphManager } from "@flow-designer/graph";
import type { GraphBridge } from "./graph-bridge";

export class EdgeBridge {
  private unsubscribe: () => void;
  private prevEdgeIds: Set<string> = new Set();
  private snapshots = new Map<string, string>();

  constructor(
    private graphManager: GraphManager,
    private node: ContentNode<GenericRelation>,
    private bridge: GraphBridge,
  ) {
    this.syncEdges();
    this.unsubscribe = node.getRelation().onChange(() => {
      if (this.bridge.getSyncDirection() === "graph-to-model") {
        const edges = this.node.getRelation().serialize();
        this.prevEdgeIds = new Set(edges.map((edge) => edge.id));
        this.snapshots = new Map(edges.map((edge) => [edge.id, JSON.stringify(edge)]));
        return;
      }
      this.syncEdges();
    });
  }

  refresh(): void {
    this.syncEdges();
  }

  private syncEdges(): void {
    const serialized = this.node.getRelation().serialize();
    const currentIds = new Set(serialized.map((edge) => edge.id));

    [...this.prevEdgeIds]
      .filter((id) => !currentIds.has(id))
      .forEach((id) => {
        this.graphManager.removeCell(id);
        this.snapshots.delete(id);
      });

    serialized
      .filter((edge) => !this.prevEdgeIds.has(edge.id))
      .forEach((edge) => {
        this.graphManager.addEdge({
          id: edge.id,
          type: edge.type,
          source: edge.sourcePort
            ? { cell: this.node.getId(), port: edge.sourcePort }
            : this.node.getId(),
          target: edge.targetPort
            ? { cell: edge.targetNodeId, port: edge.targetPort }
            : edge.targetNodeId,
          vertices: edge.vertices,
          data: edge.props,
          labels:
            typeof edge.props?.label === "string" && edge.props.label ? [edge.props.label] : [],
        });
      });

    for (const edge of serialized) {
      const snapshot = JSON.stringify(edge);
      if (this.prevEdgeIds.has(edge.id) && this.snapshots.get(edge.id) !== snapshot) {
        this.graphManager.updateEdge({
          id: edge.id,
          type: edge.type,
          source: edge.sourcePort
            ? { cell: this.node.getId(), port: edge.sourcePort }
            : this.node.getId(),
          target: edge.targetPort
            ? { cell: edge.targetNodeId, port: edge.targetPort }
            : edge.targetNodeId,
          vertices: edge.vertices,
          data: edge.props,
          labels:
            typeof edge.props?.label === "string" && edge.props.label ? [edge.props.label] : [],
        });
      }
      this.snapshots.set(edge.id, snapshot);
    }
    this.prevEdgeIds = currentIds;
  }

  dispose(): void {
    this.unsubscribe();
  }
}
