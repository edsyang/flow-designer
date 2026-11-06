import { describe, it, expect } from "vitest";
import { findShortPortRoute, segmentHitsObstacle } from "../src/orthogonal-routing";
describe("short signed port routing", () => {
  it("keeps a one-pixel physical gap visible without fixed endpoint stubs", () => {
    for (const gap of [60, 40, 10, 1])
      expect(
        findShortPortRoute({ x: 120, y: 20 }, { x: 120 + gap, y: 20 }, "right", "left", [
          { x: 0, y: 0, width: 120, height: 40 },
          { x: 120 + gap, y: 0, width: 120, height: 40 },
        ]),
      ).toEqual([
        { x: 120, y: 20 },
        { x: 120 + gap, y: 20 },
      ]);
  });
  it("rejects an unavoidable four-bend detour rather than hiding a line as success", () => {
    expect(
      findShortPortRoute({ x: 0, y: 20 }, { x: 200, y: 20 }, "right", "left", [
        { x: 80, y: 0, width: 40, height: 40 },
      ]),
    ).toBeNull();
  });
  it("chooses a short clear three-bend path with exact signed tangents", () => {
    const boxes = [{ x: 50, y: -20, width: 40, height: 80 }];
    const route = findShortPortRoute({ x: 0, y: 0 }, { x: 160, y: 120 }, "right", "top", boxes)!;
    expect(route).not.toBeNull();
    expect(route.length).toBeLessThanOrEqual(5);
    expect(route[1]!.x).toBeGreaterThan(0);
    expect(route.at(-2)!.y).toBeLessThan(120);
    for (let i = 1; i < route.length; i++)
      for (const box of boxes)
        expect(segmentHitsObstacle(route[i - 1]!, route[i]!, box)).toBe(false);
  });
});

it("bounds candidate work in a dense but solvable 500-node scene", () => {
  const boxes = Array.from({ length: 500 }, (_, i) => ({
    x: (i % 20) * 240,
    y: Math.floor(i / 20) * 100,
    width: 120,
    height: 40,
  }));
  const stats = { candidates: 0, obstacleChecks: 0 };
  const route = findShortPortRoute(
    { x: 120, y: 20 },
    { x: 540, y: 200 },
    "right",
    "top",
    boxes,
    [],
    stats,
  );
  expect(route).not.toBeNull();
  expect(route!.length).toBeLessThanOrEqual(5);
  expect(stats.candidates).toBeLessThanOrEqual(48 * 48 + 2);
  expect(stats.obstacleChecks).toBeLessThanOrEqual((48 * 48 + 2) * 4 * 500);
});

it("records a blocking obstacle even when the chosen detour no longer touches it", () => {
  const obstacle = { x: 490, y: 245, width: 120, height: 40 };
  const stats = { candidates: 0, obstacleChecks: 0, bestCost: Infinity, blockingCosts: new Map() };
  const source = { x: 130, y: 265 },
    target = { x: 900, y: 385 };
  const original = findShortPortRoute(source, target, "right", "left", [])!;
  const detour = findShortPortRoute(source, target, "right", "left", [obstacle], [], stats)!;
  expect(detour).not.toEqual(original);
  expect(stats.blockingCosts.get(obstacle)).toBeLessThanOrEqual(stats.bestCost);
  expect(findShortPortRoute(source, target, "right", "left", [])).toEqual(original);
});

it("gives a left-facing port a visible exit before turning toward a node above", () => {
  const route = findShortPortRoute({ x: 0, y: 0 }, { x: 80, y: -200 }, "left", "bottom", [
    { x: 0, y: -25, width: 50, height: 50 },
    { x: 55, y: -250, width: 50, height: 50 },
  ])!;
  expect(route).not.toBeNull();
  expect(route[1]!.x).toBeLessThanOrEqual(-12);
  expect(route[1]!.y).toBe(0);
  expect(route.length - 2).toBeLessThanOrEqual(3);
});
it("balances compressed opposed stubs without accepting one-pixel bends", () => {
  const route = findShortPortRoute({ x: 100, y: 0 }, { x: 91, y: 120 }, "left", "right", [
    { x: 100, y: -30, width: 90, height: 60 },
    { x: 1, y: 90, width: 90, height: 60 },
  ])!;
  expect(route).not.toBeNull();
  const a = 100 - route[1]!.x,
    b = route.at(-2)!.x - 91;
  expect(a).toBeGreaterThanOrEqual(4);
  expect(b).toBeGreaterThanOrEqual(4);
  expect(Math.abs(a - b)).toBeLessThan(0.01);
});
it("covers a legal bottom-to-bottom U while rejecting the fixed-port four-bend screenshot geometry", () => {
  expect(
    findShortPortRoute({ x: 0, y: 0 }, { x: 150, y: 150 }, "bottom", "bottom", [
      { x: -25, y: -50, width: 50, height: 50 },
      { x: 100, y: 118, width: 100, height: 32 },
    ]),
  ).not.toBeNull();
  expect(
    findShortPortRoute({ x: 202, y: 168 }, { x: 232, y: 532 }, "bottom", "bottom", [
      { x: 152, y: 68, width: 100, height: 100 },
      { x: 132, y: 468, width: 200, height: 64 },
    ]),
  ).toBeNull();
});
