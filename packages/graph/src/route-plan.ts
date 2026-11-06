import type { EdgePoint } from "./edge-geometry";
import {
  findShortPortRoute,
  routeWithPortStubs,
  PORT_VECTORS,
  type PortSide,
  type RoutingObstacle,
  type RoutingSearchEvidence,
} from "./orthogonal-routing";
export interface RouteEndpoint {
  nodeId: string;
  portId?: string;
  point: EdgePoint;
  side: PortSide;
}
export interface GeometrySnapshot {
  readonly revision: number;
  readonly obstacles: readonly RoutingObstacle[];
  readonly nodeIds: ReadonlyMap<RoutingObstacle, string>;
}
export type RoutePolicy =
  | "explicit"
  | "move-geometry"
  | "move-current"
  | "drop-source-priority"
  | "render"
  | "legacy-corridor";
export interface RouteRequest {
  source: RouteEndpoint;
  target: RouteEndpoint;
  mode: "orthogonal" | "curve";
  vertices: readonly EdgePoint[];
  policy: RoutePolicy;
  budget?: { laneLimit?: number; expansionLimit?: number };
}
export interface RoutePlan {
  status: "valid" | "blocked-within-policy" | "budget-exhausted" | "legacy-degraded";
  strictStatus?: "blocked-within-policy" | "budget-exhausted";
  diagnostic?: boolean;
  revision: number;
  source: RouteEndpoint;
  target: RouteEndpoint;
  points: EdgePoint[];
  kind: "polyline" | "bezier" | "rounded-corridor";
  controls?: [EdgePoint, EdgePoint];
  trace?: EdgePoint[];
  path?: string;
  cost: number;
  bends: number;
  blockerIds: readonly string[];
  blockingCosts: Map<RoutingObstacle, number>;
  search: RoutingSearchEvidence;
}
const pathCost = (points: readonly EdgePoint[]) =>
  points.slice(1).reduce((sum, p, i) => {
    const a = points[i];
    return sum + (a ? Math.abs(a.x - p.x) + Math.abs(a.y - p.y) : 0);
  }, 0) +
  Math.max(0, points.length - 2) * 12;
