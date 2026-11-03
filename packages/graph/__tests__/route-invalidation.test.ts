import { describe, expect, it } from "vitest";
import { createRouteFootprint, routeAffectedByNode } from "../src/route-invalidation";

describe("route obstacle invalidation", () => {
  const route = createRouteFootprint(
    [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
    ],
    "source",
    "target",
  );
  it("does not rerender terminal edges already projected by X6", () => {
    expect(routeAffectedByNode(route, "source", { x: 0, y: 0, width: 120, height: 40 })).toBe(
      false,
    );
    expect(routeAffectedByNode(route, "target", { x: 900, y: 900, width: 120, height: 40 })).toBe(
      false,
    );
  });
  it("does not treat the empty interior of a long L route as a collision", () => {
    expect(
      routeAffectedByNode(route, "third-party", { x: 400, y: 400, width: 120, height: 40 }),
    ).toBe(false);
  });
  it("invalidates entering obstacles and obstacles leaving an old segment", () => {
    expect(
      routeAffectedByNode(route, "third-party", { x: 400, y: -10, width: 120, height: 40 }),
    ).toBe(true);
    expect(
      routeAffectedByNode(
        route,
        "third-party",
        { x: 400, y: 400, width: 120, height: 40 },
        { x: 980, y: 400, width: 120, height: 40 },
      ),
    ).toBe(true);
  });
  it("tracks curved samples without filling their whole control-point hull", () => {
    const curve = createRouteFootprint(
      [
        { x: 0, y: 0 },
        { x: 100, y: 10 },
        { x: 200, y: 80 },
        { x: 300, y: 90 },
      ],
      "a",
      "b",
    );
    expect(routeAffectedByNode(curve, "obstacle", { x: 140, y: 35, width: 10, height: 10 })).toBe(
      true,
    );
    expect(routeAffectedByNode(curve, "obstacle", { x: 0, y: 80, width: 10, height: 10 })).toBe(
      false,
    );
  });
});
