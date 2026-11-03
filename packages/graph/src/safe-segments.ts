import { Graph, Registry, type Dom, type Edge } from "@antv/x6";

/** Display routed segments without changing the edge until the user starts an edit. */
class RoutedSegments extends Registry.EdgeTool.presets.segments {
  private originalRouter: ReturnType<Edge["getRouter"]> | null = null;
  private originalVertices: Array<{ x: number; y: number }> = [];
  private editingRouter = false;
  private moved = false;

  protected override get vertices() {
    const edge = this.cellView.cell;
    const router: unknown = edge.getRouter();
    return router && !this.editingRouter
      ? this.cellView.routePoints.map((point) => ({ x: point.x, y: point.y }))
      : (edge.getVertices() as Array<{ x: number; y: number }>);
  }

  protected override onHandleChange(args: {
    handle: InstanceType<typeof Registry.EdgeTool.presets.segments.Handle>;
    e: Dom.MouseDownEvent;
  }): void {
    const edge = this.cellView.cell;
    const router: unknown = edge.getRouter();
    const vertices = this.vertices;
    this.originalRouter = router ? (router as Edge.RouterData) : null;
    this.originalVertices = edge.getVertices() as Array<{ x: number; y: number }>;
    this.editingRouter = !!this.originalRouter;
    this.moved = false;
    super.onHandleChange(args);
    if (this.editingRouter) {
      edge.setVertices(vertices, { silent: true });
    }
  }

  protected override onHandleChanging(args: {
    handle: InstanceType<typeof Registry.EdgeTool.presets.segments.Handle>;
    e: Dom.MouseMoveEvent;
  }): void {
    this.moved = true;
    super.onHandleChanging(args);
  }

  protected override onHandleChanged(args: {
    handle: InstanceType<typeof Registry.EdgeTool.presets.segments.Handle>;
    e: Dom.MouseUpEvent;
  }): void {
    if (this.editingRouter && !this.moved && this.originalRouter) {
      this.cellView.cell.setVertices(this.originalVertices, { silent: true });
      this.cellView.cell.setRouter(this.originalRouter, { silent: true });
    }
    this.editingRouter = false;
    super.onHandleChanged(args);
  }

  protected override onRemove(): void {
    if (this.editingRouter && this.originalRouter) {
      this.cellView.cell.setVertices(this.originalVertices);
      this.cellView.cell.setRouter(this.originalRouter);
      this.editingRouter = false;
    }
    super.onRemove();
  }
}

class CurveVertices extends Registry.EdgeTool.presets.vertices {
  protected override onHandleRemove(args: {
    handle: InstanceType<typeof Registry.EdgeTool.presets.vertices.Handle>;
    e: Dom.DoubleClickEvent;
  }): void {
    const edge = this.cellView.cell;
    const count = edge.getVertices().length;
    super.onHandleRemove(args);
    if (edge.getVertices().length !== count)
      void this.graph.trigger("edge:vertices:committed" as never, { edge } as never);
  }
}

export function registerRoutedSegments(): void {
  Graph.registerEdgeTool("flow-routed-segments", RoutedSegments, true);
  Graph.registerEdgeTool("flow-curve-vertices", CurveVertices, true);
}
