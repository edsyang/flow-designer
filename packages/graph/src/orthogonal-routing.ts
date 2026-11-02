import type { EdgePoint } from './edge-geometry';

export interface RoutingObstacle { x: number; y: number; width: number; height: number }
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export const PORT_VECTORS: Record<PortSide, EdgePoint> = {
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 },
};
const EPS = 0.01;
const distance = (a: EdgePoint, b: EdgePoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function segmentHitsObstacle(a: EdgePoint, b: EdgePoint, rect: RoutingObstacle): boolean {
  if (Math.abs(a.y - b.y) < EPS) return a.y > rect.y + EPS && a.y < rect.y + rect.height - EPS
    && Math.max(a.x, b.x) > rect.x + EPS && Math.min(a.x, b.x) < rect.x + rect.width - EPS;
  if (Math.abs(a.x - b.x) < EPS) return a.x > rect.x + EPS && a.x < rect.x + rect.width - EPS
    && Math.max(a.y, b.y) > rect.y + EPS && Math.min(a.y, b.y) < rect.y + rect.height - EPS;
  return true;
}
function simplify(points: EdgePoint[]): EdgePoint[] {
  const result: EdgePoint[] = [];
  for (const point of points) {
    if (result.length && distance(result[result.length - 1]!, point) < EPS) continue;
    result.push({ ...point });
    while (result.length > 2) {
      const [a, b, c] = result.slice(-3) as [EdgePoint, EdgePoint, EdgePoint];
      if (((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS)
        || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS)) && distance(a, b) + distance(b, c) <= distance(a, c) + EPS) result.splice(-2, 1);
      else break;
    }
  }
  return result;
}
function cost(points: EdgePoint[]): number {
  return points.slice(1).reduce((total, point, i) => total + distance(points[i]!, point), 0) + Math.max(0, points.length - 2) * 12;
}

/** Exact-axis obstacle fallback. Direct paths avoid searching; the visibility-grid search is bounded. */
export function findOrthogonalPath(a: EdgePoint, b: EdgePoint, obstacles: readonly RoutingObstacle[]): EdgePoint[] | null {
  const clear = (from: EdgePoint, to: EdgePoint) => !obstacles.some(rect => segmentHitsObstacle(from, to, rect));
  const valid = (points: EdgePoint[]) => points.slice(1).every((point, i) => clear(points[i]!, point));
  const direct = [a, b];
  if ((a.x === b.x || a.y === b.y) && valid(direct)) return simplify(direct);
  const elbows = [[a, { x: b.x, y: a.y }, b], [a, { x: a.x, y: b.y }, b]].filter(valid);
  if (elbows.length) return simplify(elbows.sort((x, y) => cost(x) - cost(y))[0]!);

  const lanes: EdgePoint[][] = [];
  for (const r of obstacles) {
    for (const x of [r.x, r.x + r.width]) lanes.push([a, { x, y: a.y }, { x, y: b.y }, b]);
    for (const y of [r.y, r.y + r.height]) lanes.push([a, { x: a.x, y }, { x: b.x, y }, b]);
  }
  const escape = lanes.map(simplify).filter(valid).sort((x, y) => cost(x) - cost(y))[0];
  if (escape) return escape;

  // Include every obstacle boundary in the local corridor, plus global outer lanes.
  // For very dense scenes a bounded subset controls worst-case search work; every
  // candidate segment is still checked against ALL obstacles, so omission never
  // permits a path through a node.
  const left = Math.min(a.x, b.x) - 96; const right = Math.max(a.x, b.x) + 96;
  const top = Math.min(a.y, b.y) - 96; const bottom = Math.max(a.y, b.y) + 96;
  const relevant = obstacles.filter(r => r.x < right && r.x + r.width > left && r.y < bottom && r.y + r.height > top)
    .sort((x, y) => distance(a, x) + distance(b, x) - distance(a, y) - distance(b, y)).slice(0, 48);
  const xs = new Set([a.x, b.x]); const ys = new Set([a.y, b.y]);
  for (const r of relevant) { xs.add(r.x); xs.add(r.x + r.width); ys.add(r.y); ys.add(r.y + r.height); }
  if (obstacles.length) {
    xs.add(Math.min(...obstacles.map(r => r.x)) - 16); xs.add(Math.max(...obstacles.map(r => r.x + r.width)) + 16);
    ys.add(Math.min(...obstacles.map(r => r.y)) - 16); ys.add(Math.max(...obstacles.map(r => r.y + r.height)) + 16);
  }
  const x = [...xs].sort((a, b) => a - b); const y = [...ys].sort((a, b) => a - b);
  const width = x.length; const start = y.indexOf(a.y) * width + x.indexOf(a.x); const end = y.indexOf(b.y) * width + x.indexOf(b.x);
  const point = (id: number): EdgePoint => ({ x: x[id % width]!, y: y[Math.floor(id / width)]! });
  type Entry = { id: number; axis: number; score: number; estimate: number; parent: Entry | null };
  const heap: Entry[] = [];
  const push = (entry: Entry) => { heap.push(entry); let i = heap.length - 1; while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent]!.estimate <= entry.estimate) break; heap[i] = heap[parent]!; i = parent; } heap[i] = entry; };
  const pop = (): Entry => { const first = heap[0]!; const last = heap.pop()!; if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1]!.estimate < heap[child]!.estimate) child++; if (heap[child]!.estimate >= last.estimate) break; heap[i] = heap[child]!; i = child; } heap[i] = last; } return first; };
  const scores = new Map<number, number>();
  push({ id: start, axis: 0, score: 0, estimate: distance(a, b), parent: null });
  let budget = 16000;
  while (heap.length && budget-- > 0) {
    const current = pop(); const key = current.id * 3 + current.axis;
    if (current.score > (scores.get(key) ?? Infinity)) continue;
    if (current.id === end) { const result: EdgePoint[] = []; let entry: Entry | null = current; while (entry) { result.push(point(entry.id)); entry = entry.parent; } return simplify(result.reverse()); }
    const col = current.id % width; const row = Math.floor(current.id / width); const from = point(current.id);
    for (const [next, axis] of [[col > 0 ? current.id - 1 : -1, 1], [col + 1 < width ? current.id + 1 : -1, 1], [row > 0 ? current.id - width : -1, 2], [row + 1 < y.length ? current.id + width : -1, 2]]) {
      if (next === undefined || axis === undefined || next < 0) continue;
      const to = point(next); if (!clear(from, to)) continue;
      const score = current.score + distance(from, to) + (current.axis && current.axis !== axis ? 12 : 0);
      const nextKey = next * 3 + axis;
      if (score >= (scores.get(nextKey) ?? Infinity)) continue;
      scores.set(nextKey, score); push({ id: next, axis, score, estimate: score + distance(to, b), parent: current });
    }
  }
  return null;
}

