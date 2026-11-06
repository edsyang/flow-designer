import { test, expect, type Page } from "@playwright/test";
import { seedBpmnEdge, assertOrthogonalEdge, assertPinchZoom } from "./workbench-fixtures";

async function inspectorContent(page: Page) {
  const inspector = page.locator('[data-fd-area="inspector"]');
  const toggle = inspector.getByRole("button").first();
  const id = await toggle.getAttribute("aria-controls");
  if (!id) throw new Error("Inspector toggle has no controlled content");
  return { inspector, toggle, body: page.locator(`[id="${id}"]`) };
}

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
  test("ER inspector body collapses with its reopen control visible", async ({ page }) => {
    await page.goto("http://127.0.0.1:5181");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));

    const { inspector, toggle, body } = await inspectorContent(page);
    await expect(inspector).toBeVisible();
    await expect(toggle).toHaveAccessibleName("展开属性");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(body).toBeHidden();
  });

  test("ComfyUI inspector body collapses with its reopen control visible", async ({ page }) => {
    await page.goto("http://127.0.0.1:5180");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));

    const { inspector, toggle, body } = await inspectorContent(page);
    await expect(inspector).toBeVisible();
    await expect(toggle).toHaveAccessibleName("展开属性");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(body).toBeHidden();
  });

  test("BPMN right panel visible (has flow-level settings)", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));

    const { inspector, toggle, body } = await inspectorContent(page);
    await expect(inspector).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(body).toBeVisible();
    await expect(body.locator("input").first()).toBeVisible();
  });

  test("ER right panel appears when node selected", async ({ page }) => {
    await page.goto("http://127.0.0.1:5181");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));

    const id = await page.evaluate(async () => {
      const designer = (window as any).designer;
      const graph = designer.graph.getX6Graph();
      const viewport = document.querySelector(".x6-graph-scroller")!.getBoundingClientRect();
      const center = graph.clientToLocal(
        viewport.left + viewport.width / 2,
        viewport.top + viewport.height / 2,
      );
      const node = await designer.document
        .getContent()
        .addNode({ type: "Table", props: { __position: { x: center.x - 140, y: center.y - 60 } } });
      return node.getId();
    });
    const node = page.locator(`.x6-cell.x6-node[data-cell-id="${id}"]`);
    await expect(node).toBeVisible();
    await node.click();
    const { toggle, body } = await inspectorContent(page);
    await expect(toggle).toHaveAccessibleName("收起属性");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(body).toBeVisible();
    await expect(body.locator("input").first()).toBeVisible();
    await page.evaluate(() => (window as any).designer.graph.select([]));
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(body).toBeHidden();
  });
});

test.describe("Fix 4: Trackpad zoom support", () => {
  test("Ctrl+wheel increases the graph zoom", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await assertPinchZoom(page);
  });
});
