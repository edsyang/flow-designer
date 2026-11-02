import { describe, expect, it } from 'vitest';
import { findOrthogonalPath, routeWithPortStubs, segmentHitsObstacle, type RoutingObstacle } from '../src/orthogonal-routing';

describe('bounded obstacle routing', () => {
  const source = { x: 0, y: 60 }; const target = { x: 500, y: 60 };
  const boxes: RoutingObstacle[] = [
    { x: -80, y: 20, width: 80, height: 80 }, { x: 500, y: 20, width: 80, height: 80 },
    { x: 150, y: -20, width: 90, height: 160 }, { x: 300, y: 80, width: 90, height: 160 },
  ];
  it('uses the direct path without introducing detours when the corridor is empty', () => {
    expect(findOrthogonalPath(source, target, [])).toEqual([source, target]);
  });
  it('routes around staggered obstacles with strict port exit and entry', () => {
    const path = routeWithPortStubs(source, target, 'right', 'left', boxes)!;
    expect(path).not.toBeNull();
    expect(path[1]!.y).toBe(source.y); expect(path[1]!.x).toBeGreaterThan(source.x);
    expect(path[path.length - 2]!.y).toBe(target.y); expect(path[path.length - 2]!.x).toBeLessThan(target.x);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]!.x === path[i - 1]!.x || path[i]!.y === path[i - 1]!.y).toBe(true);
      for (const box of boxes) expect(segmentHitsObstacle(path[i - 1]!, path[i]!, box)).toBe(false);
    }
    const length = path.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - path[i]!.x) + Math.abs(p.y - path[i]!.y), 0);
    expect(length).toBeLessThan(850);
  });
  it('preserves feasible user waypoints while avoiding nodes', () => {
    const waypoint = { x: 270, y: -80 };
    const path = routeWithPortStubs(source, target, 'right', 'left', boxes, [waypoint])!;
    expect(path.slice(1).some((p, i) => p.y === waypoint.y && path[i]!.y === waypoint.y && waypoint.x >= Math.min(p.x, path[i]!.x) && waypoint.x <= Math.max(p.x, path[i]!.x))).toBe(true);
    expect(path[0]).toEqual(source); expect(path.at(-1)).toEqual(target);
  });
  it.each(['left', 'right', 'top', 'bottom'] as const)('keeps signed %s stubs when the target is behind the source', side => {
    const source = { x: 0, y: 0 }; const target = { x: -120, y: 80 };
    const path = routeWithPortStubs(source, target, side, side, [])!;
    const vectors = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
    const v = vectors[side];
    expect((path[1]!.x - source.x) * v.x + (path[1]!.y - source.y) * v.y).toBeGreaterThan(0);
    const last = path[path.length - 2]!;
    expect((last.x - target.x) * v.x + (last.y - target.y) * v.y).toBeGreaterThan(0);
  });
  it('shortens the escape stub before a nearby external obstacle', () => {
    const obstacles = [{ x: -40, y: -20, width: 40, height: 40 }, { x: 8, y: -10, width: 20, height: 20 }];
    const path = routeWithPortStubs({ x: 0, y: 0 }, { x: 100, y: 60 }, 'right', 'left', obstacles)!;
    expect(path).not.toBeNull(); expect(path[1]!.x).toBeLessThan(8);
    for (let i = 1; i < path.length; i++) for (const rect of obstacles) expect(segmentHitsObstacle(path[i - 1]!, path[i]!, rect)).toBe(false);
  });

  it('finds a non-colliding route in a dense but solvable 300-obstacle scene', () => {
    const dense = Array.from({ length: 300 }, (_, i) => ({ x: 70 + (i % 20) * 50, y: -220 + Math.floor(i / 20) * 50, width: 30, height: 30 }));
    const path = routeWithPortStubs({ x: 0, y: 0 }, { x: 1120, y: 0 }, 'right', 'left', dense)!;
    expect(path).not.toBeNull();
    for (let i = 1; i < path.length; i++) for (const rect of dense) expect(segmentHitsObstacle(path[i - 1]!, path[i]!, rect)).toBe(false);
  });

  it('reports an impossible enclosed endpoint instead of returning a colliding successful route', () => {
    expect(findOrthogonalPath({ x: 10, y: 10 }, target, [{ x: 0, y: 0, width: 40, height: 40 }])).toBeNull();
  });
});
