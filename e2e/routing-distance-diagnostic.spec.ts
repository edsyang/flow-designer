import { expect, test } from "@playwright/test";
async function setup(page: any) {
  await page.goto("http://127.0.0.1:5179");
  await page.waitForFunction(() => Boolean((window as any).designer?.graph));
  return page.evaluate(async () => {
    const d = (window as any).designer,
      c = d.document.getContent();
    for (const n of [...c.getNodes()]) await c.removeNode(n.getId());
    const a = await c.addNode({ type: "UserTask" }),
      b = await c.addNode({ type: "UserTask" });
    a.setPosition(300, 300);
    b.setPosition(600, 300);
    a.getRelation().addEdge({
      id: "near-route",
      targetNodeId: b.getId(),
      sourcePort: "out-right",
      targetPort: "in-left",
      type: "SequenceFlow",
    });
    d.graph.setInteractionMode("select");
    await new Promise((r) => setTimeout(r, 100));
    d.document.getTimeline().reset();
    return { a: a.getId(), b: b.getId() };
  });
}
test("nearby nonoverlapping nodes retain measured visible port-attached paths", async ({
  page,
}) => {
  const ids = await setup(page);
  for (const dx of [300, 200, 180, 170, 161, 160, 159, 150, 130]) {
    const result = await page.evaluate(
      async ({ id, dx }) => {
        const d = (window as any).designer;
        d.document
          .getContent()
          .getNode(id)
          .setPosition(300 + dx, 300);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const g = d.graph.getX6Graph(),
          e = g.getCellById("near-route"),
          v = g.findViewByCell(e),
          path = v.findOne("line") as SVGPathElement;
        const points = [v.sourcePoint, ...v.routePoints, v.targetPoint];
        return {
          length: path.getTotalLength(),
          start: path.getPointAtLength(0),
          end: path.getPointAtLength(path.getTotalLength()),
          source: { x: v.sourcePoint.x, y: v.sourcePoint.y },
          target: { x: v.targetPoint.x, y: v.targetPoint.y },
          points,
          error: v.container.getAttribute("data-routing-error"),
        };
      },
      { id: ids.b, dx },
    );
    expect(result.error).toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(dx - 121);
    expect(result.points.length - 2).toBeLessThanOrEqual(3);
    expect(result.source).toEqual({ x: 420, y: 320 });
    expect(result.target).toEqual({ x: 300 + dx, y: 320 });
  }
});
test("an unrealizable real node drag restores preview and complete saved state", async ({
  page,
}) => {
  const ids = await setup(page);
  await page.evaluate(async (ids) => {
    const d = (window as any).designer;
    d.document.getContent().getNode(ids.a).setPosition(100, 200);
    d.graph.getX6Graph().getCellById(ids.a).resize(400, 200);
    await new Promise((r) => setTimeout(r, 50));
    d.document.getTimeline().reset();
  }, ids);
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).designer.document.getData()),
  );
  const point = await page.evaluate((id) => {
    const d = (window as any).designer,
      n = d.graph.getX6Graph().getCellById(id),
      b = n.getBBox();
    return d.graph.localToClient(b.center.x, b.center.y);
  }, ids.b);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 260, point.y, { steps: 20 });
  const preview = await page.evaluate(() => {
    const d = (window as any).designer,
      v = d.graph.getX6Graph().findViewByCell("near-route");
    return {
      error: v.container.getAttribute("data-routing-error"),
      length: (v.findOne("line") as SVGPathElement).getTotalLength(),
    };
  });
  expect(preview.error).toBeNull();
  expect(preview.length).toBeGreaterThan(0);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).designer.document.getData())))
    .toBe(before);
  expect(
    await page.evaluate(() => (window as any).designer.document.getTimeline().getCurrentCursor()),
  ).toBe(0);
});