export function routeWithPortStubs(source: EdgePoint, target: EdgePoint, sourceSide: PortSide, targetSide: PortSide,
  obstacles: readonly RoutingObstacle[], vertices: readonly EdgePoint[] = []): EdgePoint[] | null {
  const stub = (point: EdgePoint, side: PortSide) => {
    const v = PORT_VECTORS[side]; let length = 24;
    for (const r of obstacles) {
      // Terminal bodies contain the anchor; only external obstacles shorten its escape.
      if (point.x >= r.x - EPS && point.x <= r.x + r.width + EPS && point.y >= r.y - EPS && point.y <= r.y + r.height + EPS) continue;
      const transverse = v.x ? point.y > r.y && point.y < r.y + r.height : point.x > r.x && point.x < r.x + r.width;
      if (!transverse) continue;
      const hit = v.x > 0 ? r.x - point.x : v.x < 0 ? point.x - r.x - r.width : v.y > 0 ? r.y - point.y : point.y - r.y - r.height;
      if (hit > 0) length = Math.min(length, Math.max(0.5, hit / 2));
    }
    return { x: point.x + v.x * length, y: point.y + v.y * length };
  };
  const start = stub(source, sourceSide); const end = stub(target, targetSide);
  const waypoints = [start, ...vertices.filter(p => !obstacles.some(r => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height)), end];
  const result = [source];
  for (let i = 1; i < waypoints.length; i++) {
    const route = findOrthogonalPath(waypoints[i - 1]!, waypoints[i]!, obstacles);
    if (!route) return null;
    result.push(...route.slice(i === 1 ? 0 : 1));
  }
  result.push(target);
  const route = simplify(result);
  const first = route[1]!; const last = route[route.length - 2]!;
  const sv = PORT_VECTORS[sourceSide]; const tv = PORT_VECTORS[targetSide];
  if ((first.x - source.x) * sv.x + (first.y - source.y) * sv.y <= 0
    || (last.x - target.x) * tv.x + (last.y - target.y) * tv.y <= 0) return null;
  const externalTo = (point: EdgePoint) => obstacles.filter(r => !(point.x >= r.x - EPS && point.x <= r.x + r.width + EPS && point.y >= r.y - EPS && point.y <= r.y + r.height + EPS));
  if (externalTo(source).some(r => segmentHitsObstacle(source, first, r)) || externalTo(target).some(r => segmentHitsObstacle(last, target, r))) return null;
  return route;
}
