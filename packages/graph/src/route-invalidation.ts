import type { EdgePoint } from './edge-geometry';
import type { RoutingObstacle } from './orthogonal-routing';

export interface RouteFootprint {
  sourceId: string;
  targetId: string;
  bounds: RoutingObstacle;
  segments: RoutingObstacle[];
}
function envelope(a: EdgePoint, b: EdgePoint, margin: number): RoutingObstacle {
  return { x: Math.min(a.x, b.x) - margin, y: Math.min(a.y, b.y) - margin,
    width: Math.abs(a.x - b.x) + margin * 2, height: Math.abs(a.y - b.y) + margin * 2 };
}
const intersects = (a: RoutingObstacle, b: RoutingObstacle) => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;

/** Segment envelopes keep the empty interior of long L-shaped routes out of invalidation. */
export function createRouteFootprint(points: readonly EdgePoint[], sourceId: string, targetId: string): RouteFootprint {
  const xs = points.map(p => p.x); const ys = points.map(p => p.y);
  const margin = 20;
  const segments: RoutingObstacle[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    if (a && b) segments.push(envelope(a, b, margin));
  }
  return { sourceId, targetId, bounds: envelope({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }, margin), segments };
}
export function routeAffectedByNode(route: RouteFootprint, nodeId: string, next: RoutingObstacle, previous?: RoutingObstacle): boolean {
  // X6 already updates terminal edges as part of its native node-position projection.
  if (nodeId === route.sourceId || nodeId === route.targetId) return false;
  const touches = (box: RoutingObstacle) => intersects(route.bounds, box) && route.segments.some(segment => intersects(segment, box));
  return touches(next) || (previous !== undefined && touches(previous));
}