export function lineIntersectsRect(a: EdgePoint, b: EdgePoint, r: RoutingObstacle): boolean {
  let low = 0;
  let high = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.x + 0.1, r.x + r.width - 0.1],
    [a.y, b.y - a.y, r.y + 0.1, r.y + r.height - 0.1],
  ]) {
    if (start === undefined || delta === undefined || min === undefined || max === undefined)
      continue;
    if (Math.abs(delta) < 0.0001) {
      if (start <= min || start >= max) return false;
    } else {
      const t1 = (min - start) / delta;
      const t2 = (max - start) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (low > high) return false;
    }
  }
  return low <= high;
}
/** Exact parameter-interval test for a quadratic crossing the interior of a rectangle. */
function quadraticHitsBox(
  a: EdgePoint,
  control: EdgePoint,
  b: EdgePoint,
  box: RoutingObstacle,
): boolean {
  const minX = box.x + 0.01,
    maxX = box.x + box.width - 0.01,
    minY = box.y + 0.01,
    maxY = box.y + box.height - 0.01;
  if (
    Math.max(a.x, control.x, b.x) <= minX ||
    Math.min(a.x, control.x, b.x) >= maxX ||
    Math.max(a.y, control.y, b.y) <= minY ||
    Math.min(a.y, control.y, b.y) >= maxY
  )
    return false;
  const cuts = [0, 1];
  const roots = (start: number, middle: number, end: number, boundary: number) => {
    const aa = start - 2 * middle + end,
      bb = 2 * (middle - start),
      cc = start - boundary;
    if (Math.abs(aa) < 1e-10) {
      if (Math.abs(bb) > 1e-10) {
        const t = -cc / bb;
        if (t > 0 && t < 1) cuts.push(t);
      }
      return;
    }
    const discriminant = bb * bb - 4 * aa * cc;
    if (discriminant < 0) return;
    for (const t of [
      (-bb - Math.sqrt(discriminant)) / (2 * aa),
      (-bb + Math.sqrt(discriminant)) / (2 * aa),
    ])
      if (t > 0 && t < 1) cuts.push(t);
  };
  for (const boundary of [minX, maxX]) roots(a.x, control.x, b.x, boundary);
  for (const boundary of [minY, maxY]) roots(a.y, control.y, b.y, boundary);
  cuts.sort((x, y) => x - y);
  for (let i = 1; i < cuts.length; i++) {
    const left = cuts[i - 1],
      right = cuts[i];
    if (left === undefined || right === undefined) continue;
    const t = (left + right) / 2,
      u = 1 - t,
      x = u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y = u * u * a.y + 2 * u * t * control.y + t * t * b.y;
    if (x > minX && x < maxX && y > minY && y < maxY) return true;
  }
  return false;
}
export function roundedPath(
  points: EdgePoint[],
  radius = 8,
  obstacles: readonly RoutingObstacle[] = [],
): string {
  const first = points[0];
  if (!first) return "";
  let result = `M ${String(first.x)} ${String(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const p = points[i];
    const next = points[i + 1];
    if (!prev || !p || !next) continue;
    const before = Math.hypot(p.x - prev.x, p.y - prev.y);
    const after = Math.hypot(next.x - p.x, next.y - p.y);
    let r = Math.min(radius, before / 2, after / 2);
    const corner = (amount: number) => ({
      enter: {
        x: p.x + ((prev.x - p.x) * amount) / before,
        y: p.y + ((prev.y - p.y) * amount) / before,
      },
      exit: {
        x: p.x + ((next.x - p.x) * amount) / after,
        y: p.y + ((next.y - p.y) * amount) / after,
      },
    });
    let arc = corner(r);
    while (r >= 0.5 && obstacles.some((box) => quadraticHitsBox(arc.enter, p, arc.exit, box))) {
      r /= 2;
      arc = corner(r);
    }
    if (r < 0.5 && obstacles.some((box) => quadraticHitsBox(arc.enter, p, arc.exit, box))) r = 0;
    if (r < 0.01) {
      result += ` L ${String(p.x)} ${String(p.y)}`;
      continue;
    }
    const { enter, exit } = arc;
    result += ` L ${String(enter.x)} ${String(enter.y)} Q ${String(p.x)} ${String(p.y)} ${String(exit.x)} ${String(exit.y)}`;
  }
  const last = points[points.length - 1];
  if (!last) return result;
  return `${result} L ${String(last.x)} ${String(last.y)}`;
}
/** Existing candidate generation and scoring, with explicit outcomes and final port identity. */
export function planRoute(scene: GeometrySnapshot, request: RouteRequest): RoutePlan {
  const { source, target, vertices } = request,
    boxes = scene.obstacles;
  const stats: RoutingSearchEvidence = {
    candidates: 0,
    obstacleChecks: 0,
    bestCost: Infinity,
    blockingCosts: new Map(),
    ...request.budget,
  };
  let points: EdgePoint[] | null = null,
    kind: RoutePlan["kind"] = "polyline",
    controls: RoutePlan["controls"],
    trace: EdgePoint[] | undefined;
  if (request.mode === "curve") {
    const distance = Math.hypot(target.point.x - source.point.x, target.point.y - source.point.y),
      offset = Math.max(40, Math.min(distance * 0.4, 150));
    const sv = PORT_VECTORS[source.side],
      tv = PORT_VECTORS[target.side];
    const c1 = { x: source.point.x + sv.x * offset, y: source.point.y + sv.y * offset },
      c2 = { x: target.point.x + tv.x * offset, y: target.point.y + tv.y * offset };
    const hull = {
      x: Math.min(source.point.x, target.point.x, c1.x, c2.x),
      y: Math.min(source.point.y, target.point.y, c1.y, c2.y),
      width:
        Math.max(source.point.x, target.point.x, c1.x, c2.x) -
        Math.min(source.point.x, target.point.x, c1.x, c2.x),
      height:
        Math.max(source.point.y, target.point.y, c1.y, c2.y) -
        Math.min(source.point.y, target.point.y, c1.y, c2.y),
    };
    const intersects = (a: RoutingObstacle, b: RoutingObstacle) =>
      a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y;
    const candidates = boxes.filter((box) => intersects(hull, box));
    const directCost =
      Math.abs(source.point.x - target.point.x) + Math.abs(source.point.y - target.point.y);
    const curveBlocked = (a: EdgePoint, b: EdgePoint) =>
      candidates.some((box) => {
        const hit = lineIntersectsRect(a, b, box);
        if (hit)
          stats.blockingCosts?.set(
            box,
            Math.min(stats.blockingCosts.get(box) ?? Infinity, directCost),
          );
        return hit;
      });
    const samples = Math.max(24, Math.ceil((distance + offset * 2) / 2));
    let blocked = vertices.length > 0,
      previous = source.point;
    trace = [source.point];
    for (let i = 1; i < samples && !blocked; i++) {
      const t = i / samples,
        u = 1 - t,
        point = {
          x:
            u * u * u * source.point.x +
            3 * u * u * t * c1.x +
            3 * u * t * t * c2.x +
            t * t * t * target.point.x,
          y:
            u * u * u * source.point.y +
            3 * u * u * t * c1.y +
            3 * u * t * t * c2.y +
            t * t * t * target.point.y,
        };
      blocked = curveBlocked(previous, point);
      previous = point;
      if (i % 8 === 0) trace.push(point);
    }
    if (!blocked) blocked = curveBlocked(previous, target.point);
    if (!blocked) {
      points = [source.point, target.point];
      kind = "bezier";
      controls = [c1, c2];
      trace.push(target.point);
    } else {
      points = routeWithPortStubs(
        source.point,
        target.point,
        source.side,
        target.side,
        boxes,
        vertices,
        stats,
      );
      kind = "rounded-corridor";
    }
  } else if (request.policy === "legacy-corridor")
    points = routeWithPortStubs(
      source.point,
      target.point,
      source.side,
      target.side,
      boxes,
      vertices,
      stats,
    );
  else
    points = findShortPortRoute(
      source.point,
      target.point,
      source.side,
      target.side,
      boxes,
      vertices,
      stats,
    );
  const status = points
    ? "valid"
    : stats.laneCandidatesTruncated ||
        stats.obstacleCandidatesTruncated ||
        stats.expansionBudgetExhausted
      ? "budget-exhausted"
      : "blocked-within-policy";
  const blockingCosts = stats.blockingCosts ?? new Map<RoutingObstacle, number>();
  return {
    status,
    revision: scene.revision,
    source: { ...source, point: { ...source.point } },
    target: { ...target, point: { ...target.point } },
    points: points ?? [],
    kind,
    ...(controls ? { controls } : {}),
    ...(trace ? { trace } : {}),
    ...(points && kind === "rounded-corridor" ? { path: roundedPath(points, 8, boxes) } : {}),
    cost: points ? pathCost(points) : Infinity,
    bends: points ? Math.max(0, points.length - 2) : 0,
    blockerIds: [...blockingCosts]
      .filter(([, cost]) => cost <= (stats.bestCost ?? Infinity))
      .map(([box]) => scene.nodeIds.get(box))
      .filter((id): id is string => id !== undefined),
    blockingCosts,
    search: stats,
  };
}

/** Selection consumes only semantically admitted, ordered candidates. No X6 mutation occurs. */
export function selectRoutePlan(
  candidates: Iterable<{ plan: RoutePlan; sourcePriority: number }>,
  policy: "ordered-first-valid" | "source-priority-cost",
): RoutePlan | null {
  let best: { plan: RoutePlan; sourcePriority: number } | null = null;
  for (const candidate of candidates) {
    if (candidate.plan.status !== "valid") continue;
    if (policy === "ordered-first-valid") return candidate.plan;
    if (
      !best ||
      candidate.sourcePriority < best.sourcePriority ||
      (candidate.sourcePriority === best.sourcePriority && candidate.plan.cost < best.plan.cost)
    )
      best = candidate;
  }
  return best?.plan ?? null;
}

/** Compatibility rendering retains the strict failure; it is never admissible as a new edit. */
export function legacyRoutePlan(
  strict: RoutePlan,
  points: readonly EdgePoint[],
  diagnostic: boolean,
): RoutePlan {
  const strictStatus =
    strict.status === "budget-exhausted" ? "budget-exhausted" : "blocked-within-policy";
  return {
    ...strict,
    status: "legacy-degraded",
    strictStatus,
    diagnostic,
    points: points.map((point) => ({ ...point })),
    cost: pathCost(points),
    bends: Math.max(0, points.length - 2),
  };
}
