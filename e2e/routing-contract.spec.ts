import { expect, test } from '@playwright/test';

for (const scenario of [
  { name: 'BPMN', url: 'http://127.0.0.1:5179', source: 'StartEvent', target: 'EndEvent', obstacle: 'UserTask', out: 'out-right', input: 'in-left', edgeType: 'SequenceFlow', curve: false },
  { name: 'ComfyUI', url: 'http://127.0.0.1:5180', source: 'CheckpointLoaderSimple', target: 'KSampler', obstacle: 'CLIPTextEncode', out: 'model', input: 'model', edgeType: 'DataLink', curve: true },
  { name: 'ER', url: 'http://127.0.0.1:5181', source: 'Table', target: 'Table', obstacle: 'Table', out: 'ref_out', input: 'pk', edgeType: 'Relation', curve: true },
]) {
  test(`${scenario.name}: obstacle moves preserve port attachment, routing mode and markers through history`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(scenario.url);
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));
    const ids = await page.evaluate(async s => {
      const d = (window as any).designer; const content = d.document.getContent();
      for (const node of [...content.getNodes()]) await content.removeNode(node.getId());
      const source = await content.addNode({ type: s.source }); const target = await content.addNode({ type: s.target });
      const obstacle = await content.addNode({ type: s.obstacle }); const obstacle2 = await content.addNode({ type: s.obstacle });
      source.setPosition(80, 240); target.setPosition(900, 240);
      obstacle.setPosition(490, 650); obstacle2.setPosition(650, 80);
      source.getRelation().addEdge({ id: 'routing-contract-edge', targetNodeId: target.getId(), sourcePort: s.out, targetPort: s.input, type: s.edgeType });
      d.graph.select([]); d.document.getSelection().setKeys([]);
      return { source: source.getId(), target: target.getId(), obstacle: obstacle.getId() };
    }, scenario);
    await expect(page.locator('[data-cell-id="routing-contract-edge"] path[pointer-events="none"]')).toHaveAttribute('d', /^M/);
    await page.evaluate(() => (window as any).designer.document.getTimeline().reset());
    const snapshot = () => page.evaluate(() => {
      const d = (window as any).designer; const graph = d.graph.getX6Graph(); const edge = graph.getCellById('routing-contract-edge'); const view = graph.findViewByCell(edge);
      const line = view.findOne('line') as SVGPathElement;
      const points = []; for (let p = 0; p <= line.getTotalLength(); p += 3) { const point = line.getPointAtLength(p); points.push({ x: point.x, y: point.y }); }
      const boxes = graph.getNodes().map((node: any) => ({ id: node.id, ...node.getBBox().toJSON() }));
      const port = (which: 'source' | 'target') => {
        const node = which === 'source' ? edge.getSourceCell() : edge.getTargetCell();
        const id = which === 'source' ? edge.getSourcePortId() : edge.getTargetPortId();
        const pos = node.getPortsPosition(node.getPort(id).group)[id].position;
        const origin = node.position(); return { x: origin.x + pos.x, y: origin.y + pos.y };
      };
      const relation = d.document.getContent().getNode(edge.getSourceCellId()).getRelation().getEdgeById(edge.id);
      return { vertices: edge.getVertices(), relation, error: view.container.getAttribute('data-routing-error'), sourcePort: port('source'), targetPort: port('target'), d: line.getAttribute('d'), source: edge.getSource(), target: edge.getTarget(), router: edge.getRouter()?.name ?? null, connector: edge.getConnector()?.name, marker: edge.attr('line/targetMarker'), points, boxes, sourcePoint: { x: view.sourcePoint.x, y: view.sourcePoint.y }, targetPoint: { x: view.targetPoint.x, y: view.targetPoint.y } };
    });
    await expect.poll(async () => (await snapshot()).d).toMatch(/^M/);
    const before = await snapshot();
    expect(before.connector).toBe(scenario.curve ? 'port-curve' : 'flow-normal');
    expect(before.router).toBe(scenario.curve ? null : 'flow-orthogonal');
    expect(Boolean(before.marker)).toBe(!scenario.curve);
    await page.evaluate(async ids => {
      const d = (window as any).designer;
      await d.document.transaction('Move obstacle', () => d.document.getContent().getNode(ids.obstacle).setPosition(490, 225));
    }, ids);
    await expect.poll(async () => (await snapshot()).d).not.toBe(before.d);
    const movedObstacle = await snapshot();
    for (const p of movedObstacle.points) for (const box of movedObstacle.boxes) {
      expect(p.x > box.x + 1 && p.x < box.x + box.width - 1 && p.y > box.y + 1 && p.y < box.y + box.height - 1).toBe(false);
    }
    expect(movedObstacle.error).toBeNull();
    expect(movedObstacle.sourcePoint).toEqual(movedObstacle.sourcePort); expect(movedObstacle.targetPoint).toEqual(movedObstacle.targetPort);
    expect(movedObstacle.source).toEqual(before.source); expect(movedObstacle.target).toEqual(before.target);
    expect(movedObstacle.connector).toBe(before.connector); expect(movedObstacle.router).toBe(before.router);
    const path = movedObstacle.points;
    expect(Math.abs(path[1]!.y - movedObstacle.sourcePoint.y)).toBeLessThan(1);
    expect(path[1]!.x).toBeGreaterThan(movedObstacle.sourcePoint.x);
    const last = path[path.length - 1]!;
    expect(Math.abs(last.y - movedObstacle.targetPoint.y)).toBeLessThan(1); expect(last.x).toBeLessThan(movedObstacle.targetPoint.x + 0.1);
    await page.evaluate(() => (window as any).designer.document.getTimeline().back());
    await expect.poll(async () => (await snapshot()).d).toBe(before.d);
    expect((await snapshot()).marker).toEqual(before.marker);
    await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
    await expect.poll(async () => (await snapshot()).d).toBe(movedObstacle.d);
    expect((await snapshot()).source).toEqual(before.source); expect((await snapshot()).target).toEqual(before.target);
    expect((await snapshot()).router).toBe(before.router); expect((await snapshot()).connector).toBe(before.connector);
    const line = page.locator('[data-cell-id="routing-contract-edge"] path[pointer-events="none"]');
    const point = await line.evaluate((path: SVGPathElement) => {
      const p = path.getPointAtLength(path.getTotalLength() * 0.4).matrixTransform(path.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
    await page.mouse.move(point.x, point.y);
    let start = point;
    let delta = { x: 0, y: scenario.curve ? -180 : -45 };
    if (!scenario.curve) {
      const handle = page.locator('.x6-edge-tool-segment:visible').first();
      await expect(handle).toBeVisible();
      const box = await handle.boundingBox(); if (!box) throw new Error('Segment handle unavailable');
      start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const cursor = await handle.evaluate(el => getComputedStyle(el).cursor);
      delta = cursor === 'col-resize' ? { x: 45, y: 0 } : { x: 0, y: -45 };
    } else await expect(page.locator('.x6-edge-tool-vertices')).toBeVisible();
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 });
    const preview = await snapshot();
    expect(preview.router).toBe(before.router); expect(preview.connector).toBe(before.connector);
    expect(preview.source).toEqual(before.source); expect(preview.target).toEqual(before.target);
    expect(preview.error).toBeNull();
    for (const point of preview.points) for (const box of preview.boxes) {
      expect(point.x > box.x + 1 && point.x < box.x + box.width - 1 && point.y > box.y + 1 && point.y < box.y + box.height - 1).toBe(false);
    }
    await page.mouse.up();
    await expect.poll(async () => (await snapshot()).relation.vertices?.length ?? 0).toBeGreaterThan(0);
    const edited = await snapshot();
    expect(edited.relation.vertices).toEqual(edited.vertices);
    expect(edited.router).toBe(before.router); expect(edited.connector).toBe(before.connector);
    await page.mouse.move(10, 10);
    await page.evaluate(() => (window as any).designer.document.getTimeline().back());
    await expect.poll(async () => (await snapshot()).vertices).toEqual([]);
    await page.evaluate(() => (window as any).designer.document.getTimeline().forward());
    await expect.poll(async () => (await snapshot()).vertices).toEqual(edited.vertices);
    // Timeline restore and serialization must preserve the registered mode.
    const saved = await page.evaluate(() => (window as any).designer.document.getData());
    await page.evaluate(data => (window as any).designer.document.load(data), saved);
    await expect.poll(async () => (await snapshot()).connector).toBe(before.connector);
    expect((await snapshot()).router).toBe(before.router);
    expect((await snapshot()).vertices).toEqual(edited.vertices);
  });
}
