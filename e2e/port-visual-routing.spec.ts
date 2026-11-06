import { expect, test, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("http://127.0.0.1:5179");
  await page.waitForFunction(() => Boolean((window as any).designer?.graph));
  await page.evaluate(async () => {
    const d = (window as any).designer;
    for (const n of [...d.document.getContent().getNodes()])
      await d.document.getContent().removeNode(n.getId());
    d.graph.setInteractionMode("select");
  });
}
async function snap(page: Page, id = "visual-edge") {
  await page.waitForFunction((id) => {
    const g = (window as any).designer.graph.getX6Graph(),
      e = g.getCellById(id),
      v = e ? g.findViewByCell(e) : null;
    return !!v?.sourcePoint && Array.isArray(v.routePoints);
  }, id);
  return page.evaluate((id) => {
    const d = (window as any).designer,
      g = d.graph.getX6Graph(),
      e = g.getCellById(id),
      v = g.findViewByCell(e),
      line = v.findOne("line") as SVGPathElement,
      points = [v.sourcePoint, ...v.routePoints, v.targetPoint].map((p: any) => ({
        x: p.x,
        y: p.y,
      })),
      end = points.at(-1),
      last = points.at(-2),
      first = points[1],
      start = points[0],
      markerId = line.getAttribute("marker-end")?.match(/#([^)]*)/)?.[1],
      marker = markerId ? line.closest("svg")?.getElementById(markerId) : null;
    const markerPath = marker?.querySelector("path") as SVGPathElement | null;
    let tip = markerPath?.getPointAtLength(0) ?? new DOMPoint();
    let ancestor: Element | null = markerPath;
    while (ancestor && ancestor !== marker) {
      if (ancestor instanceof SVGGraphicsElement) {
        const matrix = ancestor.transform.baseVal.consolidate()?.matrix;
        if (matrix) tip = tip.matrixTransform(matrix);
      }
      ancestor = ancestor.parentElement;
    }
    const originalId = marker?.getAttribute("data-original-marker");
    const original = originalId ? line.closest("svg")?.getElementById(originalId) : marker;
    const modelMarker = e.attr("line/targetMarker");
    const lineEnd = line.getPointAtLength(line.getTotalLength());
    return {
      points,
      source: e.getSourcePortId(),
      target: e.getTargetPortId(),
      sourceLeg: Math.hypot(first.x - start.x, first.y - start.y),
      targetLeg: Math.hypot(last.x - end.x, last.y - end.y),
      markerSize: Number(marker?.getAttribute("data-adaptive-size") ?? modelMarker?.size ?? 8),
      markerTip: { x: tip.x, y: tip.y },
      markerFrameUnchanged: ["refX", "refY", "viewBox", "orient", "markerUnits"].every(
        (key) => marker?.getAttribute(key) === original?.getAttribute(key),
      ),
      tipGap: Math.hypot(lineEnd.x - end.x, lineEnd.y - end.y),
      markerModel: e.attr("line/targetMarker"),
      error: v.container.getAttribute("data-routing-error"),
    };
  }, id);
}
async function frame(page: Page) {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function seed(
  page: Page,
  sourceType: string,
  targetType: string,
  sourcePosition: { x: number; y: number },
  targetPosition: { x: number; y: number },
  sourcePort: string,
  targetPort: string,
  connect = true,
) {
  return page.evaluate(
    async (args) => {
      const d = (window as any).designer,
        c = d.document.getContent(),
        a = await c.addNode({ type: args.sourceType }),
        b = await c.addNode({ type: args.targetType });
      a.setPosition(args.sourcePosition.x, args.sourcePosition.y);
      b.setPosition(args.targetPosition.x, args.targetPosition.y);
      if (args.connect)
        a.getRelation().addEdge({
          id: "visual-edge",
          targetNodeId: b.getId(),
          sourcePort: args.sourcePort,
          targetPort: args.targetPort,
          type: "SequenceFlow",
        });
      d.graph.getX6Graph().zoomTo(2.5);
      d.graph.select([]);
      d.document.getSelection().setKeys([]);
      return { a: a.getId(), b: b.getId() };
    },
    { sourceType, targetType, sourcePosition, targetPosition, sourcePort, targetPort, connect },
  );
}
async function center(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).designer.graph.getX6Graph();
    g.centerCell(g.getCellById("visual-edge"));
  });
  await frame(page);
}
test("close diamond ports keep balanced visible stubs and default marker compression is reversible", async ({
  page,
}, info) => {
  await ready(page);
  const ids = await seed(
    page,
    "EventBasedGateway",
    "ParallelGateway",
    { x: 500, y: 180 },
    { x: 401, y: 360 },
    "in-left",
    "out-right",
  );
  await center(page);
  const short = await snap(page);
  expect(short.error).toBeNull();
  expect(short.sourceLeg).toBeGreaterThanOrEqual(4);
  expect(short.targetLeg).toBeGreaterThanOrEqual(4);
  expect(Math.abs(short.sourceLeg - short.targetLeg)).toBeLessThan(0.01);
  expect(short.targetLeg - short.markerSize - 1).toBeGreaterThanOrEqual(2);
  expect(short.markerSize).toBeLessThan(8);
  expect(short.markerTip).toEqual({ x: 0, y: 0 });
  expect(short.markerFrameUnchanged).toBe(true);
  expect(short.tipGap).toBeLessThanOrEqual(1.01);
  expect(short.markerModel).toEqual({ name: "block", size: 8 });
  await page.screenshot({ path: info.outputPath("diamond-balanced-stubs.png") });
  await page.evaluate(
    (id) => (window as any).designer.document.getContent().getNode(id).setPosition(330, 360),
    ids.b,
  );
  await frame(page);
  expect((await snap(page)).markerSize).toBe(8);
  expect((await snap(page)).markerModel).toEqual(short.markerModel);
  await page.evaluate((id) => {
    const d = (window as any).designer;
    d.document.getContent().getNode(id).setPosition(401, 360);
    d.graph
      .getX6Graph()
      .getCellById("visual-edge")
      .attr("line/targetMarker", { name: "block", size: 10, fill: "#115577" });
  }, ids.b);
  await frame(page);
  expect((await snap(page)).markerModel).toEqual({ name: "block", size: 10, fill: "#115577" });
  expect((await snap(page)).markerSize).toBe(10);
});
test("a Start left port has a visibly horizontal exit before rising", async ({ page }, info) => {
  await ready(page);
  await seed(
    page,
    "StartEvent",
    "MessageEvent",
    { x: 500, y: 500 },
    { x: 550, y: 240 },
    "out-left",
    "out-bottom",
  );
  await center(page);
  const state = await snap(page);
  expect(state.error).toBeNull();
  expect(state.points[1].y).toBe(state.points[0].y);
  expect(state.points[0].x - state.points[1].x).toBeGreaterThanOrEqual(12);
  expect(state.targetLeg - state.markerSize - 1).toBeGreaterThanOrEqual(6);
  expect(state.points.length - 2).toBeLessThanOrEqual(3);
  await page.screenshot({ path: info.outputPath("start-left-visible-stub.png") });
});
test("bottom-to-bottom drop resolves target first and persists the final ports through history and load", async ({
  page,
}, info) => {
  await ready(page);
  const ids = await seed(
    page,
    "StartEvent",
    "MessageEvent",
    { x: 300, y: 180 },
    { x: 290, y: 380 },
    "out-bottom",
    "out-bottom",
    false,
  );
  await page.evaluate((ids) => {
    const d = (window as any).designer;
    d.document.getContent().getNode(ids.a).getRelation().removeEdgeById("visual-edge");
    d.document.getTimeline().reset();
    (window as any).__visualRejected = [];
    (window as any).__visualDegraded = [];
    d.graph.on("edge:routing:degraded", (event: any) =>
      (window as any).__visualDegraded.push(event),
    );
    d.graph.on("connection:rejected", (e: any) => (window as any).__visualRejected.push(e));
    const g = d.graph.getX6Graph();
    g.zoomTo(1);
    g.centerCell(g.getCellById(ids.a));
  }, ids);
  await frame(page);
  const p = await page.evaluate((ids) => {
    const d = (window as any).designer,
      g = d.graph.getX6Graph();
    const at = (id: string, port: string) => {
      const n = g.getCellById(id),
        def = n.getPort(port),
        offset = n.getPortsPosition(def.group)[port].position,
        pos = n.position();
      return d.graph.localToClient(pos.x + offset.x, pos.y + offset.y);
    };
    return { a: at(ids.a, "out-bottom"), b: at(ids.b, "out-bottom") };
  }, ids);
  await page.mouse.move(p.a.x, p.a.y - 10);
  await page.mouse.move(p.a.x, p.a.y);
  await page.mouse.down();
  await page.mouse.move(p.b.x, p.b.y, { steps: 20 });
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
  const resolved = await page.evaluate((ids) => {
    const d = (window as any).designer,
      r = d.document.getContent().getNode(ids.a).getRelation().getEdges()[0];
    return {
      id: r.id,
      source: r.sourcePort,
      target: r.targetPort,
      rejected: (window as any).__visualRejected.length,
    };
  }, ids);
  expect(resolved.source).toBe("out-bottom");
  expect(resolved.target).toBe("in-top");
  expect(resolved.rejected).toBe(0);
  expect(await page.evaluate(() => (window as any).__visualDegraded.length)).toBe(0);
  await frame(page);
  await expect(page.locator(".ant-message-warning")).toHaveCount(0);
  await page.evaluate((id) => {
    const d = (window as any).designer,
      g = d.graph.getX6Graph();
    g.zoomTo(2);
    g.centerCell(g.getCellById(id));
  }, resolved.id);
  await frame(page);
  const state = await snap(page, resolved.id);
  expect(state.error).toBeNull();
  expect(state.points.length - 2).toBeLessThanOrEqual(3);
  expect(state.sourceLeg).toBeGreaterThanOrEqual(12);
  expect(state.targetLeg - state.markerSize - 1).toBeGreaterThanOrEqual(6);
  await page.screenshot({ path: info.outputPath("bottom-drop-auto-target-top.png") });
  await page.evaluate(() => (window as any).designer.document.getTimeline().back());
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as any).designer.document.getContent().getNode(id).getRelation().getEdges()
            .length,
        ids.a,
      ),
    )
    .toBe(0);
  await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
  await expect.poll(async () => (await snap(page, resolved.id)).target).toBe("in-top");
  await page.evaluate(() => {
    const d = (window as any).designer;
    d.document.load(d.document.getData());
  });
  await expect.poll(async () => (await snap(page, resolved.id)).target).toBe("in-top");
  expect((await snap(page, resolved.id)).source).toBe("out-bottom");
});
