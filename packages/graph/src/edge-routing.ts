import { GeometryScene } from "./geometry-scene";
import { roundedPath, legacyRoutePlan, type RoutePlan, type RoutePolicy } from "./route-plan";
import { Graph, Registry, type Edge, type EdgeView, type Node } from "@antv/x6";
import { installAdaptiveTargetMarkers, queueAdaptiveTargetMarker } from "./adaptive-marker";
import type { EdgePoint } from "./edge-geometry";
import {
  createRouteFootprint,
  routeAffectedByNode,
  type RouteFootprint,
} from "./route-invalidation";
import { PORT_VECTORS, type PortSide, type RoutingObstacle } from "./orthogonal-routing";

interface ObstacleCache {
  scene: GeometryScene;
  boxes: ReadonlyMap<string, RoutingObstacle>;
  routes: Map<string, RouteFootprint>;
  pending: Set<string>;
  blockers: Map<string, Set<string>>;
}
const obstacleCaches = new WeakMap<Graph, ObstacleCache>();

export function installEdgeRouting(graph: Graph): () => void {
  const scene = new GeometryScene();
  const cache: ObstacleCache = {
    scene,
    boxes: scene.boxes,
    routes: new Map(),
    pending: new Set(),
    blockers: new Map(),
  };
  obstacleCaches.set(graph, cache);
  const disposeMarkers = installAdaptiveTargetMarkers(graph);
  const diagnosticStyle = document.createElement("style");
  diagnosticStyle.textContent =
    '[data-routing-diagnostic="true"]{stroke:#d92d20!important;stroke-dasharray:6 4!important;}';
  graph.container.append(diagnosticStyle);
  let frame: number | null = null;
  const dirty = cache.pending;
  const update = ({ node }: { node: Node }) => {
    const old = cache.boxes.get(node.id);
    const box = node.getBBox();
    const next = { x: box.x, y: box.y, width: box.width, height: box.height };
    scene.update(node.id, next);
    for (const [id, route] of cache.routes) {
      if (node.id === route.sourceId || node.id === route.targetId) dirty.delete(id);
      else if (
        cache.blockers.get(id)?.has(node.id) ||
        routeAffectedByNode(route, node.id, next, old)
      )
        dirty.add(id);
    }
    if (dirty.size && frame === null)
      frame = requestAnimationFrame(() => {
        frame = null;
        const ids = [...dirty];
        dirty.clear();
        for (const id of ids) {
          const edge = graph.getCellById(id);
          const view = graph.findViewByCell(edge);
          if (view?.isEdgeView()) view.update();
        }
      });
  };
  for (const node of graph.getNodes()) update({ node });
  const remove = ({ node }: { node: Node }) => {
    update({ node });
    scene.remove(node.id);
  };
  const removeEdge = ({ edge }: { edge: { id: string } }) => {
    cache.routes.delete(edge.id);
    scene.forgetEdge(edge.id);
    cache.blockers.delete(edge.id);
  };
  graph.on("node:added", update);
  graph.on("node:change:position", update);
  graph.on("node:change:size", update);
  const portsChanged = ({ node }: { node: Node }) => {
    scene.invalidate();
    update({ node });
  };
  graph.on("node:change:ports", portsChanged);
  graph.on("node:removed", remove);
  graph.on("edge:removed", removeEdge);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    graph.off("node:added", update);
    graph.off("node:change:position", update);
    graph.off("node:change:size", update);
    graph.off("node:change:ports", portsChanged);
    scene.dispose();
    graph.off("node:removed", remove);
    graph.off("edge:removed", removeEdge);
    const degraded = degradedBatches.get(graph);
    if (degraded) cancelAnimationFrame(degraded.frame);
    degradedBatches.delete(graph);
    disposeMarkers();
    diagnosticStyle.remove();
    obstacleCaches.delete(graph);
    dirty.clear();
  };
}
export function geometrySceneFor(graph: Graph): GeometryScene {
  const cache = obstacleCaches.get(graph);
  if (cache) return cache.scene;
  // Standalone native graph use has no persistent lifecycle/cache owner.
  const scene = new GeometryScene();
  for (const node of graph.getNodes()) {
    const b = node.getBBox();
    scene.update(node.id, { x: b.x, y: b.y, width: b.width, height: b.height });
  }
  return scene;
}
function planForView(
  view: EdgeView,
  source: EdgePoint,
  target: EdgePoint,
  sourceSide: PortSide,
  targetSide: PortSide,
  vertices: readonly EdgePoint[],
  mode: "orthogonal" | "curve",
  policy: RoutePolicy = "render",
): RoutePlan {
  return geometrySceneFor(view.graph).plan({
    source: {
      nodeId: view.cell.getSourceCellId(),
      portId: view.cell.getSourcePortId(),
      point: { x: source.x, y: source.y },
      side: sourceSide,
    },
    target: {
      nodeId: view.cell.getTargetCellId(),
      portId: view.cell.getTargetPortId(),
      point: { x: target.x, y: target.y },
      side: targetSide,
    },
    vertices,
    mode,
    policy,
  });
}