test("legacy impossible geometry stays visible as a reversible diagnostic through undo", async ({
  page,
}) => {
  const ids = await setup(page);
  await page.evaluate(async (ids) => {
    const d = (window as any).designer;
    d.document.getContent().getNode(ids.b).setPosition(340, 300);
    await new Promise((r) => setTimeout(r, 30));
    const saved = d.document.getData();
    d.document.load(saved);
    await new Promise((r) => setTimeout(r, 50));
    const e = d.graph.getX6Graph().getCellById("near-route");
    e.attr("line/stroke", "#117733");
    e.attr("line/strokeWidth", 3);
    e.attr("line/strokeDasharray", "2 1");
    d.document.getTimeline().reset();
  }, ids);
  const snapshot = () =>
    page.evaluate(() => {
      const d = (window as any).designer,
        g = d.graph.getX6Graph(),
        e = g.getCellById("near-route"),
        v = g.findViewByCell(e),
        p = v.findOne("line") as SVGPathElement;
      return {
        error: v.container.getAttribute("data-routing-error"),
        length: p.getTotalLength(),
        stroke: getComputedStyle(p).stroke,
        dash: getComputedStyle(p).strokeDasharray,
        width: getComputedStyle(p).strokeWidth,
        marker: e.attr("line/targetMarker"),
      };
    });
  const invalid = await snapshot();
  expect(invalid.error).not.toBeNull();
  expect(invalid.length).toBeGreaterThan(0);
  expect(invalid.stroke).toBe("rgb(217, 45, 32)");
  await page.evaluate(async (id) => {
    const d = (window as any).designer;
    await d.document.transaction("Repair legacy position", () =>
      d.document.getContent().getNode(id).setPosition(600, 300),
    );
  }, ids.b);
  await expect.poll(async () => (await snapshot()).error).toBeNull();
  const repaired = await snapshot();
  expect(repaired.stroke).toBe("rgb(17, 119, 51)");
  expect(repaired.width).toBe("3px");
  expect(repaired.dash).toBe("2px, 1px");
  expect(repaired.marker).toEqual(invalid.marker);
  await page.evaluate(() => (window as any).designer.document.getTimeline().back());
  await expect.poll(async () => (await snapshot()).error).not.toBeNull();
  expect((await snapshot()).stroke).toBe("rgb(217, 45, 32)");
});

test("moving an unrelated obstacle onto a link rejects and restores document and graph", async ({
  page,
}) => {
  await setup(page);
  const id = await page.evaluate(async () => {
    const d = (window as any).designer,
      n = await d.document.getContent().addNode({ type: "UserTask" });
    n.setPosition(450, 500);
    d.graph.getX6Graph().getCellById(n.getId()).resize(400, 200);
    await new Promise((r) => setTimeout(r, 100));
    d.document.getTimeline().reset();
    return n.getId();
  });
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).designer.document.getData()),
  );
  const p = await page.evaluate((id) => {
    const d = (window as any).designer;
    return d.graph.localToClient(650, 600);
  }, id);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 200, p.y - 250, { steps: 20 });
  expect(
    await page.evaluate(() => {
      const v = (window as any).designer.graph.getX6Graph().findViewByCell("near-route");
      return v.container.getAttribute("data-routing-error");
    }),
  ).toBeNull();
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).designer.document.getData())))
    .toBe(before);
  expect(
    await page.evaluate(
      (id) => (window as any).designer.graph.getX6Graph().getCellById(id).position(),
      id,
    ),
  ).toEqual({ x: 450, y: 500 });
});

test("a rejected selected-group drag restores every node atomically", async ({ page }) => {
  const ids = await setup(page);
  await page.evaluate(async (ids) => {
    const d = (window as any).designer;
    d.document.getContent().getNode(ids.a).setPosition(100, 200);
    d.graph.getX6Graph().getCellById(ids.a).resize(400, 200);
    await new Promise((r) => setTimeout(r, 50));
  }, ids);
  const extra = await page.evaluate(async (ids) => {
    const d = (window as any).designer,
      n = await d.document.getContent().addNode({ type: "UserTask" });
    n.setPosition(600, 500);
    await new Promise((r) => setTimeout(r, 50));
    d.graph.select([ids.b, n.getId()]);
    d.document.getTimeline().reset();
    return n.getId();
  }, ids);
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).designer.document.getData()),
  );
  const p = await page.evaluate(() => (window as any).designer.graph.localToClient(660, 320));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 260, p.y, { steps: 20 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify((window as any).designer.document.getData())))
    .toBe(before);
  expect(
    await page.evaluate(
      (id) => (window as any).designer.graph.getX6Graph().getCellById(id).position(),
      extra,
    ),
  ).toEqual({ x: 600, y: 500 });
});

test("a generic back-fold drop keeps its source and resolves a legal target before persistence", async ({
  page,
}) => {
  const ids = await setup(page);
  const points = await page.evaluate((ids) => {
    const d = (window as any).designer,
      g = d.graph.getX6Graph();
    d.document.getContent().getNode(ids.a).getRelation().removeEdgeById("near-route");
    (window as any).__routingRejections = [];
    g.on("connection:rejected", (e: any) => (window as any).__routingRejections.push(e));
    return { source: d.graph.localToClient(420, 320), target: d.graph.localToClient(720, 320) };
  }, ids);
  await page.mouse.move(points.source.x - 10, points.source.y);
  await page.mouse.move(points.source.x, points.source.y);
  await page.mouse.down();
  await page.mouse.move(points.target.x, points.target.y, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as any).designer.document.getContent().getNode(id).getRelation().getEdges()
            .length,
        ids.a,
      ),
    )
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__routingRejections.length)).toBe(0);
  const connected = await page.evaluate((id) => {
    const d = (window as any).designer,
      r = d.document.getContent().getNode(id).getRelation().getEdges()[0],
      e = d.graph.getX6Graph().getCellById(r.id);
    return {
      source: r.sourcePort,
      target: r.targetPort,
      graphSource: e.getSourcePortId(),
      graphTarget: e.getTargetPortId(),
    };
  }, ids.a);
  expect(connected).toEqual({
    source: "out-right",
    target: "in-left",
    graphSource: "out-right",
    graphTarget: "in-left",
  });
});

