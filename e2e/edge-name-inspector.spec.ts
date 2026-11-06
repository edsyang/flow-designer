import { expect, test } from "@playwright/test";

test("connection names stay in the inspector and never open a canvas double-click editor", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5179");
  await page.waitForFunction(() => Boolean((window as any).designer?.graph));
  await page.evaluate(async () => {
    const designer = (window as any).designer;
    const content = designer.document.getContent();
    for (const node of [...content.getNodes()]) await content.removeNode(node);
    const source = await content.addNode({
      id: "metadata-source",
      type: "UserTask",
      props: { __position: { x: 350, y: 250 } },
    });
    await content.addNode({
      id: "metadata-target",
      type: "UserTask",
      props: { __position: { x: 700, y: 250 } },
    });
    source.getRelation().addEdge({
      id: "metadata-edge",
      targetNodeId: "metadata-target",
      sourcePort: "out-right",
      targetPort: "in-left",
      type: "SequenceFlow",
      props: { name: "Stored connection name", label: "Legacy name alias" },
    });
    designer.graph.centerContent();
  });
  const read = () =>
    page.evaluate(() => {
      const designer = (window as any).designer;
      const graph = designer.graph.getX6Graph();
      const edge = graph.getCellById("metadata-edge");
      const path = graph.findViewByCell(edge)?.findOne("line") as SVGPathElement | undefined;
      const matrix = path?.getScreenCTM();
      if (!path || !matrix || !path.getTotalLength()) return null;
      const point = path.getPointAtLength(path.getTotalLength() / 2);
      const client = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return {
        x: client.x,
        y: client.y,
        hit: document
          .elementFromPoint(client.x, client.y)
          ?.closest("[data-cell-id]")
          ?.getAttribute("data-cell-id"),
        labels: edge.getLabels(),
        text: graph.container.textContent,
      };
    });
  await expect.poll(async () => (await read())?.hit).toBe("metadata-edge");
  const point = (await read())!;
  expect(point.labels).toEqual([]);
  expect(point.text).not.toContain("Stored connection name");
  expect(point.text).not.toContain("Legacy name alias");
  await page.mouse.click(point.x, point.y);
  const inspector = page.locator('[data-fd-area="inspector"]');
  const name = inspector.locator("input").first();
  await expect(name).toHaveValue("Stored connection name");
  const before = await page.evaluate(() => (window as any).designer.document.getData());
  await expect.poll(async () => (await read())?.hit).toBe("metadata-edge");
  const doubleClickPoint = (await read())!;
  await page.mouse.dblclick(doubleClickPoint.x, doubleClickPoint.y);
  await expect(page.locator('[data-fd-area="canvasQuickAdd"]')).toHaveCount(0);
  await expect(
    page.locator(
      '[data-fd-area="canvas"] input, [data-fd-area="canvas"] textarea, [data-fd-area="canvas"] [contenteditable="true"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).designer.document.getData())).toEqual(before);
  await name.fill("Changed connection metadata");
  await name.press("Tab");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).designer.document
            .getContent()
            .getNode("metadata-source")
            .getRelation()
            .getEdgeById("metadata-edge").props.name,
      ),
    )
    .toBe("Changed connection metadata");
  await page.evaluate(() => {
    const doc = (window as any).designer.document;
    doc.load(doc.save());
  });
  await expect.poll(async () => (await read())?.labels).toEqual([]);
  const saved = await page.evaluate(
    () =>
      (window as any).designer.document
        .getContent()
        .getNode("metadata-source")
        .getRelation()
        .getEdgeById("metadata-edge").props,
  );
  expect(saved.name).toBe("Changed connection metadata");
  expect(saved.label).toBe("Changed connection metadata");
  expect((await read())?.text).not.toContain("Changed connection metadata");
});
