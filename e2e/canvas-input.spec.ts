import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const designer = (window as any).designer;
    const nodes = designer.document.getContent().getNodes();
    const manager = designer.graph;
    return {
      nodes: nodes.map((node: any) => {
        const position = node.getPosition();
        const client = manager.localToClient(position.x, position.y);
        const element = document.querySelector(`.x6-graph [data-cell-id="${node.getId()}"]`)!;
        const box = element.getBoundingClientRect();
        return {
          id: node.getId(),
          position,
          client,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      }),
      selection: designer.document.getSelection().getKeys(),
      graphSelection: manager.getSelection(),
      zoom: manager.getZoom(),
    };
  });
}

async function startPanelDrag(page: Page) {
  const item = page
    .locator('[data-fd-area="sidebar"] [class*="_item_"]')
    .filter({ hasText: "人工节点" })
    .first();
  await expect(item).toBeVisible();
  const box = await item.boundingBox();
  if (!box) throw new Error("Missing panel node");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).designer?.graph));
  await expect(page.locator(".x6-graph .x6-node")).toHaveCount(2);
});

test("panel entry and mid-canvas drop preserve existing screen positions and select the created model node", async ({
  page,
}) => {
  const before = await snapshot(page);
  const viewport = await page.locator(".x6-graph-scroller").boundingBox();
  if (!viewport) throw new Error("Missing viewport");
  const point = {
    x: viewport.x + viewport.width * 0.45,
    y: viewport.y + viewport.height * 0.65,
  };
  await startPanelDrag(page);
  await page.mouse.move(point.x, point.y, { steps: 20 });
  const during = await snapshot(page);
  expect(during.nodes).toEqual(before.nodes);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).nodes.length).toBe(3);
  const after = await snapshot(page);
  expect(after.nodes.slice(0, 2)).toEqual(before.nodes);
  const added = after.nodes[2]!;
  expect(Math.abs(added.box.x + added.box.width / 2 - point.x)).toBeLessThanOrEqual(10);
  expect(Math.abs(added.box.y + added.box.height / 2 - point.y)).toBeLessThanOrEqual(10);
  expect(after.selection).toEqual([added.id]);
  expect(after.graphSelection).toEqual([added.id]);
  await expect(page.locator('[data-fd-area="inspector"]')).toBeVisible();
  console.info(
    "panel-drop-screen-evidence",
    JSON.stringify({
      before: before.nodes,
      after: after.nodes,
      point,
      selection: after.selection,
    }),
  );
});

test("panel edge dwell delays panning, continues while stationary and stops after leaving the edge", async ({
  page,
}) => {
  const before = await snapshot(page);
  const viewport = await page.locator(".x6-graph-scroller").boundingBox();
  if (!viewport) throw new Error("Missing viewport");
  await startPanelDrag(page);
  await page.mouse.move(viewport.x + 5, viewport.y + 140, { steps: 10 });
  await page.waitForTimeout(200);
  const short = await snapshot(page);
  expect(short.nodes).toEqual(before.nodes);
  await page.waitForTimeout(380);
  const dwell = await snapshot(page);
  expect(dwell.nodes[0]!.client).not.toEqual(before.nodes[0]!.client);
  await page.waitForTimeout(80);
  const continuous = await snapshot(page);
  expect(continuous.nodes[0]!.client).not.toEqual(dwell.nodes[0]!.client);
  await page.mouse.move(viewport.x + viewport.width * 0.4, viewport.y + viewport.height * 0.6);
  const left = await snapshot(page);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).nodes).toEqual(left.nodes);
  await page.mouse.up();
  console.info(
    "edge-dwell-screen-evidence",
    JSON.stringify({
      before: before.nodes[0],
      short: short.nodes[0],
      dwell: dwell.nodes[0],
      continuous: continuous.nodes[0],
    }),
  );
});

test("plain wheel and trackpad pinch zoom continuously below thirty percent, while panels and help do not", async ({
  page,
}) => {
  const viewport = await page.locator(".x6-graph-scroller").boundingBox();
  if (!viewport) throw new Error("Missing viewport");
  const point = {
    x: viewport.x + viewport.width * 0.5,
    y: viewport.y + viewport.height * 0.65,
  };
  await page.evaluate(() => (window as any).designer.graph.zoomTo(0.12));
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -50);
  await expect.poll(async () => (await snapshot(page)).zoom).toBeGreaterThan(0.12);
  const plain = (await snapshot(page)).zoom;
  expect(plain).toBeLessThan(0.2);
  await page.locator(".x6-graph").dispatchEvent("wheel", {
    deltaY: -15,
    clientX: point.x,
    clientY: point.y,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  await expect.poll(async () => (await snapshot(page)).zoom).toBeGreaterThan(plain);
  const zoom = (await snapshot(page)).zoom;
  await page
    .locator('[data-fd-area="sidebar"]')
    .dispatchEvent("wheel", { deltaY: -80, bubbles: true, cancelable: true });
  await page
    .locator('[data-fd-area="inspector"]')
    .dispatchEvent("wheel", { deltaY: -80, bubbles: true, cancelable: true });
  await page.waitForTimeout(100);
  expect((await snapshot(page)).zoom).toBe(zoom);
  await page.getByRole("button", { name: "操作帮助" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").dispatchEvent("wheel", {
    deltaY: -80,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(100);
  expect((await snapshot(page)).zoom).toBe(zoom);
});

test("an existing node pans immediately at the canvas edge and persists the released position", async ({
  page,
}) => {
  const before = await snapshot(page);
  const viewport = await page.locator(".x6-graph-scroller").boundingBox();
  if (!viewport) throw new Error("Missing viewport");
  const node = before.nodes[0]!;
  await page.mouse.move(node.box.x + node.box.width / 2, node.box.y + node.box.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 5, node.box.y + node.box.height / 2, {
    steps: 15,
  });
  await expect
    .poll(async () => (await snapshot(page)).nodes[1]!.client, {
      timeout: 300,
      intervals: [10, 20, 30],
    })
    .not.toEqual(before.nodes[1]!.client);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const designer = (window as any).designer;
        return designer.graph.getX6Graph().getCellById(id).position();
      }, node.id),
    )
    .toEqual((await snapshot(page)).nodes[0]!.position);
  console.info(
    "existing-node-edge-pan",
    JSON.stringify({
      before: before.nodes,
      after: (await snapshot(page)).nodes,
    }),
  );
});
