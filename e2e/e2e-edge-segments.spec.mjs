import { test, expect } from "@playwright/test";
import { seedBpmnEdge } from "./workbench-fixtures.ts";

async function readLinePresentation(page, id) {
  return page.evaluate((id) => {
    const graph = window.designer.graph.getX6Graph();
    const edge = id ? graph.getCellById(id) : graph.getEdges()[0];
    const line = edge && graph.findViewByCell(edge)?.findOne("line");
    if (!line) throw new Error("Visible edge line unavailable");
    const style = getComputedStyle(line);
    return {
      stroke: style.stroke,
      width: Number.parseFloat(style.strokeWidth),
    };
  }, id);
}

test.describe("Edge segment drag interaction", () => {
  test("BPMN edge hover/leave cycle with L-shaped route", async ({ page }) => {
    await page.goto("http://127.0.0.1:5179");
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    const edgeId = await seedBpmnEdge(page);
    const mainBox = await page.locator(".x6-graph-scroller").boundingBox();
    if (!mainBox) throw new Error("Canvas scroller unavailable");
    await page.evaluate(() => {
      window.designer.graph.select([]);
      window.designer.document.getSelection().setKeys([]);
    });
    await expect
      .poll(() => page.evaluate(() => window.designer.graph.getSelection().length))
      .toBe(0);
    await page.mouse.move(mainBox.x + 50, mainBox.y + 50);
    const restingStyle = await readLinePresentation(page, edgeId);
    expect(restingStyle.stroke).not.toBe("rgb(77, 124, 254)");

    // Find screen coords of the edge segments by computing offset from bounding rect
    const hoverInfo = await page.evaluate(() => {
      const edgeEl = document.querySelector(".x6-cell.x6-edge");
      if (!edgeEl) return null;
      const path = edgeEl.querySelector("path[d]");
      if (!path) return null;
      const d = path.getAttribute("d") || "";

      // Parse SVG path points
      const commands = d.match(/[ML]\s*[\d.,-]+\s+[\d.,-]+/g) || [];
      const svgPoints = commands
        .map((cmd) => {
          const nums = cmd.match(/[\d.]+/g);
          return nums ? { x: parseFloat(nums[0]), y: parseFloat(nums[1]) } : null;
        })
        .filter(Boolean);

      if (svgPoints.length < 2) return null;

      // Get bounding rect (screen coords)
      const rect = edgeEl.getBoundingClientRect();

      // SVG bounding box
      const svgMinX = Math.min(...svgPoints.map((p) => p.x));
      const svgMinY = Math.min(...svgPoints.map((p) => p.y));

      // Offset: screen = svg + offset
      const offsetX = rect.x - svgMinX;
      const offsetY = rect.y - svgMinY;

      // Convert SVG points to screen
      const screenPoints = svgPoints.map((p) => ({
        x: p.x + offsetX,
        y: p.y + offsetY,
      }));

      // Find the longest segment for hover
      let bestIdx = 0;
      let bestLen = 0;
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const dx = screenPoints[i + 1].x - screenPoints[i].x;
        const dy = screenPoints[i + 1].y - screenPoints[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > bestLen) {
          bestLen = len;
          bestIdx = i;
        }
      }

      const hoverX = (screenPoints[bestIdx].x + screenPoints[bestIdx + 1].x) / 2;
      const hoverY = (screenPoints[bestIdx].y + screenPoints[bestIdx + 1].y) / 2;

      return { screenPoints, hoverX, hoverY, d, offsetX, offsetY };
    });

    console.log(`Hover info: ${JSON.stringify(hoverInfo)}`);
    expect(hoverInfo).not.toBeNull();

    // Verify what element is at the hover point
    const elAtPoint = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return "null";
        const edge = el.closest(".x6-cell.x6-edge");
        return edge
          ? `edge:${edge.getAttribute("data-cell-id")}`
          : `${el.tagName}.${el.className?.baseVal || el.className}`;
      },
      { x: hoverInfo.hoverX, y: hoverInfo.hoverY },
    );
    console.log(`Element at hover point: ${elAtPoint}`);

    // Hover over the edge
    await page.mouse.move(hoverInfo.hoverX, hoverInfo.hoverY);
    await page.waitForTimeout(800);

    await expect
      .poll(() => readLinePresentation(page, edgeId))
      .toEqual({ stroke: "rgb(77, 124, 254)", width: 2 });

    // Leave
    await page.mouse.move(mainBox.x + 50, mainBox.y + 50);
    await page.waitForTimeout(800);

    await expect.poll(() => readLinePresentation(page, edgeId)).toEqual(restingStyle);

    // Final orthogonality check
    const finalOrtho = await page.evaluate(() => {
      const edges = document.querySelectorAll(".x6-cell.x6-edge");
      const results = [];
      edges.forEach((e) => {
        const paths = e.querySelectorAll("path");
        paths.forEach((path) => {
          const d = path.getAttribute("d");
          if (!d || d.length < 10) return;
          const commands = d.match(/[ML]\s*[\d.,-]+\s+[\d.,-]+/g) || [];
          let prevX = 0,
            prevY = 0;
          let hasDiagonal = false;
          let segCount = 0;
          commands.forEach((cmd, i) => {
            const nums = cmd.match(/[\d.]+/g);
            if (!nums || nums.length < 2) return;
            const x = parseFloat(nums[0]);
            const y = parseFloat(nums[1]);
            if (i > 0) {
              segCount++;
              const dx = Math.abs(x - prevX);
              const dy = Math.abs(y - prevY);
              if (dx > 2 && dy > 2) hasDiagonal = true;
            }
            prevX = x;
            prevY = y;
          });
          if (segCount > 0) results.push({ hasDiagonal });
        });
      });
      return results;
    });
    for (const e of finalOrtho) {
      expect(e.hasDiagonal).toBe(false);
    }
    console.log("All checks passed ✓");
  });
});
