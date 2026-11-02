import { expect, test } from '@playwright/test';
import { seedBpmnEdge } from './workbench-fixtures';

test('hover and segment dragging never recolor the wide hit path', async ({ page }) => {
  await page.goto('/');
  const id = await seedBpmnEdge(page);
  await page.evaluate(id => {
    const edge = (window as any).designer.graph.getX6Graph().getCellById(id);
    edge.attr('line/stroke', '#9351a6'); edge.attr('line/strokeWidth', 3);
  }, id);
  const paths = page.locator(`.x6-edge[data-cell-id="${id}"] path[d]`);
  const attrs = () => paths.evaluateAll(els => els.map(el => ({ stroke: el.getAttribute('stroke'), visualStroke: getComputedStyle(el).stroke, width: el.getAttribute('stroke-width'), pointer: el.getAttribute('pointer-events') })));
  await expect.poll(async () => (await attrs()).find(path => path.pointer === 'none')?.visualStroke).toBe('rgb(147, 81, 166)');
  const before = await attrs();
  const point = await paths.first().evaluate((path: SVGPathElement) => { const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!); return { x: p.x, y: p.y }; });
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('.x6-edge-tool-segment:visible').first()).toBeVisible();
  const hover = await attrs();
  expect(hover.find(path => path.pointer === 'none')?.visualStroke).toBe('rgb(77, 124, 254)');
  for (let i = 0; i < before.length; i++) if (before[i]?.stroke === 'transparent') expect(hover[i]?.stroke).toBe('transparent');
  for (const distance of [35, -35, 35, -35]) {
    const midpoint = await paths.first().evaluate((path: SVGPathElement) => { const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!); return { x: p.x, y: p.y }; });
    await page.mouse.move(midpoint.x, midpoint.y);
    await expect(page.locator('.x6-edge-tool-segment:visible').first()).toBeVisible();
    const handle = page.locator('.x6-edge-tool-segment:visible').first();
    const box = await handle.boundingBox(); if (!box) throw new Error('Segment handle missing');
    const cursor = await handle.evaluate(el => getComputedStyle(el).cursor);
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + (cursor === 'col-resize' ? distance : 0), y + (cursor === 'col-resize' ? 0 : distance), { steps: 8 });
    await page.mouse.up();
    const points = await page.evaluate(id => {
      const graph = (window as any).designer.graph.getX6Graph();
      const edge = graph.getCellById(id); const view = graph.findViewByCell(edge);
      return [view.sourcePoint, ...edge.getVertices(), view.targetPoint].map(p => ({ x: p.x, y: p.y }));
    }, id);
    expect(points.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!; const curr = points[i]!;
      expect(Math.min(Math.abs(curr.x - prev.x), Math.abs(curr.y - prev.y))).toBeLessThan(2);
      expect(Math.hypot(curr.x - prev.x, curr.y - prev.y)).toBeGreaterThan(2);
      for (let j = i + 1; j < points.length; j++) expect(Math.hypot(curr.x - points[j]!.x, curr.y - points[j]!.y)).toBeGreaterThan(2);
    }
    expect((await attrs()).find(path => path.width === '10')?.stroke).toBe('transparent');
  }
  await page.evaluate(id => (window as any).designer.graph.select([id]), id);
  await page.mouse.move(10, 10);
  await expect.poll(async () => (await attrs()).find(path => path.pointer === 'none')?.visualStroke).toBe('rgb(77, 124, 254)');
  const midpoint = await paths.first().evaluate((path: SVGPathElement) => { const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!); return { x: p.x, y: p.y }; });
  await page.mouse.move(midpoint.x, midpoint.y);
  await page.evaluate(() => (window as any).designer.graph.select([]));
  await page.mouse.move(10, 10);
  await expect.poll(async () => (await attrs()).find(path => path.pointer === 'none')?.visualStroke).toBe(before.find(path => path.pointer === 'none')?.visualStroke);
  expect((await attrs()).find(path => path.pointer === 'none')?.width).toBe('3');
});
