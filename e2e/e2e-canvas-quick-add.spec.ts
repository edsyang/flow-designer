import { expect, test } from "@playwright/test";

test.describe("Canvas quick add", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForFunction(() =>
      Boolean((window as unknown as { designer?: { graph: unknown } }).designer?.graph),
    );
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(2);
  });

  test("double-click adds a registered node at the pointer and selects it", async ({ page }) => {
    const canvas = page.locator('[data-fd-area="canvas"]');
    const canvasBounds = await canvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    if (!canvasBounds) return;

    const nodeCountBefore = await page.locator(".x6-graph .x6-cell.x6-node").count();
    const clickPoint = {
      x: canvasBounds.width - 80,
      y: canvasBounds.height - 80,
    };
    await canvas.dblclick({ position: clickPoint });

    const panel = page.locator('[data-fd-area="canvasQuickAdd"]');
    await expect(panel).toBeVisible();
    expect(await canvas.boundingBox()).toEqual(canvasBounds);
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    if (!panelBounds) return;
    expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(
      canvasBounds.x + canvasBounds.width + 1,
    );
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(
      canvasBounds.y + canvasBounds.height + 1,
    );
    await expect(panel.getByRole("button", { name: /开始/ })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /结束/ })).toHaveCount(0);
    await panel.getByRole("button", { name: /人工节点/ }).click();

    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(nodeCountBefore + 1);
    await expect(page.locator(".x6-graph .x6-cell.x6-node-selected")).toContainText("人工节点");
    await expect(panel).toHaveCount(0);
  });

  test("search supports keyboard creation, Escape focus return and outside focus", async ({
    page,
  }) => {
    const canvas = page.locator('[data-fd-area="canvas"]');
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Canvas bounds unavailable");
    await canvas.focus();
    await canvas.press("Enter");
    const panel = page.getByRole("dialog", { name: "添加节点" });
    const search = panel.getByRole("textbox", { name: "搜索已注册节点" });
    await expect(search).toBeFocused();
    await search.fill("不存在的节点");
    await expect(panel.getByText("没有匹配的节点")).toBeVisible();
    await search.fill("人工");
    await search.press("ArrowDown");
    await expect(panel.getByRole("button", { name: /人工节点/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel).toHaveCount(0);
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(3);
    await expect(page.locator(".x6-node-selected")).toContainText("人工节点");
    await canvas.focus();
    await canvas.dblclick({ position: { x: 80, y: bounds.height - 160 } });
    await expect(search).toBeFocused();
    await search.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await canvas.dblclick({ position: { x: 80, y: bounds.height - 160 } });
    const librarySearch = page.getByRole("textbox", { name: "搜索节点库" });
    await librarySearch.click();
    await expect(panel).toHaveCount(0);
    await expect(librarySearch).toBeFocused();
    await librarySearch.press("Enter");
    await expect(panel).toHaveCount(0);
  });

  test("dock tools track interaction mode and stay the same size across zoom", async ({ page }) => {
    const select = page.getByRole("button", { name: "选择工具", exact: true });
    const pan = page.getByRole("button", { name: "平移工具", exact: true });
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await pan.click();
    await expect(pan).toHaveAttribute("aria-pressed", "true");
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    const before = await select.boundingBox();
    await page.getByRole("button", { name: "放大", exact: true }).click();
    const after = await select.boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  });

  test("selection has no floating action popup and keyboard copy, paste, delete and undo remain available", async ({
    page,
  }) => {
    const canvas = page.locator('[data-fd-area="canvas"]');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Canvas bounds unavailable");
    await canvas.dblclick({
      position: { x: Math.min(440, bounds.width / 2), y: bounds.height - 160 },
    });
    await page.getByRole("textbox", { name: "搜索已注册节点" }).fill("人工");
    await page.getByRole("textbox", { name: "搜索已注册节点" }).press("Enter");
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(3);
    const toolbar = page.getByRole("toolbar", { name: "选中项操作" });
    await expect(toolbar).toHaveCount(0);
    await canvas.focus();
    await canvas.press("ControlOrMeta+c");
    await canvas.press("ControlOrMeta+v");
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(4);
    await canvas.press("Delete");
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(3);
    await canvas.press("ControlOrMeta+z");
    await expect(page.locator(".x6-graph .x6-cell.x6-node")).toHaveCount(4);
    await page.locator(".x6-node").filter({ hasText: "人工节点" }).first().click();
    await canvas.click({ position: { x: 80, y: bounds.height - 160 } });
    await expect(toolbar).toHaveCount(0);
    await expect(page.locator(".x6-node-selected")).toHaveCount(0);
  });

  test("help is modal, traps keyboard focus and restores its dock trigger", async ({ page }) => {
    const help = page.getByRole("button", { name: "操作帮助", exact: true });
    await help.click();
    const dialog = page.getByRole("dialog", { name: "画布操作帮助" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (let index = 0; index < 5; index += 1) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(help).toBeFocused();
    await help.click();
    await expect(dialog).toBeVisible();
    await page.locator(".ant-modal-wrap").click({ position: { x: 10, y: 10 } });
    await expect(dialog).toHaveCount(0);
    await expect(help).toBeFocused();
  });

  test("zoom slider follows graph changes and narrow configured selections reopen properties", async ({
    page,
  }) => {
    const slider = page.getByRole("slider", { name: "缩放比例" });
    await slider.fill("150");
    await expect(slider).toHaveAttribute("aria-valuetext", "150%");
    await page.getByRole("button", { name: "缩小", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuetext", "140%");
    await page.setViewportSize({ width: 543, height: 900 });
    await page.reload();
    await expect(page.getByRole("button", { name: "展开属性", exact: true })).toBeVisible();
    const canvas = page.locator('[data-fd-area="canvas"]');
    await canvas.focus();
    await canvas.press("Enter");
    const search = page.getByRole("textbox", { name: "搜索已注册节点" });
    await search.fill("人工");
    await search.press("Enter");
    await expect(page.locator(".x6-node-selected")).toContainText("人工节点");
    await expect(page.getByRole("button", { name: "收起属性", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "收起属性", exact: true }).click();
    const dock = await page.locator('[data-fd-area="canvasToolbar"]').boundingBox();
    expect(dock).not.toBeNull();
    expect(dock!.x).toBeGreaterThanOrEqual(0);
    expect(dock!.x + dock!.width).toBeLessThanOrEqual(543);
  });
});
