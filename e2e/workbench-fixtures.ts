import { expect, type Page } from '@playwright/test';
import type { Designer, GenericRelation } from '@flow-designer/engine';

export async function seedBpmnEdge(page: Page): Promise<string> {
  await page.waitForFunction(() => Boolean((window as unknown as { designer?: Designer }).designer?.graph));
  const id = await page.evaluate(() => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const nodes = designer.document.getContent().getNodes();
    const source = nodes.find((node) => node.getTypeName() === 'StartEvent');
    const target = nodes.find((node) => node.getTypeName() === 'EndEvent');
    if (!source || !target) throw new Error('BPMN Start/End fixture missing');
    target.setPosition(600, 360);
    const id = 'fixture-sequence-flow';
    (source.getRelation() as GenericRelation).addEdge({ id, targetNodeId:target.getId(), sourcePort:'out-right', targetPort:'in-left', type:'SequenceFlow' });
    if (!(source.getRelation() as GenericRelation).getEdgeById(id)) throw new Error('Model edge fixture was not created');
    designer.graph!.select([]);
    designer.document.getSelection().setKeys([]);
    return id;
  });
  await expect(page.locator(`.x6-cell.x6-edge[data-cell-id="${id}"]`)).toHaveCount(1);
  return id;
}

export async function assertOrthogonalEdge(page: Page, id: string): Promise<void> {
  const path = page.locator(`.x6-cell.x6-edge[data-cell-id="${id}"] path[d]`).first();
  await expect(path).toHaveAttribute('d', /^M/);
  const data = await path.getAttribute('d');
  expect(data).not.toMatch(/[CQAST]/i);
  const points = Array.from((data ?? '').matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g), (match) => ({ x:Number(match[1]), y:Number(match[2]) }));
  expect(points.length).toBeGreaterThanOrEqual(3);
  for (let index = 1; index < points.length; index++) {
    const dx = Math.abs(points[index]!.x - points[index - 1]!.x);
    const dy = Math.abs(points[index]!.y - points[index - 1]!.y);
    expect(Math.min(dx, dy)).toBeLessThan(0.5);
  }
}

export async function assertPinchZoom(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { designer?: Designer }).designer?.graph));
  const before = await page.evaluate(() => (window as unknown as { designer: Designer }).designer.graph!.getZoom());
  const box = await page.locator('.x6-graph-scroller').boundingBox();
  if (!box) throw new Error('Canvas scroller unavailable');
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error('Pinch target unavailable');
    target.dispatchEvent(new WheelEvent('wheel', { deltaY:-120, ctrlKey:true, bubbles:true, cancelable:true, clientX:x, clientY:y }));
  }, { x:box.x + box.width * 0.4, y:box.y + box.height * 0.6 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { designer: Designer }).designer.graph!.getZoom())).toBeGreaterThan(before);
}
