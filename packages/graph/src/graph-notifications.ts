import { runCleanupTasks } from "./cleanup-tasks";
import type { Graph, Cell, Edge } from "@antv/x6";
import type {
  GraphPoint,
  GraphEdit,
  GraphApplicationEvent,
  GraphEdgeSnapshot,
  Unsubscribe,
  ConnectionRejectedEvent,
} from "@flow-designer/core";
import type { BlankConnectionEvent } from "./contracts";

type NativeNotificationPayloads = {
  "edge:vertices:committed": { edge: Edge };
  "node:added-by-stencil": { cell: Cell };
  "selection:changed": unknown;
  "edge:click": { edge: Edge };
  "blank:click": unknown;
  "blank:dblclick": { e?: { clientX?: number; clientY?: number }; x?: number; y?: number };
  "connection:blank": BlankConnectionEvent;
  "connection:rejected": ConnectionRejectedEvent;
  "edge:routing:degraded": { edgeIds: string[]; reason?: string };
  "interaction:change": { mode: "select" | "pan" };
  scale: unknown;
};

/** Application/commit snapshots are copied at the adapter boundary, never native handles. */
export class GraphNotifications {
  private activeGraph: Graph | null = null;
  private cleanups: Array<() => void> = [];
  private freeze(value: unknown): void {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) this.freeze(child);
    Object.freeze(value);
  }
  private listen<Name extends keyof NativeNotificationPayloads>(
    graph: Graph,
    name: Name,
    listener: (args: NativeNotificationPayloads[Name]) => void,
  ): void {
    const guarded = (args: NativeNotificationPayloads[Name]) => {
      if (this.activeGraph === graph) listener(args);
    };
    graph.on(name, guarded);
    this.cleanups.push(() => {
      graph.off(name, guarded);
    });
  }
  private edits = new Set<{ listener: (edit: GraphEdit) => void }>();
  private events = new Set<{ listener: (event: GraphApplicationEvent) => void }>();
  constructor(private getEdgeType: (id: string) => string | null) {}
  subscribeEdits(listener: (edit: GraphEdit) => void): Unsubscribe {
    const entry = { listener };
    this.edits.add(entry);
    return () => {
      this.edits.delete(entry);
    };
  }
  subscribeEvents(listener: (event: GraphApplicationEvent) => void): Unsubscribe {
    const entry = { listener };
    this.events.add(entry);
    return () => {
      this.events.delete(entry);
    };
  }
  publishEdit(edit: GraphEdit): void {
    this.freeze(edit);
    for (const entry of [...this.edits]) if (this.edits.has(entry)) entry.listener(edit);
  }
  publishEvent(event: GraphApplicationEvent): void {
    this.freeze(event);
    for (const entry of [...this.events]) if (this.events.has(entry)) entry.listener(event);
  }
  edgeSnapshot(edge: Edge): GraphEdgeSnapshot {
    const type = this.getEdgeType(edge.id);
    const sourcePort = edge.getSourcePortId(),
      targetPort = edge.getTargetPortId();
    return {
      edgeId: edge.id,
      ...(type ? { edgeType: type } : {}),
      sourceNodeId: edge.getSourceCellId(),
      targetNodeId: edge.getTargetCellId(),
      ...(sourcePort === undefined ? {} : { sourcePortId: sourcePort }),
      ...(targetPort === undefined ? {} : { targetPortId: targetPort }),
      vertices: (edge.getVertices() as GraphPoint[]).map((point) => ({ x: point.x, y: point.y })),
    };
  }
  /** Native semantic completion events already fire after the tools restore/normalize. */
  install(graph: Graph): void {
    this.activeGraph = graph;
    this.listen(graph, "edge:vertices:committed", ({ edge }: { edge: Edge }) => {
      this.publishEdit({
        type: "edge-vertices-edited",
        edgeId: edge.id,
        vertices: (edge.getVertices() as GraphPoint[]).map((point) => ({ x: point.x, y: point.y })),
      });
    });
    this.listen(graph, "node:added-by-stencil", ({ cell }: { cell: Cell }) => {
      if (!cell.isNode()) return;
      const data = cell.getData<{ __nodeType?: string } | undefined>();
      if (!data?.__nodeType) return;
      const position = cell.position();
      this.publishEdit({
        type: "node-dropped",
        temporaryNodeId: cell.id,
        nodeType: data.__nodeType,
        position: { x: position.x, y: position.y },
      });
    });
    this.listen(graph, "selection:changed", () => {
      this.publishEvent({
        type: "selection-changed",
        ids: graph.getSelectedCells().map((cell) => cell.id),
      });
    });
    this.listen(graph, "edge:click", ({ edge }: { edge: Edge }) => {
      this.publishEvent({ type: "edge-clicked", edgeId: edge.id });
    });
    this.listen(graph, "blank:click", () => {
      this.publishEvent({ type: "blank-clicked" });
    });
    this.listen(
      graph,
      "blank:dblclick",
      (args: { e?: { clientX?: number; clientY?: number }; x?: number; y?: number }) => {
        const { x, y } = args,
          clientX = args.e?.clientX,
          clientY = args.e?.clientY;
        this.publishEvent({
          type: "blank-double-clicked",
          ...(typeof x === "number" &&
          Number.isFinite(x) &&
          typeof y === "number" &&
          Number.isFinite(y)
            ? { graphPosition: { x, y } }
            : {}),
          ...(typeof clientX === "number" &&
          Number.isFinite(clientX) &&
          typeof clientY === "number" &&
          Number.isFinite(clientY)
            ? { clientPosition: { x: clientX, y: clientY } }
            : {}),
        });
      },
    );
    this.listen(graph, "connection:blank", (args: BlankConnectionEvent) => {
      this.publishEvent({
        type: "connection-blank",
        sourceNodeId: args.sourceCellId,
        sourcePortId: args.sourcePortId,
        temporaryEdgeId: args.edgeId,
        graphPosition: { x: args.x, y: args.y },
        ...(args.reason ? { reason: args.reason } : {}),
      });
    });
    this.listen(graph, "connection:rejected", (args: ConnectionRejectedEvent) => {
      this.publishEvent({
        type: "connection-rejected",
        valid: false,
        sourceNode: args.sourceNode,
        targetNode: args.targetNode,
        ...(args.reason ? { reason: args.reason } : {}),
      });
    });
    this.listen(graph, "edge:routing:degraded", (args: { edgeIds: string[]; reason?: string }) => {
      this.publishEvent({
        type: "routing-degraded",
        edgeIds: [...args.edgeIds],
        reason: "workbench.connection.legacyRouteWarning",
      });
    });
    this.listen(graph, "interaction:change", (args: { mode: "select" | "pan" }) => {
      this.publishEvent({ type: "interaction-changed", mode: args.mode });
    });
    this.listen(graph, "scale", () => {
      this.publishEvent({ type: "zoom-changed", zoom: graph.zoom() });
    });
  }
  dispose(): void {
    this.activeGraph = null;
    this.edits.clear();
    this.events.clear();
    runCleanupTasks(this.cleanups.splice(0).reverse());
  }
}