function rememberRoute(
  view: EdgeView,
  points: EdgePoint[],
  blockingCosts?: Map<RoutingObstacle, number>,
  routeCost = Infinity,
  plan?: RoutePlan,
): void {
  if (plan) {
    geometrySceneFor(view.graph).recordRendered(view.cell.id, plan);
    view.container.setAttribute("data-routing-plan-status", plan.status);
    if (plan.strictStatus)
      view.container.setAttribute("data-routing-policy-failure", plan.strictStatus);
    else view.container.removeAttribute("data-routing-policy-failure");
  }
  const cache = obstacleCaches.get(view.graph);
  if (cache) {
    // A native update may already have rendered this edge after obstacle invalidation.
    cache.pending.delete(view.cell.id);
    if (blockingCosts)
      cache.blockers.set(
        view.cell.id,
        new Set(
          [...cache.boxes]
            .filter(
              ([, box]) =>
                (blockingCosts.get(box) ?? Infinity) <= routeCost && blockingCosts.has(box),
            )
            .map(([id]) => id),
        ),
      );
    cache.routes.set(
      view.cell.id,
      createRouteFootprint(points, view.cell.getSourceCellId(), view.cell.getTargetCellId()),
    );
  }
  queueAdaptiveTargetMarker(view);
  void view.graph.trigger("edge:geometry:changed" as never, { edge: view.cell } as never);
}

const persistedRoutingEdges = new WeakSet<Edge>();
export function markRoutingPersisted(edge: Edge): void {
  persistedRoutingEdges.add(edge);
}
const failedRoutes = new WeakSet<EdgeView>();
const reportedFailures = new WeakSet<EdgeView>();
const degradedViews = new WeakSet<EdgeView>();
const degradedBatches = new WeakMap<Graph, { ids: Set<string>; frame: number }>();
function routingDegraded(view: EdgeView): void {
  if (!persistedRoutingEdges.has(view.cell)) return;
  if (degradedViews.has(view)) return;
  degradedViews.add(view);
  view.container.setAttribute("data-routing-warning", "legacy-route");
  const existing = degradedBatches.get(view.graph);
  if (existing) {
    existing.ids.add(view.cell.id);
    return;
  }
  const batch = { ids: new Set([view.cell.id]), frame: 0 };
  batch.frame = requestAnimationFrame(() => {
    degradedBatches.delete(view.graph);
    void view.graph.trigger(
      "edge:routing:degraded" as never,
      { edgeIds: [...batch.ids], reason: "workbench.connection.legacyRouteWarning" } as never,
    );
  });
  degradedBatches.set(view.graph, batch);
}
function clearDegraded(view: EdgeView): void {
  degradedViews.delete(view);
  view.container.removeAttribute("data-routing-warning");
  const batch = degradedBatches.get(view.graph);
  batch?.ids.delete(view.cell.id);
  if (batch && batch.ids.size === 0) {
    cancelAnimationFrame(batch.frame);
    degradedBatches.delete(view.graph);
  }
}
function routingFailure(view: EdgeView): void {
  if (!reportedFailures.has(view)) {
    reportedFailures.add(view);
    void view.graph.trigger(
      "edge:routing:failed" as never,
      { edgeId: view.cell.id, reason: "routing-budget-or-blocked-anchor" } as never,
    );
  }
  failedRoutes.add(view);
  view.findOne("line")?.setAttribute("data-routing-diagnostic", "true");
  routingDegraded(view);
  view.container.setAttribute("data-routing-error", "routing-budget-or-blocked-anchor");
}
function routingRecovered(view: EdgeView): void {
  failedRoutes.delete(view);
  view.findOne("line")?.removeAttribute("data-routing-diagnostic");
  view.container.removeAttribute("data-routing-error");
}

const side = (value: unknown, fallback: PortSide): PortSide =>
  typeof value === "string" && value in PORT_VECTORS ? (value as PortSide) : fallback;

