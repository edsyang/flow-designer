import { expect, test, type Page } from "@playwright/test";
import type { Designer, GenericRelation } from "@flow-designer/engine";
import { seedBpmnEdge } from "./workbench-fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("flow-designer:locale", "zh-CN");
    if (!localStorage.getItem("flow-designer:theme"))
      localStorage.setItem("flow-designer:theme", "light");
  });
});

async function open(page: Page, port = 5179) {
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForFunction(() =>
    Boolean((window as unknown as { designer?: Designer }).designer?.graph),
  );
}

for (const port of [5179, 5180, 5181]) {
  test(`header title and schema follow both themes in app ${port}`, async ({ page }) => {
    await open(page, port);
    const header = page.locator('[data-fd-area="header"]');
    const title = header.locator('[data-fd-item="app-title"] > span');
    await expect(title).toHaveCSS("color", "rgb(32, 42, 62)");
    const controls = header.locator("button");
    const heights = await controls.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThanOrEqual(4);
    expect(new Set(heights).size).toBe(1);
    for (const theme of ["dark", "light"] as const) {
      await header
        .getByRole("button", { name: theme === "dark" ? "切换到深色模式" : "切换到浅色模式" })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-fd-theme", theme);
      const text = theme === "dark" ? "rgb(231, 235, 243)" : "rgb(32, 42, 62)";
      await expect(title).toHaveCSS("color", text);
      await header.getByRole("button", { name: "点击查看 Schema", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Schema", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("pre")).toContainText("{");
      const colors = await dialog.locator("pre").evaluate((element) => ({
        color: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
      }));
      expect(colors.color).not.toBe(colors.background);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await header.getByRole("button", { name: "切换到深色模式" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-fd-theme", "dark");
    await expect(title).toHaveCSS("color", "rgb(231, 235, 243)");
  });
}

test("dock follows only sidebar disclosure without moving the graph viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await open(page);
  const canvas = page.locator('[data-fd-area="canvas"]');
  const sidebar = page.locator('[data-fd-area="sidebar"]');
  const dock = page.locator('[data-fd-area="canvasToolbar"]');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const snapshot = () =>
    page.evaluate(() => {
      const designer = (window as unknown as { designer: Designer }).designer;
      return {
        zoom: designer.graph!.getZoom(),
        translation: designer.graph!.getX6Graph().translate(),
        positions: designer.document
          .getContent()
          .getNodes()
          .map((node) => ({ id: node.getId(), position: node.getPosition() })),
      };
    });
  const before = await snapshot();
  const check = async (leftExpanded: boolean) => {
    const bounds = await canvas.boundingBox();
    const left = leftExpanded ? await sidebar.boundingBox() : null;
    if (!bounds || (leftExpanded && !left)) throw new Error("Panel bounds missing");
    const expected =
      ((leftExpanded ? left!.x + left!.width : bounds.x) + (bounds.x + bounds.width)) / 2;
    await expect
      .poll(async () => {
        const box = await dock.boundingBox();
        return box ? Math.abs(box.x + box.width / 2 - expected) : Infinity;
      })
      .toBeLessThan(1);
    expect(await snapshot()).toEqual(before);
  };
  expect(
    await sidebar.evaluate((element) => element.parentElement?.getAttribute("data-fd-layout")),
  ).toBe("canvasWorkspace");
  await check(true);
  await page.getByRole("button", { name: "收起属性", exact: true }).click();
  await check(true);
  await page.getByRole("button", { name: "展开属性", exact: true }).click();
  await check(true);
  await page.getByRole("button", { name: "节点库", exact: true }).click();
  await check(false);
  await page.getByRole("button", { name: "收起属性", exact: true }).click();
  await check(false);
  await page.getByRole("button", { name: "展开节点库", exact: true }).click();
  await check(true);
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.engine.skeleton.sidebar.setVisible(
      false,
    ),
  );
  await expect(sidebar).toHaveCount(0);
  await check(false);
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.engine.skeleton.sidebar.setVisible(true),
  );
  await check(true);
  await page.setViewportSize({ width: 543, height: 900 });
  await expect
    .poll(async () => {
      const small = await dock.boundingBox();
      return small !== null && small.x >= 0 && small.x + small.width <= 543;
    })
    .toBe(true);
});

test("the same selected connection translates its editor without rewriting its name", async ({
  page,
}) => {
  await open(page);
  const id = await seedBpmnEdge(page);
  await page.evaluate((id) => {
    const designer = (window as unknown as { designer: Designer }).designer;
    for (const node of designer.document.getContent().getNodes()) {
      const relation = node.getRelation() as GenericRelation;
      if (relation.getEdgeById(id))
        relation.updateEdgeProps(id, { name: "My unchanged connection" });
    }
    designer.graph!.select([id]);
    designer.document.getSelection().setKeys([id]);
  }, id);
  const inspector = page.locator('[data-fd-area="inspector"]');
  await expect(inspector.getByText("条件表达式", { exact: true })).toBeVisible();
  const name = inspector.locator("input");
  await expect(name).toHaveValue("My unchanged connection");
  await page.getByRole("button", { name: "语言", exact: true }).click();
  await page.getByRole("menuitem", { name: "英语", exact: true }).click();
  await expect(inspector.getByText("Condition expression", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Sequence", { exact: true })).toBeVisible();
  await expect(name).toHaveValue("My unchanged connection");
  expect(
    await page.evaluate(() =>
      (window as unknown as { designer: Designer }).designer.document.getSelection().getKeys(),
    ),
  ).toEqual([id]);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitem", { name: "Simplified Chinese", exact: true }).click();
  await expect(inspector.getByText("条件表达式", { exact: true })).toBeVisible();
  await expect(name).toHaveValue("My unchanged connection");
});

test("BPMN palette defaults and caller colours survive theme changes without document/history mutations", async ({
  page,
}) => {
  await open(page);
  const id = await seedBpmnEdge(page);
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  expect(
    await page.evaluate(
      (id) =>
        (window as unknown as { designer: Designer }).designer
          .graph!.getX6Graph()
          .getCellById(id)
          .attr("line/stroke"),
      id,
    ),
  ).toBe("#7d8aa0");
  await page.getByRole("button", { name: "切换到浅色模式" }).click();
  await page.evaluate((id) => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const graph = designer.graph!.getX6Graph();
    const edge = graph.getCellById(id);
    const node = graph.getCellById(edge.getSourceCellId());
    node.attr({ body: { fill: "#cc8844", stroke: "#aa2277" }, label: { fill: "#225588" } });
    edge.attr("line/stroke", "#22aa77");
    designer.graph!.zoomTo(0.7);
    designer.graph!.select([node.id, id]);
  }, id);
  const snapshot = () =>
    page.evaluate(() => {
      const designer = (window as unknown as { designer: Designer }).designer;
      return {
        data: designer.document.getData(),
        points: designer.document.getTimeline().getPoints().length,
        selection: designer.graph!.getSelection(),
        zoom: designer.graph!.getZoom(),
      };
    });
  const before = await snapshot();
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  expect(await snapshot()).toEqual(before);
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.graph!.select([]),
  );
  const colours = await page.evaluate((id) => {
    const graph = (window as unknown as { designer: Designer }).designer.graph!.getX6Graph();
    const edge = graph.getCellById(id);
    const node = graph.getCellById(edge.getSourceCellId());
    return {
      fill: node.attr("body/fill"),
      stroke: node.attr("body/stroke"),
      label: node.attr("label/fill"),
      edge: edge.attr("line/stroke"),
    };
  }, id);
  expect(colours).toEqual({
    fill: "#cc8844",
    stroke: "#aa2277",
    label: "#225588",
    edge: "#22aa77",
  });
});

for (const width of [1440, 800, 543, 320]) {
  test(`inspector scrolls above the dock in a short ${width}px workbench`, async ({ page }) => {
    await page.setViewportSize({ width, height: 360 });
    await open(page);
    const inspector = page.locator('[data-fd-area="inspector"]');
    const expand = inspector.getByRole("button", { name: "展开属性", exact: true });
    if (await expand.isVisible()) await expand.click();
    await expect(inspector.getByRole("button", { name: "收起属性", exact: true })).toBeVisible();
    const dock = page.locator('[data-fd-area="canvasToolbar"]');
    await expect
      .poll(async () => {
        const panel = await inspector.boundingBox();
        const tools = await dock.boundingBox();
        return panel && tools ? tools.y - panel.y - panel.height : -Infinity;
      })
      .toBeGreaterThanOrEqual(11);
    expect(await inspector.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    const libraryToggle = page.locator('[data-fd-area="sidebar"] > button');
    if ((await libraryToggle.getAttribute("aria-expanded")) === "false")
      await libraryToggle.click();
    await expect
      .poll(() =>
        dock.locator('button, input[type="range"]').evaluateAll((controls) =>
          controls.every((control) => {
            const rect = control.getBoundingClientRect();
            const target = document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            );
            return target !== null && target.closest('[data-fd-area="canvasToolbar"]') !== null;
          }),
        ),
      )
      .toBe(true);
    if (width === 800) await page.screenshot({ path: "/private/tmp/flow-workspace-layout.png" });
    const before = await page.evaluate(() => {
      const designer = (window as unknown as { designer: Designer }).designer;
      const scroller = document.querySelector(".x6-graph-scroller")!;
      return {
        zoom: designer.graph!.getZoom(),
        translation: designer.graph!.getX6Graph().translate(),
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
    });
    const panel = await inspector.boundingBox();
    if (!panel) throw new Error("Inspector bounds unavailable");
    await inspector.hover({ position: { x: panel.width - 5, y: Math.min(60, panel.height - 10) } });
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(inspector.getByRole("switch")).toBeInViewport();
    const after = await page.evaluate(() => {
      const designer = (window as unknown as { designer: Designer }).designer;
      const scroller = document.querySelector(".x6-graph-scroller")!;
      return {
        zoom: designer.graph!.getZoom(),
        translation: designer.graph!.getX6Graph().translate(),
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
    });
    expect(after).toEqual(before);
    const tools = await dock.boundingBox();
    expect(tools).not.toBeNull();
    expect(tools!.x).toBeGreaterThanOrEqual(0);
    expect(tools!.x + tools!.width).toBeLessThanOrEqual(width);
  });
}
