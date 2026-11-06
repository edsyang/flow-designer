import { expect, test } from "@playwright/test";
import { seedBpmnEdge } from "./workbench-fixtures";

test("hover preserves routing and segment drag preserves anchored ports through undo and redo", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5179");
  const id = await seedBpmnEdge(page);
  await page.evaluate((id) => {
    const d = (window as any).designer,
      g = d.graph.getX6Graph(),
      edge = g.getCellById(id);
    d.document.getContent().getNode(edge.getSourceCellId()).setPosition(250, 100);
  }, id);
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).designer.document.getTimeline().reset());
  const snapshot = () =>
    page.evaluate((id) => {
      const designer = (window as any).designer;
      const graph = designer.graph.getX6Graph();
      const edge = graph.getCellById(id);
      const relation = designer.document
        .getContent()
        .getNode(edge.getSourceCellId())
        .getRelation()
        .getEdgeById(id);
      const view = graph.findViewByCell(edge);
      const anchors = {
        source: { x: view.sourcePoint.x, y: view.sourcePoint.y },
        target: { x: view.targetPoint.x, y: view.targetPoint.y },
      };
      const path = view.container.querySelector("path[d]") as SVGPathElement;
      const matrix = path.getScreenCTM()!;
      const start = path.getPointAtLength(0).matrixTransform(matrix);
      const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
      const sourcePosition = designer.document
        .getContent()
        .getNode(edge.getSourceCellId())
        .getPosition();
      const graphPosition = graph.getCellById(edge.getSourceCellId()).position();
      return {
        anchors,
        sourcePosition,
        graphPosition,
        source: edge.getSource(),
        target: edge.getTarget(),
        vertices: edge.getVertices(),
        router: edge.getRouter(),
        relation,
        d: path.getAttribute("d"),
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
      };
    }, id);
  const before = await snapshot();
  const point = await page
    .locator(`.x6-edge[data-cell-id="${id}"] path[d]`)
    .first()
    .evaluate((path: SVGPathElement) => {
      const p = path
        .getPointAtLength(path.getTotalLength() / 2)
        .matrixTransform(path.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(".x6-edge-tool-segment:visible").first()).toBeVisible();
  const hover = await snapshot();
  expect(hover.vertices).toEqual(before.vertices);
  expect(hover.router).toEqual(before.router);
  expect(hover.d).toBe(before.d);
  const handles = page.locator(".x6-edge-tool-segment:visible");
  const vertical = await handles.evaluateAll((els) =>
    els.findIndex((el) => getComputedStyle(el).cursor === "col-resize"),
  );
  expect(vertical).toBeGreaterThanOrEqual(0);
  const handle = handles.nth(vertical);
  const box = await handle.boundingBox();
  if (!box) throw new Error("No segment handle");
  const historyBeforeClick = await page.evaluate(
    () => (window as any).designer.document.getTimeline().getPoints().length,
  );
  await handle.click();
  expect((await snapshot()).router).toEqual(before.router);
  expect((await snapshot()).vertices).toEqual(before.vertices);
  expect(
    await page.evaluate(() => (window as any).designer.document.getTimeline().getPoints().length),
  ).toBe(historyBeforeClick);
  const cursor = await handle.evaluate((el) => getComputedStyle(el).cursor);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x + (cursor === "col-resize" ? 45 : 0),
    start.y + (cursor === "col-resize" ? 0 : 45),
    { steps: 12 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await snapshot()).relation.vertices?.length ?? 0)
    .toBeGreaterThan(0);
  const edited = await snapshot();
  expect(edited.source).toEqual(before.source);
  expect(edited.target).toEqual(before.target);
  expect(edited.relation.sourcePort).toBe(before.relation.sourcePort);
  expect(edited.relation.targetPort).toBe(before.relation.targetPort);
  expect(edited.relation.vertices).toEqual(edited.vertices);
  expect(edited.anchors).toEqual(before.anchors);
  expect(Math.hypot(edited.start.x - before.start.x, edited.start.y - before.start.y)).toBeLessThan(
    2,
  );
  expect(Math.hypot(edited.end.x - before.end.x, edited.end.y - before.end.y)).toBeLessThan(2);
  await page.mouse.move(10, 10);
  await page.evaluate(() => (window as any).designer.document.getTimeline().back());
  await expect
    .poll(async () => (await snapshot()).relation.vertices ?? [])
    .toEqual(before.relation.vertices ?? []);
  await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
  await expect
    .poll(async () => (await snapshot()).relation.vertices)
    .toEqual(edited.relation.vertices);
  const restored = await snapshot();
  expect(restored.source).toEqual(before.source);
  expect(restored.target).toEqual(before.target);
  expect(restored.vertices).toEqual(edited.vertices);
  const sourceNode = page.locator(`.x6-node[data-cell-id="${before.source.cell}"]`);
  const nodeBox = await sourceNode.boundingBox();
  if (!nodeBox) throw new Error("Source node not visible");
  const nodeStart = {
    x: nodeBox.x + nodeBox.width / 2,
    y: nodeBox.y + nodeBox.height / 2,
  };
  await page.mouse.move(nodeStart.x, nodeStart.y);
  await page.mouse.down();
  await page.mouse.move(nodeStart.x + 440, nodeStart.y - 100, { steps: 10 });
  await page.mouse.up();
  const moved = await snapshot();
  expect(moved.sourcePosition).not.toEqual(restored.sourcePosition);
  expect(moved.graphPosition).toEqual(moved.sourcePosition);
  expect(moved.anchors.source).not.toEqual(restored.anchors.source);
  expect(moved.source.port).toBe("out-bottom");
  expect(moved.target.port).toBe("in-top");
  expect(moved.relation.sourcePort).toBe(moved.source.port);
  expect(moved.relation.targetPort).toBe(moved.target.port);
  expect(moved.relation.vertices).toEqual([]);
  expect(moved.vertices).toEqual([]);
  const points = Array.from(
    (moved.d ?? "").matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g),
    (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
  );
  expect(points.length).toBeGreaterThan(1);
  for (let i = 1; i < points.length; i++)
    expect(
      Math.min(
        Math.abs(points[i]!.x - points[i - 1]!.x),
        Math.abs(points[i]!.y - points[i - 1]!.y),
      ),
    ).toBeLessThan(1);
  await page.evaluate(() => (window as any).designer.document.getTimeline().back());
  await expect.poll(async () => (await snapshot()).sourcePosition).toEqual(restored.sourcePosition);
  expect((await snapshot()).vertices).toEqual(edited.vertices);
  expect((await snapshot()).source).toEqual(before.source);
  await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
  await expect.poll(async () => (await snapshot()).sourcePosition).toEqual(moved.sourcePosition);
  expect((await snapshot()).source).toEqual(moved.source);
  expect((await snapshot()).vertices).toEqual([]);
  const saved = await page.evaluate(() => (window as any).designer.document.getData());
  await page.evaluate((data) => (window as any).designer.document.load(data), saved);
  const loaded = await snapshot();
  expect(loaded.relation.vertices ?? []).toEqual([]);
  expect(loaded.source).toEqual(moved.source);
  expect(loaded.target).toEqual(moved.target);
});
