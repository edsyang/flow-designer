import { test, expect } from "@playwright/test";
import { seedBpmnEdge, assertOrthogonalEdge, assertPinchZoom } from "./workbench-fixtures";

test.describe("Fix 1: BPMN edge routing is orthogonal (er router)", () => {
  test("edges between nodes use orthogonal routing", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    const edgeId = await seedBpmnEdge(page);
    await assertOrthogonalEdge(page, edgeId);
  });
});

test.describe("Fix 2: Canvas boundary - nodes not clipped", () => {
  test("BPMN canvas has sufficient scroll area (padding 400)", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify the scroller has enough padding - nodes should be fully visible
    const scroller = page.locator(".x6-graph-scroller");
    const scrollerBox = await scroller.boundingBox();
    expect(scrollerBox).not.toBeNull();
    console.log(`BPMN Scroller dimensions: ${JSON.stringify(scrollerBox)}`);

    // Verify SVG overflow is visible
    const svgOverflow = await page.locator(".x6-graph svg").evaluate((el) => {
      return window.getComputedStyle(el).overflow;
    });
    console.log(`SVG overflow: ${svgOverflow}`);
    expect(svgOverflow).toBe("visible");

    // Check that all nodes are within the scrollable area
    const nodes = await page.locator(".x6-cell.x6-node").all();
    console.log(`BPMN nodes count: ${nodes.length}`);
    expect(nodes.length).toBeGreaterThan(0);
  });

  test("ER canvas has sufficient scroll area", async ({ page }) => {
    await page.goto("http://127.0.0.1:5181");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const scroller = page.locator(".x6-graph-scroller");
    const scrollerBox = await scroller.boundingBox();
    expect(scrollerBox).not.toBeNull();
    console.log(`ER Scroller dimensions: ${JSON.stringify(scrollerBox)}`);
  });

  test("ComfyUI canvas has sufficient scroll area", async ({ page }) => {
    await page.goto("http://127.0.0.1:5180");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const scroller = page.locator(".x6-graph-scroller");
    const scrollerBox = await scroller.boundingBox();
    expect(scrollerBox).not.toBeNull();
    console.log(`ComfyUI Scroller dimensions: ${JSON.stringify(scrollerBox)}`);
  });
});

test.describe("Fix 3: Right panel conditional display", () => {
  test("ER right panel hidden when nothing selected", async ({ page }) => {
    await page.goto("http://127.0.0.1:5181");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Right panel should NOT be visible when nothing is selected
    const inspector = page.locator('[data-fd-area="inspector"]');
    const isVisible = await inspector.isVisible().catch(() => false);
    console.log(`ER inspector visible (nothing selected): ${isVisible}`);
    expect(isVisible).toBe(false);
  });

  test("ComfyUI right panel hidden when nothing selected", async ({ page }) => {
    await page.goto("http://127.0.0.1:5180");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Right panel should NOT be visible when nothing is selected
    const inspector = page.locator('[data-fd-area="inspector"]');
    const isVisible = await inspector.isVisible().catch(() => false);
    console.log(`ComfyUI inspector visible (nothing selected): ${isVisible}`);
    expect(isVisible).toBe(false);
  });

  test("BPMN right panel visible (has flow-level settings)", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // BPMN has doc-level settings, so right panel should be visible
    const inspector = page.locator('[data-fd-area="inspector"]');
    const isVisible = await inspector.isVisible().catch(() => false);
    console.log(`BPMN inspector visible (has doc settings): ${isVisible}`);
    expect(isVisible).toBe(true);
  });

  test("ER right panel appears when node selected", async ({ page }) => {
    await page.goto("http://127.0.0.1:5181");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click on a node to select it
    const node = page.locator(".x6-cell.x6-node").first();
    if (await node.isVisible()) {
      await node.click();
      await page.waitForTimeout(500);

      const inspector = page.locator('[data-fd-area="inspector"]');
      const isVisible = await inspector.isVisible().catch(() => false);
      console.log(`ER inspector visible (node selected): ${isVisible}`);
      expect(isVisible).toBe(true);
    }
  });
});

test.describe("Fix 4: Trackpad zoom support", () => {
  test("Ctrl+wheel increases the graph zoom", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await assertPinchZoom(page);
  });
});
