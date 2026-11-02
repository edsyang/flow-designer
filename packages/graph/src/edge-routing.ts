import { Graph, Registry, type EdgeView, type Node } from '@antv/x6';
import type { EdgePoint } from './edge-geometry';
import { createRouteFootprint, routeAffectedByNode, type RouteFootprint } from './route-invalidation';
import { PORT_VECTORS, routeWithPortStubs, type PortSide, type RoutingObstacle } from './orthogonal-routing';

interface ObstacleCache {
  boxes: Map<string, RoutingObstacle>;
  snapshot: RoutingObstacle[] | null;
  routes: Map<string, RouteFootprint>;
  pending: Set<string>;
}
const obstacleCaches = new WeakMap<Graph, ObstacleCache>();
const intersects = (a: RoutingObstacle, b: RoutingObstacle) => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
export function installEdgeRouting(graph: Graph): () => void {
  const cache: ObstacleCache = { boxes: new Map(), snapshot: null, routes: new Map(), pending: new Set() };
  obstacleCaches.set(graph, cache);
  let frame: number | null = null;
  const dirty = cache.pending;
  const update = ({ node }: { node: Node }) => {
    const old = cache.boxes.get(node.id);
    const box = node.getBBox(); const next = { x: box.x, y: box.y, width: box.width, height: box.height };
    cache.boxes.set(node.id, next); cache.snapshot = null;
    for (const [id, route] of cache.routes) {
      if (node.id === route.sourceId || node.id === route.targetId) dirty.delete(id);
      else if (routeAffectedByNode(route, node.id, next, old)) dirty.add(id);
    }
    if (dirty.size && frame === null) frame = requestAnimationFrame(() => {
      frame = null; const ids = [...dirty]; dirty.clear();
      for (const id of ids) { const edge = graph.getCellById(id); const view = graph.findViewByCell(edge); if (view?.isEdgeView()) view.update(); }
    });
  };
  for (const node of graph.getNodes()) update({ node });
  const remove = ({ node }: { node: Node }) => { update({ node }); cache.boxes.delete(node.id); cache.snapshot = null; };
  const removeEdge = ({ edge }: { edge: { id: string } }) => cache.routes.delete(edge.id);
  graph.on('node:added', update); graph.on('node:change:position', update); graph.on('node:change:size', update);
  graph.on('node:removed', remove); graph.on('edge:removed', removeEdge);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    graph.off('node:added', update); graph.off('node:change:position', update); graph.off('node:change:size', update);
    graph.off('node:removed', remove); graph.off('edge:removed', removeEdge);
    obstacleCaches.delete(graph); dirty.clear();
  };
}
function obstaclesFor(graph: Graph): RoutingObstacle[] {
  const cache = obstacleCaches.get(graph);
  if (!cache) return graph.getNodes().map(node => { const b = node.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  return cache.snapshot ?? (cache.snapshot = [...cache.boxes.values()]);
}
function rememberRoute(view: EdgeView, points: EdgePoint[]): void {
  const cache = obstacleCaches.get(view.graph);
  if (cache) {
    // A native update may already have rendered this edge after obstacle invalidation.
    cache.pending.delete(view.cell.id);
    cache.routes.set(view.cell.id, createRouteFootprint(points, view.cell.getSourceCellId(), view.cell.getTargetCellId()));
  }
  void view.graph.trigger('edge:geometry:changed' as never, { edge: view.cell } as never);
}

const failedRoutes = new WeakSet<EdgeView>();
const reportedFailures = new WeakSet<EdgeView>();
function routingFailure(view: EdgeView): void {
  if (!reportedFailures.has(view)) {
    reportedFailures.add(view);
    void view.graph.trigger('edge:routing:failed' as never, { edgeId: view.cell.id, reason: 'routing-budget-or-blocked-anchor' } as never);
  }
  failedRoutes.add(view); view.container.setAttribute('data-routing-error', 'routing-budget-or-blocked-anchor');
}
function routingRecovered(view: EdgeView): void { failedRoutes.delete(view); view.container.removeAttribute('data-routing-error'); }
function lineIntersectsRect(a: EdgePoint, b: EdgePoint, r: RoutingObstacle): boolean {
  let low = 0; let high = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.x + 0.1, r.x + r.width - 0.1], [a.y, b.y - a.y, r.y + 0.1, r.y + r.height - 0.1]]) {
    if (start === undefined || delta === undefined || min === undefined || max === undefined) continue;
    if (Math.abs(delta) < 0.0001) { if (start <= min || start >= max) return false; }
    else { const t1 = (min - start) / delta; const t2 = (max - start) / delta; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); if (low > high) return false; }
  }
  return low <= high;
}
const inflated = (boxes: RoutingObstacle[], padding = 12) => boxes.map(r => ({ x: r.x - padding, y: r.y - padding, width: r.width + padding * 2, height: r.height + padding * 2 }));
const side = (value: unknown, fallback: PortSide): PortSide => typeof value === 'string' && value in PORT_VECTORS ? value as PortSide : fallback;

