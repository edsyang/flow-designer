import type { GraphNotifications } from "./graph-notifications";
import { runCleanupTasks } from "./cleanup-tasks";
import type { Graph, Cell, Edge, Node as X6Node } from "@antv/x6";
import { canUsePort } from "@flow-designer/model";
import type { PortDefinition } from "@flow-designer/model";
import type { BlankConnectionEvent, EdgeTypeConfig } from "./contracts";
import type { ConnectionCoordinator } from "./connection-coordinator";
import type { GraphPresentation } from "./graph-presentation";
import { markRoutingPersisted, routingAffectedEdges } from "./edge-routing";
/** Owns live pointer/tool sessions; model commits remain downstream graph events. */
export class GraphInteractionSessions {
  private cleanups: Array<() => void> = [];
  constructor(
    private currentGraph: () => Graph | null,
    private connections: ConnectionCoordinator,
    private presentation: GraphPresentation,
    private edgeTypeByCellId: ReadonlyMap<string, string>,
    private edgeTypes: ReadonlyMap<string, EdgeTypeConfig>,
    private setEdgeType: (id: string, type: string) => void,
    private notifications: GraphNotifications,
  ) {}
  private get graph(): Graph | null {
    return this.currentGraph();
  }
  private assertGraph(): Graph {
    const graph = this.graph;
    if (!graph) throw new Error("GraphManager has not been initialized. Call init() first.");
    return graph;
  }
  setupEdgeToolsOnHover(): void {
    const graph = this.assertGraph();
    let isDragging = false;
    let deferredLeaveEdge: any = null;
    const colorEdge = (edge: Cell, hover: boolean) => {
      this.presentation.paintEdgeHighlight(edge, hover);
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
      if (!this.presentation.hoveredEdgeId) return;
      const edge = graph.getCellById(this.presentation.hoveredEdgeId) as any;
      if (edge) unhoverEdge(edge);
      this.presentation.hoveredEdgeId = null;
      deferredLeaveEdge = null;
    };

    // Tool redraws can replace the hovered SVG before X6 emits mouseleave.
    // Check the pointer's owning cell without clearing tools beneath a drag.
    const owner =
      graph.container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? graph.container;
    const onOwnerMove = (event: MouseEvent) => {
      if (!this.presentation.hoveredEdgeId || isDragging || event.buttons !== 0) return;
      const cell = event.target instanceof Element ? event.target.closest("[data-cell-id]") : null;
      if (cell?.getAttribute("data-cell-id") !== this.presentation.hoveredEdgeId)
        clearHoveredEdge();
    };
    const onOwnerLeave = (event: MouseEvent) => {
      if (!isDragging && event.buttons === 0) clearHoveredEdge();
    };
    owner.addEventListener("mousemove", onOwnerMove, true);
    owner.addEventListener("mouseleave", onOwnerLeave);
    this.cleanups.push(() => {
      owner.removeEventListener("mousemove", onOwnerMove, true);
      owner.removeEventListener("mouseleave", onOwnerLeave);
    });

    let isEdgeDragging = false;

    const onSegmentDragChanged = ({ edge }: { edge: any }) => {
      setDashed(edge, false);
      this.connections.enforceOrthogonalVertices(edge);
      this.connections.updateRouterDirections(edge);
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
          if (this.presentation.hoveredEdgeId === edge.id) {
            this.presentation.hoveredEdgeId = null;
          }
          setDashed(edge, false);
          unhoverEdge(edge);
        });
      }
    };
    graph.container.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", onMouseUp);
    this.cleanups.push(() => {
      graph.container.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp);
    });

    graph.on("edge:change:vertices", ({ edge }: { edge: any }) => {
      if (this.presentation.hoveredEdgeId === edge.id && isDragging && !isEdgeDragging) {
        isEdgeDragging = true;
        setDashed(edge, true);
      }
    });

    graph.on("edge:mouseenter", ({ edge }: { edge: any }) => {
      if (this.presentation.hoveredEdgeId && this.presentation.hoveredEdgeId !== edge.id) {
        const prev = graph.getCellById(this.presentation.hoveredEdgeId) as any;
        if (prev) unhoverEdge(prev);
      }
      if (deferredLeaveEdge && deferredLeaveEdge.id !== edge.id) {
        unhoverEdge(deferredLeaveEdge);
      }
      deferredLeaveEdge = null;
      this.presentation.hoveredEdgeId = edge.id;
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
                this.connections.hasShortConnectionRoute(
                  this.connections.connectionContext(edited),
                  edited.id,
                  edited.getVertices() as Array<{ x: number; y: number }>,
                ),
              onRejected: (edited: Edge) =>
                this.connections.reportConnectionRejection(edited, {
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
      if (this.presentation.hoveredEdgeId === edge.id) {
        this.presentation.hoveredEdgeId = null;
      }
      unhoverEdge(edge);
    });

    graph.on("blank:click", clearHoveredEdge);
    graph.on("blank:mousedown", clearHoveredEdge);
    graph.on("node:click", clearHoveredEdge);
    graph.on("node:mousedown", clearHoveredEdge);
  }

  setupBlankConnection(): void {
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
          sourcePortId ? this.connections.getPortDefinition(sourceCellId, sourcePortId) : null,
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

  setupPortAutoSwitch(): void {
    const graph = this.assertGraph();

    graph.on("edge:connected", ({ edge, isNew }: { edge: Edge; isNew?: boolean }) => {
      if (this.graph !== graph || !edge.getTargetCell()) return;
      markRoutingPersisted(edge);
      if (!this.edgeTypeByCellId.has(edge.id)) {
        const defaultType = this.connections.getDefaultEdgeType();
        if (defaultType) this.setEdgeType(edge.id, defaultType);
      }
      this.connections.updateRouterDirections(edge);
      this.connections.updateConnectorDirections(edge);
      this.notifications.publishEdit({
        type: "edge-connected",
        edge: this.notifications.edgeSnapshot(edge),
        ...(isNew === undefined ? {} : { isNew }),
      });
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
        this.connections.updateRouterDirections(item.edge);
        this.connections.updateConnectorDirections(item.edge);
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
        const source = this.connections.getPortDefinition(
          edge.getSourceCellId(),
          edge.getSourcePortId()!,
        );
        const target = this.connections.getPortDefinition(
          edge.getTargetCellId(),
          edge.getTargetPortId()!,
        );
        const directional = (port: PortDefinition | null) =>
          !!port && !port.id && !port.label && !port.dataType;
        this.connections.autoSwitchEdgePorts(
          edge,
          !directional(source),
          !directional(target),
          true,
        );
        if (edge.getVertices().length) edge.setVertices([]);
        this.connections.updateRouterDirections(edge);
        this.connections.updateConnectorDirections(edge);
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
            !this.connections.hasShortConnectionRoute(
              this.connections.connectionContext(edge),
              edge.id,
            ) &&
            (() => {
              for (const saved of [gesture, initial])
                if (saved && !saved.edges.some((item) => item.edge.id === edge.id))
                  saved.edges.push({
                    edge,
                    source: edge.getSource(),
                    target: edge.getTarget(),
                    vertices: edge.getVertices() as Array<{ x: number; y: number }>,
                  });
              return !this.connections.tryAlternativeDirectionalPorts(edge);
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
          this.connections.reportConnectionRejection(invalid, {
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
      if (this.graph !== graph || !movingNode(args)) return;
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
      const node = movingNode(args);
      if (node) {
        const edges = new Map(
          [
            ...graph.getConnectedEdges(node),
            ...(args.routingEdgeIds ?? [])
              .map((id): Cell | null | undefined => graph.getCellById(id))
              .filter((cell): cell is Edge => !!cell && cell.isEdge()),
          ].map((edge) => [edge.id, edge]),
        );
        const position = node.position();
        this.notifications.publishEdit({
          type: "node-moved",
          nodeId: node.id,
          position: { x: position.x, y: position.y },
          edges: [...edges.values()].map((edge) => this.notifications.edgeSnapshot(edge)),
        });
      }
      gesture = null;
      initial = null;
    });
  }
  dispose(): void {
    runCleanupTasks(this.cleanups.splice(0));
  }
}