/** Never use X6's unconstrained orth fallback when its Manhattan search exhausts its budget. */
export function strictOrthogonalFallback(
  this: EdgeView,
  vertices: EdgePoint[],
  options: { startDirections?: string[]; endDirections?: string[] },
  view: EdgeView,
): EdgePoint[] {
  const source = view.sourceAnchor;
  const target = view.targetAnchor;
  const sourceSide = side(options.startDirections?.[0], target.x >= source.x ? "right" : "left");
  const targetSide = side(options.endDirections?.[0], target.x >= source.x ? "left" : "right");
  const plan = planForView(
    view,
    source,
    target,
    sourceSide,
    targetSide,
    vertices,
    "orthogonal",
    "legacy-corridor",
  );
  const route = plan.status === "valid" ? plan.points : null;
  if (!route) {
    routingFailure(view);
    return [];
  }
  return route.slice(1, -1);
}

export function registerPortCurveConnector(): void {
  Graph.registerRouter(
    "flow-orthogonal",
    function (vertices, options, view) {
      routingRecovered(view);
      const directions = options as { startDirections?: string[]; endDirections?: string[] };
      const sourceSide = side(directions.startDirections?.[0], "right");
      const targetSide = side(directions.endDirections?.[0], "left");
      const plan = planForView(
        view,
        view.sourceAnchor,
        view.targetAnchor,
        sourceSide,
        targetSide,
        vertices,
        "orthogonal",
      );
      const short = plan.status === "valid" ? plan.points : null;
      // Loaded documents retain their legal longer routes; interaction admission is stricter.
      const route = short
        ? short.slice(1, -1)
        : Registry.Router.presets.manhattan.call(this, vertices, options, view);
      if (!short) routingDegraded(view);
      else clearDegraded(view);
      if (!failedRoutes.has(view)) reportedFailures.delete(view);
      rememberRoute(
        view,
        [view.sourceAnchor, ...route, view.targetAnchor],
        plan.blockingCosts,
        plan.search.bestCost,
        short
          ? plan
          : legacyRoutePlan(
              plan,
              [view.sourceAnchor, ...route, view.targetAnchor],
              failedRoutes.has(view),
            ),
      );
      return route;
    },
    true,
  );
  Graph.registerConnector(
    "flow-normal",
    function (source, target, route, options) {
      if (failedRoutes.has(this))
        return `M ${String(source.x)} ${String(source.y)} L ${String(target.x)} ${String(target.y)}`;
      return Registry.Connector.presets.normal.call(this, source, target, route, options, this);
    },
    true,
  );
  Graph.registerConnector(
    "port-curve",
    function (
      source,
      target,
      routePoints,
      options: { raw?: boolean; sourceDir?: string; targetDir?: string },
    ) {
      const sourceSide = side(options.sourceDir, target.x >= source.x ? "right" : "left");
      const targetSide = side(options.targetDir, target.x >= source.x ? "left" : "right");
      const plan = planForView(this, source, target, sourceSide, targetSide, routePoints, "curve");
      if (plan.status === "valid" && plan.kind === "bezier" && plan.controls) {
        routingRecovered(this);
        clearDegraded(this);
        reportedFailures.delete(this);
        rememberRoute(this, plan.trace ?? plan.points, plan.blockingCosts, plan.cost, plan);
        const [c1, c2] = plan.controls;
        return `M ${String(source.x)} ${String(source.y)} C ${String(c1.x)} ${String(c1.y)} ${String(c2.x)} ${String(c2.y)} ${String(target.x)} ${String(target.y)}`;
      }
      const route = plan.status === "valid" ? plan.points : null;
      rememberRoute(
        this,
        route ?? [source, target],
        plan.blockingCosts,
        plan.cost,
        route ? plan : legacyRoutePlan(plan, [source, target], true),
      );
      if (!route) {
        routingFailure(this);
        return `M ${String(source.x)} ${String(source.y)} L ${String(target.x)} ${String(target.y)}`;
      }
      routingRecovered(this);
      clearDegraded(this);
      reportedFailures.delete(this);
      return plan.path ?? roundedPath(route, 8, geometrySceneFor(this.graph).snapshot().obstacles);
    },
    true,
  );
}

/** Narrow admission checks to routes whose actual footprint the obstacle can affect. */
export function routingAffectedEdges(
  graph: Graph,
  node: Node,
  previous: { x: number; y: number },
): string[] {
  const cache = obstacleCaches.get(graph);
  if (!cache) return graph.getConnectedEdges(node).map((edge) => edge.id);
  const box = node.getBBox();
  const next = { x: box.x, y: box.y, width: box.width, height: box.height };
  const old = { ...next, x: previous.x, y: previous.y };
  return [...cache.routes]
    .filter(
      ([, route]) =>
        route.sourceId === node.id ||
        route.targetId === node.id ||
        routeAffectedByNode(route, node.id, next, old),
    )
    .map(([id]) => id);
}