/** Never use X6's unconstrained orth fallback when its Manhattan search exhausts its budget. */
export function strictOrthogonalFallback(this: EdgeView, vertices: EdgePoint[], options: { startDirections?: string[]; endDirections?: string[] }, view: EdgeView): EdgePoint[] {
  const source = view.sourceAnchor; const target = view.targetAnchor;
  const sourceSide = side(options.startDirections?.[0], target.x >= source.x ? 'right' : 'left');
  const targetSide = side(options.endDirections?.[0], target.x >= source.x ? 'left' : 'right');
  const route = routeWithPortStubs(source, target, sourceSide, targetSide, inflated(obstaclesFor(view.graph)), vertices);
  if (!route) { routingFailure(view); return []; }
  return route.slice(1, -1);
}

function roundedPath(points: EdgePoint[], radius = 8): string {
  const first = points[0];
  if (!first) return '';
  let result = `M ${String(first.x)} ${String(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]; const p = points[i]; const next = points[i + 1];
    if (!prev || !p || !next) continue;
    const before = Math.hypot(p.x - prev.x, p.y - prev.y); const after = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, before / 2, after / 2);
    if (r < 0.01) continue;
    const enter = { x: p.x + (prev.x - p.x) * r / before, y: p.y + (prev.y - p.y) * r / before };
    const exit = { x: p.x + (next.x - p.x) * r / after, y: p.y + (next.y - p.y) * r / after };
    result += ` L ${String(enter.x)} ${String(enter.y)} Q ${String(p.x)} ${String(p.y)} ${String(exit.x)} ${String(exit.y)}`;
  }
  const last = points[points.length - 1];
  if (!last) return result;
  return `${result} L ${String(last.x)} ${String(last.y)}`;
}

export function registerPortCurveConnector(): void {
  Graph.registerRouter('flow-orthogonal', function (vertices, options, view) {
    routingRecovered(view);
    const route = Registry.Router.presets.manhattan.call(this, vertices, options, view);
    if (!failedRoutes.has(view)) reportedFailures.delete(view);
    rememberRoute(view, [view.sourceAnchor, ...route, view.targetAnchor]);
    return route;
  }, true);
  Graph.registerConnector('flow-normal', function (source, target, route, options) {
    if (failedRoutes.has(this)) return `M ${String(source.x)} ${String(source.y)} M ${String(target.x)} ${String(target.y)}`;
    return Registry.Connector.presets.normal.call(this, source, target, route, options, this);
  }, true);
  Graph.registerConnector('port-curve', function (source, target, routePoints, options: { raw?: boolean; sourceDir?: string; targetDir?: string }) {
    const sourceSide = side(options.sourceDir, target.x >= source.x ? 'right' : 'left');
    const targetSide = side(options.targetDir, target.x >= source.x ? 'left' : 'right');
    const boxes = obstaclesFor(this.graph);
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    const offset = Math.max(40, Math.min(distance * 0.4, 150));
    const v1 = PORT_VECTORS[sourceSide]; const v2 = PORT_VECTORS[targetSide];
    const c1 = { x: source.x + v1.x * offset, y: source.y + v1.y * offset };
    const c2 = { x: target.x + v2.x * offset, y: target.y + v2.y * offset };
    // Retain the familiar direct Bezier when it clears nodes; route only complex links.
    const hull = { x: Math.min(source.x, target.x, c1.x, c2.x), y: Math.min(source.y, target.y, c1.y, c2.y), width: Math.max(source.x, target.x, c1.x, c2.x) - Math.min(source.x, target.x, c1.x, c2.x), height: Math.max(source.y, target.y, c1.y, c2.y) - Math.min(source.y, target.y, c1.y, c2.y) };
    const candidates = boxes.filter(box => intersects(hull, box));
    const samples = Math.max(24, Math.ceil((distance + offset * 2) / 2));
    let blocked = routePoints.length > 0;
    let previous = source;
    const trace = [source];
    for (let i = 1; i < samples && !blocked; i++) {
      const t = i / samples; const u = 1 - t;
      const x = u * u * u * source.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * target.x;
      const y = u * u * u * source.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * target.y;
      const point = { x, y };
      blocked = candidates.some(r => lineIntersectsRect(previous, point, r));
      previous = point;
      if (i % 8 === 0) trace.push(point);
    }
    if (!blocked) { routingRecovered(this); reportedFailures.delete(this); rememberRoute(this, [...trace, target]); return `M ${String(source.x)} ${String(source.y)} C ${String(c1.x)} ${String(c1.y)} ${String(c2.x)} ${String(c2.y)} ${String(target.x)} ${String(target.y)}`; }
    const route = routeWithPortStubs(source, target, sourceSide, targetSide, inflated(boxes), routePoints);
    rememberRoute(this, route ?? [source, c1, c2, target]);
    if (!route) { routingFailure(this); return `M ${String(source.x)} ${String(source.y)} M ${String(target.x)} ${String(target.y)}`; }
    routingRecovered(this); reportedFailures.delete(this);
    return roundedPath(route);
  }, true);
}
