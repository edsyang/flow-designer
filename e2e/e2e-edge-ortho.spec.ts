import { test, expect } from '@playwright/test';

test('BPMN edges are orthogonal after connecting gateway', async ({ page }) => {
  await page.goto('http://127.0.0.1:5179');
  await page.waitForSelector('[data-fd-area="canvas"]', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Drag "并行网关" from stencil to canvas
  const stencilItems = page.locator('[data-fd-item="stencil-panel"] [class*=item]');
  const gatewayItem = stencilItems.filter({ hasText: /^.*并行网关.*$/ }).first();
  const canvas = page.locator('[data-fd-area="canvas"]');
  const mainBox = await canvas.boundingBox();

  if (await gatewayItem.isVisible() && mainBox) {
    await gatewayItem.dragTo(canvas, {
      targetPosition: { x: mainBox.width / 2, y: mainBox.height / 2 },
    });
    await page.waitForTimeout(1500);
  }

  // Now verify: count nodes and edges
  const nodeCount = await page.evaluate(() =>
    document.querySelectorAll('.x6-cell.x6-node').length
  );
  console.log(`Nodes: ${nodeCount}`);

  // Connect 开始 → 并行网关: find the "开始" node's right port, drag to gateway's left port
  // Instead of manual connect, just draw an edge from port to port
  const nodes = await page.evaluate(() => {
    const ns = document.querySelectorAll('.x6-cell.x6-node');
    return Array.from(ns).map(n => {
      const rect = n.getBoundingClientRect();
      return {
        id: n.getAttribute('data-cell-id'),
        x: rect.x, y: rect.y, w: rect.width, h: rect.height,
      };
    });
  });
  console.log(`Node rects: ${JSON.stringify(nodes)}`);

  // Find ports and try to connect: find right port of first node (开始)
  if (nodes.length >= 3) {
    // Find source port (right side of 开始, first node)
    const startNode = nodes[0]; // 开始
    const srcPortX = startNode.x + startNode.w; // right edge
    const srcPortY = startNode.y + startNode.h / 2; // center

    // Find target port (left side of gateway, third node)
    const gwNode = nodes[2]; // gateway (just dragged)
    const tgtPortX = gwNode.x; // left edge
    const tgtPortY = gwNode.y + gwNode.h / 2; // center

    console.log(`Connecting from (${srcPortX}, ${srcPortY}) to (${tgtPortX}, ${tgtPortY})`);

    // Draw edge: mousedown on source port, drag to target port
    await page.mouse.move(srcPortX, srcPortY);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(tgtPortX, tgtPortY, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(1000);
  }

  // Check all edges for orthogonality
  const edgeAnalysis = await page.evaluate(() => {
    const edges = document.querySelectorAll('.x6-cell.x6-edge');
    const results: Array<{ pathSnippet: string; hasDiagonal: boolean; segmentCount: number }> = [];

    edges.forEach(e => {
      // Get the visible path (the connection line)
      const paths = e.querySelectorAll('path');
      paths.forEach(path => {
        const d = path.getAttribute('d');
        if (!d || d.length < 10) return;

        // Parse path to find L commands (line segments)
        const commands = d.match(/[ML]\s*[\d.,-]+\s+[\d.,-]+/g) || [];
        let prevX = 0, prevY = 0;
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
            if (dx > 2 && dy > 2) {
              hasDiagonal = true;
              console.log(`Diagonal segment: (${prevX},${prevY}) → (${x},${y}), dx=${dx}, dy=${dy}`);
            }
          }
          prevX = x;
          prevY = y;
        });

        results.push({
          pathSnippet: d.substring(0, 150),
          hasDiagonal,
          segmentCount: segCount,
        });
      });
    });
    return results;
  });

  console.log(`Edge analysis: ${JSON.stringify(edgeAnalysis, null, 2)}`);

  const edgeCount = await page.evaluate(() =>
    document.querySelectorAll('.x6-cell.x6-edge').length
  );
  console.log(`Total edges: ${edgeCount}`);

  // All edge paths should be orthogonal
  const visibleEdges = edgeAnalysis.filter(e => e.segmentCount > 0);
  for (const e of visibleEdges) {
    console.log(`Path: ${e.pathSnippet}, diagonal: ${e.hasDiagonal}`);
    expect(e.hasDiagonal).toBe(false);
  }
});
