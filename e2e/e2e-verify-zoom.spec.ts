import { test, expect } from "@playwright/test";
import { seedBpmnEdge, assertOrthogonalEdge } from "./workbench-fixtures";

test.describe("Fix 1: BPMN edge routing with er router", () => {
  test("BPMN scene renders with edges present", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    const edgeId = await seedBpmnEdge(page);
    await assertOrthogonalEdge(page, edgeId);
  });
});

test.describe("Fix 4: Trackpad pinch-to-zoom (Ctrl+wheel)", () => {
  test("Ctrl+wheel zooms the canvas", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Read the zoom level before
    const zoomBefore = await page.evaluate(() => {
      // X6 stores zoom in the graph's transform matrix
      const svgViewport = document.querySelector(".x6-graph-svg-viewport");
      if (svgViewport) {
        return svgViewport.getAttribute("transform");
      }
      return null;
    });
    console.log(`SVG viewport transform before: ${zoomBefore}`);

    // Simulate Ctrl+Wheel (Mac trackpad pinch-to-zoom sends ctrlKey=true)
    const scroller = page.locator(".x6-graph-scroller");
    const box = await scroller.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Use page.evaluate to dispatch proper wheel events with ctrlKey
    await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return;
        for (let i = 0; i < 10; i++) {
          el.dispatchEvent(
            new WheelEvent("wheel", {
              deltaY: -100,
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
            }),
          );
        }
      },
      { x: cx, y: cy },
    );

    await page.waitForTimeout(1000);

    const zoomAfter = await page.evaluate(() => {
      const svgViewport = document.querySelector(".x6-graph-svg-viewport");
      if (svgViewport) {
        return svgViewport.getAttribute("transform");
      }
      return null;
    });
    console.log(`SVG viewport transform after: ${zoomAfter}`);

    // The transform should have changed due to zoom
    expect(zoomAfter).not.toEqual(zoomBefore);
  });
});
