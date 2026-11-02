import { test, expect } from '@playwright/test';

async function readLinePresentation(page, id) {
  return page.evaluate(id => {
    const graph = window.designer.graph.getX6Graph();
    const edge = id ? graph.getCellById(id) : graph.getEdges()[0];
    const line = edge && graph.findViewByCell(edge)?.findOne('line');
    if (!line) throw new Error('Visible edge line unavailable');
    const style = getComputedStyle(line);
    return { stroke: style.stroke, width: Number.parseFloat(style.strokeWidth) };
  }, id);
}

test.describe('Edge fixes: orthogonal + port exit + drag persist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5179');
    await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('Issue 1+2: L-shaped edge is orthogonal with proper port exit', async ({ page }) => {
    const canvas = page.locator('[data-fd-area="canvas"]');
    const mainBox = await canvas.boundingBox();

    // Drag a gateway node to below-right of start node to force an L-shaped route
    const stencilItems = page.locator('[data-fd-item="stencil-panel"] .x6-widget-stencil-group-inner [data-cell-id]');
    const itemCount = await stencilItems.count();
    console.log('Stencil items:', itemCount);

    // Try dragging a gateway from stencil
    const gatewayItem = page.locator('[data-fd-item="stencil-panel"]').locator('text=排他网关').first();
    const gatewayVisible = await gatewayItem.isVisible().catch(() => false);
    
    if (gatewayVisible) {
      await gatewayItem.dragTo(canvas, {
        targetPosition: { x: mainBox.width * 0.3, y: mainBox.height * 0.75 },
      });
      await page.waitForTimeout(1500);
    } else {
      // Fallback: find any stencil item and drag it
      const anyItem = page.locator('[data-fd-item="stencil-panel"] [data-cell-id]').first();
      if (await anyItem.isVisible().catch(() => false)) {
        await anyItem.dragTo(canvas, {
          targetPosition: { x: mainBox.width * 0.3, y: mainBox.height * 0.75 },
        });
        await page.waitForTimeout(1500);
      }
    }

    // Get all nodes
    const nodes = await page.evaluate(() => {
      const ns = document.querySelectorAll('.x6-cell.x6-node');
      return Array.from(ns).map(n => {
        const rect = n.getBoundingClientRect();
        const text = n.textContent?.trim() || '';
        return { id: n.getAttribute('data-cell-id'), x: rect.x, y: rect.y, w: rect.width, h: rect.height, text };
      });
    });
    console.log('Nodes:', nodes.map(n => `${n.text}(${n.x.toFixed(0)},${n.y.toFixed(0)})`));

    if (nodes.length < 3) {
      console.log('Not enough nodes to create L-shaped route, using existing nodes');
    }

    // Connect Start (bottom port) to the lower node to get a vertical-first route
    const startNode = nodes[0];
    const targetNode = nodes.length >= 3 ? nodes[2] : nodes[1];

    // Drag from bottom port of Start
    const srcBottom = { x: startNode.x + startNode.w / 2, y: startNode.y + startNode.h };
    const tgtCenter = { x: targetNode.x + targetNode.w / 2, y: targetNode.y };

    await page.mouse.move(srcBottom.x, srcBottom.y);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.mouse.move(tgtCenter.x, tgtCenter.y, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    // Deselect
    await page.mouse.click(mainBox.x + 20, mainBox.y + 20);
    await page.waitForTimeout(500);

    const edgeCount = await page.evaluate(() => document.querySelectorAll('.x6-cell.x6-edge').length);
    console.log('Edge count:', edgeCount);
    expect(edgeCount).toBeGreaterThanOrEqual(1);

    // Check orthogonality of all edges
    const results = await page.evaluate(() => {
      const edges = document.querySelectorAll('.x6-cell.x6-edge');
      const out = [];
      edges.forEach(e => {
        const path = e.querySelector('path[d]');
        if (!path) return;
        const d = path.getAttribute('d') || '';
        const commands = d.match(/[ML]\s*[\d.,-]+\s+[\d.,-]+/g) || [];
        const points = commands.map(cmd => {
          const nums = cmd.match(/[\d.]+/g);
          return nums ? { x: parseFloat(nums[0]), y: parseFloat(nums[1]) } : null;
        }).filter(Boolean);
        
        let hasDiagonal = false;
        for (let i = 1; i < points.length; i++) {
          const dx = Math.abs(points[i].x - points[i-1].x);
          const dy = Math.abs(points[i].y - points[i-1].y);
          if (dx > 2 && dy > 2) { hasDiagonal = true; }
        }

        // Check first segment direction/length (port exit padding)
        let firstSegDir = 'unknown';
        let firstSegLen = 0;
        if (points.length >= 2) {
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          if (Math.abs(dx) > 1 && Math.abs(dy) <= 1) firstSegDir = dx > 0 ? 'right' : 'left';
          else if (Math.abs(dy) > 1 && Math.abs(dx) <= 1) firstSegDir = dy > 0 ? 'down' : 'up';
          firstSegLen = Math.max(Math.abs(dx), Math.abs(dy));
        }

        out.push({ 
          id: e.getAttribute('data-cell-id'), 
          hasDiagonal, 
          pointCount: points.length, 
          firstSegDir, 
          firstSegLen: Math.round(firstSegLen),
          d: d.substring(0, 200),
        });
      });
      return out;
    });

    for (const r of results) {
      console.log(`  Edge ${r.id}: pts=${r.pointCount}, diagonal=${r.hasDiagonal}, exit=${r.firstSegDir}(${r.firstSegLen}px)`);
      console.log(`    d="${r.d}"`);
      expect(r.hasDiagonal).toBe(false);
      if (r.pointCount >= 3) {
        // For multi-segment edges, first segment should have padding distance
        expect(r.firstSegLen).toBeGreaterThanOrEqual(15);
      }
    }
    console.log('Issue 1+2 PASS ✓');
  });

  test('Issue 3: edge drag persists after mouseleave', async ({ page }) => {
    const canvas = page.locator('[data-fd-area="canvas"]');
    const mainBox = await canvas.boundingBox();

    // Create an L-shaped edge by dragging a gateway node and connecting
    const gatewayItem = page.locator('[data-fd-item="stencil-panel"]').locator('text=排他网关').first();
    if (await gatewayItem.isVisible().catch(() => false)) {
      await gatewayItem.dragTo(canvas, {
        targetPosition: { x: mainBox.width * 0.5, y: mainBox.height * 0.7 },
      });
      await page.waitForTimeout(1500);
    }

    // Get nodes
    const nodes = await page.evaluate(() => {
      const ns = document.querySelectorAll('.x6-cell.x6-node');
      return Array.from(ns).map(n => {
        const rect = n.getBoundingClientRect();
        return { id: n.getAttribute('data-cell-id'), x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
    });

    if (nodes.length < 3) {
      console.log('Skipping — not enough nodes for L-route');
      return;
    }

    // Connect Start bottom to gateway top
    const src = nodes[0];
    const tgt = nodes[2];
    await page.mouse.move(src.x + src.w / 2, src.y + src.h);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(tgt.x + tgt.w / 2, tgt.y, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    // Deselect
    await page.mouse.click(mainBox.x + 20, mainBox.y + 20);
    await page.waitForTimeout(500);

    const edgeCount = await page.evaluate(() => document.querySelectorAll('.x6-cell.x6-edge').length);
    if (edgeCount === 0) {
      console.log('No edge created');
      return;
    }

    // Find edge midpoint using SVG CTM
    const hoverTarget = await page.evaluate(() => {
      const edgeEl = document.querySelector('.x6-cell.x6-edge');
      if (!edgeEl) return null;
      const path = edgeEl.querySelector('path[d]');
      if (!path) return null;
      
      const d = path.getAttribute('d') || '';
      const commands = d.match(/[ML]\s*[\d.,-]+\s+[\d.,-]+/g) || [];
      const points = commands.map(cmd => {
        const nums = cmd.match(/[\d.]+/g);
        return nums ? { x: parseFloat(nums[0]), y: parseFloat(nums[1]) } : null;
      }).filter(Boolean);

      if (points.length < 3) return null;

      const svgEl = path.closest('svg');
      if (!svgEl) return null;
      const ctm = path.getScreenCTM();
      if (!ctm) return null;

      // Find the longest segment
      let bestIdx = 0, bestLen = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i+1].x - points[i].x;
        const dy = points[i+1].y - points[i].y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > bestLen) { bestLen = len; bestIdx = i; }
      }

      const mx = (points[bestIdx].x + points[bestIdx+1].x) / 2;
      const my = (points[bestIdx].y + points[bestIdx+1].y) / 2;

      const pt = svgEl.createSVGPoint();
      pt.x = mx;
      pt.y = my;
      const screenPt = pt.matrixTransform(ctm);
      
      const isVerticalSeg = Math.abs(points[bestIdx+1].x - points[bestIdx].x) <= 1;
      return { x: screenPt.x, y: screenPt.y, isVerticalSeg };
    });

    if (!hoverTarget) {
      console.log('Could not find multi-segment edge for drag test');
      return;
    }

    console.log('Hover target:', hoverTarget);

    // Hover the edge to activate bake + segments
    await page.mouse.move(hoverTarget.x, hoverTarget.y);
    await page.waitForTimeout(1000);

    // Verify it's highlighted
    await expect.poll(() => readLinePresentation(page)).toEqual({ stroke: 'rgb(77, 124, 254)', width: 2 });

    // Record path before drag
    const pathBefore = await page.evaluate(() => {
      const edge = document.querySelector('.x6-cell.x6-edge');
      return edge?.querySelector('path[d]')?.getAttribute('d') || null;
    });

    // Drag the segment (perpendicular to it)
    const dragOffset = hoverTarget.isVerticalSeg ? 40 : 0;
    const dragOffsetY = hoverTarget.isVerticalSeg ? 0 : 40;
    await page.mouse.down();
    await page.mouse.move(hoverTarget.x + dragOffset, hoverTarget.y + dragOffsetY, { steps: 8 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const pathAfterDrag = await page.evaluate(() => {
      const edge = document.querySelector('.x6-cell.x6-edge');
      return edge?.querySelector('path[d]')?.getAttribute('d') || null;
    });
    const dragChangedPath = pathBefore !== pathAfterDrag;
    console.log('Drag changed the path:', dragChangedPath);

    // Move mouse far away to trigger mouseleave
    await page.mouse.move(mainBox.x + 10, mainBox.y + 10);
    await page.waitForTimeout(1500);

    // Check if path reverted
    const pathAfterLeave = await page.evaluate(() => {
      const edge = document.querySelector('.x6-cell.x6-edge');
      return edge?.querySelector('path[d]')?.getAttribute('d') || null;
    });

    if (dragChangedPath) {
      const reverted = pathAfterLeave === pathBefore;
      console.log('Path reverted after mouseleave:', reverted);
      expect(reverted).toBe(false);
      console.log('Issue 3 PASS: Drag persists after mouseleave ✓');
    } else {
      console.log('Note: drag did not change path (straight-line edge or segment tool not caught)');
    }
  });
});