test("a movable third-party obstacle selects legal generic ports through history and save/load", async ({
  page,
}) => {
  const ids = await setup(page);
  const obstacleId = await page.evaluate(async () => {
    const d = (window as any).designer,
      n = await d.document.getContent().addNode({ type: "UserTask" });
    n.setPosition(450, 500);
    await new Promise((r) => setTimeout(r, 80));
    d.document.getTimeline().reset();
    return n.getId();
  });
  const snapshot = () =>
    page.evaluate((obstacleId) => {
      const d = (window as any).designer,
        g = d.graph.getX6Graph(),
        e = g.getCellById("near-route"),
        v = g.findViewByCell(e),
        model = d.document
          .getContent()
          .getNode(e.getSourceCellId())
          .getRelation()
          .getEdgeById(e.id),
        p = v.findOne("line") as SVGPathElement;
      return {
        position: d.document.getContent().getNode(obstacleId).getPosition(),
        graphPosition: g.getCellById(obstacleId).position(),
        source: e.getSourcePortId(),
        target: e.getTargetPortId(),
        modelSource: model.sourcePort,
        modelTarget: model.targetPort,
        vertices: model.vertices ?? [],
        route: [v.sourcePoint, ...v.routePoints, v.targetPoint].map((p: any) => ({
          x: p.x,
          y: p.y,
        })),
        length: p.getTotalLength(),
        error: v.container.getAttribute("data-routing-error"),
      };
    }, obstacleId);
  const before = await snapshot();
  const point = await page.evaluate(() => (window as any).designer.graph.localToClient(510, 520));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y - 200, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot()).position.y).toBe(300);
  const moved = await snapshot();
  expect(moved.graphPosition).toEqual(moved.position);
  expect([moved.source, moved.target]).not.toEqual([before.source, before.target]);
  expect(moved.modelSource).toBe(moved.source);
  expect(moved.modelTarget).toBe(moved.target);
  expect(moved.error).toBeNull();
  expect(moved.length).toBeGreaterThan(0);
  expect(moved.route.length - 2).toBeLessThanOrEqual(3);
  const box = { x: 450, y: 300, width: 120, height: 40 };
  for (let i = 1; i < moved.route.length; i++) {
    const a = moved.route[i - 1]!,
      b = moved.route[i]!;
    expect(a.x === b.x || a.y === b.y).toBe(true);
    if (a.y === b.y)
      expect(
        a.y > box.y &&
          a.y < box.y + box.height &&
          Math.max(a.x, b.x) > box.x &&
          Math.min(a.x, b.x) < box.x + box.width,
      ).toBe(false);
    else
      expect(
        a.x > box.x &&
          a.x < box.x + box.width &&
          Math.max(a.y, b.y) > box.y &&
          Math.min(a.y, b.y) < box.y + box.height,
      ).toBe(false);
  }
  await page.evaluate(() => (window as any).designer.document.getTimeline().back());
  await expect.poll(async () => (await snapshot()).position).toEqual(before.position);
  expect((await snapshot()).modelSource).toBe(before.source);
  expect((await snapshot()).modelTarget).toBe(before.target);
  await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
  await expect.poll(async () => (await snapshot()).modelSource).toBe(moved.source);
  expect((await snapshot()).modelTarget).toBe(moved.target);
  expect((await snapshot()).position).toEqual(moved.position);
  await page.evaluate(() => {
    const d = (window as any).designer;
    d.document.load(d.document.getData());
  });
  await expect.poll(async () => (await snapshot()).position).toEqual(moved.position);
  const loaded = await snapshot();
  expect(loaded.source).toBe(moved.source);
  expect(loaded.target).toBe(moved.target);
  expect(loaded.modelSource).toBe(moved.source);
  expect(loaded.modelTarget).toBe(moved.target);
  expect(loaded.error).toBeNull();
  expect(loaded.length).toBeGreaterThan(0);
});
