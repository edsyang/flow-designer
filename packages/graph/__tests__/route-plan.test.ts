import { describe, expect, it } from "vitest";
import { GeometryScene } from "../src/geometry-scene";
import {
  legacyRoutePlan,
  roundedPath,
  selectRoutePlan,
  lineIntersectsRect,
  type RouteRequest,
} from "../src/route-plan";
import { findOrthogonalPath, type RoutingSearchEvidence } from "../src/orthogonal-routing";
const request = (overrides: Partial<RouteRequest> = {}): RouteRequest => ({
  source: { nodeId: "source", portId: "right", point: { x: 0, y: 0 }, side: "right" },
  target: { nodeId: "target", portId: "left", point: { x: 100, y: 0 }, side: "left" },
  mode: "orthogonal",
  vertices: [],
  policy: "explicit",
  ...overrides,
});
describe("shared route plans", () => {
  it("returns final port identity, cost and geometry using unchanged short routes", () => {
    const scene = new GeometryScene(),
      plan = scene.plan(request());
    expect(plan.status).toBe("valid");
    expect(plan.source.portId).toBe("right");
    expect(plan.target.portId).toBe("left");
    expect(plan.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(plan.cost).toBe(100);
    expect(plan.bends).toBe(0);
  });
  it("distinguishes complete policy failure from an actually truncated candidate set", () => {
    const scene = new GeometryScene();
    const impossible = request({
      target: { nodeId: "target", portId: "right", point: { x: 100, y: 0 }, side: "right" },
      vertices: [
        { x: 50, y: 50 },
        { x: 50, y: -50 },
      ],
    });
    const blocked = scene.plan(impossible);
    expect(blocked.status).toBe("blocked-within-policy");
    expect(blocked.search.laneCandidatesTruncated).not.toBe(true);
    const limited = scene.plan({ ...impossible, budget: { laneLimit: 0 } });
    expect(limited.status).toBe("budget-exhausted");
    expect(limited.search.laneCandidatesTruncated).toBe(true);
  });
  it("reports a real nonempty frontier at expansion exhaustion and succeeds with the production budget", () => {
    const boxes = [
      { x: -20, y: -50, width: 80, height: 40 },
      { x: -20, y: 10, width: 80, height: 40 },
      { x: 350, y: -50, width: 80, height: 40 },
      { x: 350, y: 10, width: 80, height: 40 },
      { x: 100, y: -100, width: 30, height: 180 },
      { x: 240, y: -80, width: 30, height: 180 },
    ];
    const evidence: RoutingSearchEvidence = { candidates: 0, obstacleChecks: 0, expansionLimit: 0 };
    expect(findOrthogonalPath({ x: 0, y: 0 }, { x: 400, y: 0 }, boxes, evidence)).toBeNull();
    expect(evidence.expansionBudgetExhausted).toBe(true);
    expect(findOrthogonalPath({ x: 0, y: 0 }, { x: 400, y: 0 }, boxes)).not.toBeNull();
  });
  it("shares one solve across admission/preview/render and invalidates all geometric inputs", () => {
    const scene = new GeometryScene();
    scene.update("source", { x: -40, y: -20, width: 40, height: 40 });
    scene.update("target", { x: 100, y: -20, width: 40, height: 40 });
    const a = scene.plan(request());
    expect(scene.plan({ ...request(), policy: "render" })).toBe(a);
    expect(scene.plan({ ...request(), policy: "move-geometry" })).toBe(a);
    expect(scene.metrics.planMisses).toBe(1);
    expect(scene.metrics.planHits).toBe(2);
    expect(scene.metrics.snapshotBuilds).toBe(1);
    const revision = a.revision;
    scene.update("obstacle", { x: 40, y: -10, width: 20, height: 20 });
    const next = scene.plan(request());
    expect(next.revision).toBeGreaterThan(revision);
    expect(next).not.toBe(a);
    scene.update("obstacle", { x: 40, y: 60, width: 20, height: 20 });
    expect(scene.plan(request()).points).toEqual(a.points);
    scene.update("obstacle", { x: 40, y: -10, width: 20, height: 20 });
    expect(scene.plan(request()).points).toEqual(next.points);
    scene.remove("obstacle");
    expect(scene.plan(request()).points).toEqual(a.points);
    scene.invalidate();
    expect(scene.plan(request())).not.toBe(a);
    expect(scene.plan({ ...request(), vertices: [{ x: 50, y: 40 }] })).not.toBe(
      scene.plan(request()),
    );
    scene.dispose();
    expect(scene.boxes.size).toBe(0);
  });
  it("preserves dependency IDs for equal-or-cheaper blocked candidates", () => {
    const scene = new GeometryScene();
    scene.update("middle", { x: 40, y: -10, width: 20, height: 20 });
    const plan = scene.plan(request());
    expect(plan.blockerIds).toContain("middle");
    expect(plan.search.obstacleChecks).toBeGreaterThan(0);
  });
  it("applies ordered move versus source-priority/cost policies to final port plans", () => {
    const scene = new GeometryScene(),
      a = scene.plan(request()),
      b = { ...a, source: { ...a.source, portId: "bottom" }, cost: 1 };
    const candidates = [
      { plan: a, sourcePriority: 0 },
      { plan: b, sourcePriority: 1 },
    ];
    expect(selectRoutePlan(candidates, "ordered-first-valid")).toBe(a);
    expect(selectRoutePlan(candidates, "source-priority-cost")).toBe(a);
    expect(
      selectRoutePlan(
        [
          { plan: a, sourcePriority: 0 },
          { plan: b, sourcePriority: 0 },
        ],
        "source-priority-cost",
      ),
    ).toBe(b);
  });
  it("admits only obstacle-clear port-tangent direct Beziers and preserves curve mode with waypoints", () => {
    const scene = new GeometryScene();
    scene.update("source", { x: -40, y: -20, width: 40, height: 40 });
    scene.update("target", { x: 100, y: -20, width: 40, height: 40 });
    const plan = scene.plan(request({ mode: "curve" }));
    expect(plan.status).toBe("valid");
    expect(plan.kind).toBe("bezier");
    const [c1, c2] = plan.controls!;
    expect(c1.x).toBeGreaterThan(0);
    expect(c1.y).toBe(0);
    expect(c2.x).toBeLessThan(100);
    expect(c2.y).toBe(0);
    let previous = plan.source.point;
    for (let i = 1; i < 100; i++) {
      const t = i / 100,
        u = 1 - t,
        p = {
          x: u * u * u * 0 + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * 100,
          y: 0,
        };
      for (const box of scene.boxes.values())
        expect(lineIntersectsRect(previous, p, box)).toBe(false);
      previous = p;
    }
    const waypoint = scene.plan(request({ mode: "curve", vertices: [{ x: 50, y: 40 }] }));
    expect(waypoint.status).toBe("valid");
    expect(waypoint.kind).toBe("rounded-corridor");
    expect(waypoint.source.portId).toBe("right");
    expect(waypoint.target.portId).toBe("left");
  });
  it("bounds plan memoization within a revision", () => {
    const scene = new GeometryScene();
    for (let i = 0; i < 520; i++)
      scene.plan(
        request({
          target: { nodeId: "target", portId: "left", point: { x: 100 + i, y: 0 }, side: "left" },
        }),
      );
    const before = scene.metrics.planMisses;
    scene.plan(request());
    expect(scene.metrics.planMisses).toBe(before + 1);
  });
  it("checks the final Bezier interval against a thin obstacle adjacent to the target", () => {
    const scene = new GeometryScene();
    scene.update("thin", { x: 99.55, y: -1, width: 0.25, height: 2 });
    const plan = scene.plan(request({ mode: "curve" }));
    expect(plan.kind).not.toBe("bezier");
    expect(plan.status).not.toBe("valid");
  });
  it("retains strict failure and the visible compatibility path as a distinct legacy result", () => {
    const scene = new GeometryScene();
    const strict = scene.plan(
      request({
        vertices: [
          { x: 50, y: 50 },
          { x: 50, y: -50 },
        ],
      }),
    );
    expect(strict.status).not.toBe("valid");
    const legacy = legacyRoutePlan(
      strict,
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
      ],
      true,
    );
    expect(legacy.status).toBe("legacy-degraded");
    expect(legacy.strictStatus).toBe(strict.status);
    expect(legacy.diagnostic).toBe(true);
    expect(
      selectRoutePlan([{ plan: legacy, sourcePriority: 0 }], "ordered-first-valid"),
    ).toBeNull();
    scene.recordRendered("legacy", legacy);
    expect(scene.getRendered("legacy")).toBe(legacy);
    scene.forgetEdge("legacy");
    expect(scene.getRendered("legacy")).toBeUndefined();
  });
  it("detaches immutable scene/port inputs without cloning the whole scene for every lookup", () => {
    const scene = new GeometryScene(),
      box = { x: 1, y: 2, width: 3, height: 4 };
    scene.update("node", box);
    const snapshot = scene.snapshot();
    box.x = 99;
    expect(snapshot.obstacles[0]?.x).toBe(1);
    expect(Object.isFrozen(snapshot.obstacles)).toBe(true);
    expect(Object.isFrozen(snapshot.obstacles[0])).toBe(true);
    expect(scene.snapshot()).toBe(snapshot);
    const point = { x: 10, y: 20 };
    const endpoint = scene.endpoint("key", () => ({
      nodeId: "node",
      portId: "port",
      point,
      side: "right",
    }));
    point.x = 999;
    expect(endpoint?.point.x).toBe(10);
    expect(Object.isFrozen(endpoint?.point)).toBe(true);
  });
  it("keeps public and historical snapshots isolated from versioned solver geometry", () => {
    const scene = new GeometryScene();
    scene.update("obstacle", { x: 40, y: -10, width: 20, height: 20 });
    const previous = scene.snapshot();
    const blockedDirect = scene.plan(request());
    expect(blockedDirect.points).not.toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(Reflect.set(previous.obstacles, "0", { x: 500, y: 500, width: 1, height: 1 })).toBe(
      false,
    );
    expect(Reflect.set(previous.obstacles[0]!, "x", 500)).toBe(false);
    expect(scene.plan(request({ policy: "render" })).points).toEqual(blockedDirect.points);
    scene.remove("obstacle");
    expect(scene.snapshot()).not.toBe(previous);
    expect(previous.obstacles).toHaveLength(1);
    expect(scene.snapshot().obstacles).toHaveLength(0);
    expect(scene.plan(request()).points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(scene.metrics.snapshotBuilds).toBe(2);
  });
  it("keeps legal rounded corners but avoids cutting through an obstacle at a corridor corner", () => {
    const points = [
        { x: 140, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 140 },
      ],
      box = { x: 0, y: 0, width: 100, height: 100 };
    expect(roundedPath(points)).toContain(" Q ");
    expect(roundedPath(points, 8, [box])).not.toContain(" Q ");
    expect(roundedPath(points, 8, [{ x: 500, y: 500, width: 100, height: 100 }])).toBe(
      roundedPath(points),
    );
    const scene = new GeometryScene();
    scene.update("corner-body", box);
    const plan = scene.plan(
      request({
        mode: "curve",
        source: { nodeId: "source", portId: "left", point: points[0]!, side: "left" },
        target: { nodeId: "target", portId: "top", point: points[2]!, side: "top" },
      }),
    );
    expect(plan.status).toBe("valid");
    expect(plan.kind).toBe("rounded-corridor");
    expect(plan.path).not.toContain(" Q ");
    expect(plan.path).toContain(" L 0 0");
  });
  it("retains blockers of a shorter direct Bezier while drawing its legal corridor", () => {
    const scene = new GeometryScene();
    scene.update("direct-blocker", { x: 40, y: -10, width: 20, height: 20 });
    const plan = scene.plan(request({ mode: "curve" }));
    expect(plan.status).toBe("valid");
    expect(plan.kind).toBe("rounded-corridor");
    expect(plan.blockerIds).toContain("direct-blocker");
    scene.update("direct-blocker", { x: 40, y: 100, width: 20, height: 20 });
    const recovered = scene.plan(request({ mode: "curve" }));
    expect(recovered.kind).toBe("bezier");
    expect(recovered.blockerIds).toEqual([]);
  });
});
