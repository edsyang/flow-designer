import { expect, test } from "@playwright/test";

for (const type of ["StartEvent", "UserTask", "EndEvent"]) {
  test(`${type}: every physical port opens the expected blank-drop picker`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto("http://127.0.0.1:5179");
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));
    const id = await page.evaluate(async (type) => {
      const d = (window as any).designer;
      const content = d.document.getContent();
      const node =
        content.getNodes().find((n: any) => n.getTypeName() === type) ??
        (await content.addNode({ type }));
      for (const other of content.getNodes()) {
        if (other !== node) other.setPosition(-1500, -1500);
      }
      node.setPosition(450, 300);
      d.graph.select([node.getId()]);
      return node.getId();
    }, type);
    const ports = await page.evaluate((id) => {
      const d = (window as any).designer;
      return d.graph
        .getX6Graph()
        .getCellById(id)
        .getPorts()
        .map((p: any) => p.id);
    }, id);
    expect(ports).toHaveLength(4);
    for (const port of ports) {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const point = await page.evaluate(
        ({ id, port }) => {
          const d = (window as any).designer;
          const node = d.graph.getX6Graph().getCellById(id);
          const offset = node.getPortsPosition(node.getPort(port).group)[port].position;
          const origin = node.position();
          return d.graph.localToClient(origin.x + offset.x, origin.y + offset.y);
        },
        { id, port },
      );
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 150, point.y + 180, { steps: 12 });
      await page.mouse.up();
      const picker = page.locator('[data-fd-area="canvasQuickAdd"]');
      await expect(picker).toBeVisible();
      const option = picker.getByRole("button", { name: /人工节点/ });
      if (type === "EndEvent") {
        await expect(option).toHaveCount(0);
        await expect(picker).toContainText(/不能.*出|不允许.*出/);
      } else {
        await expect(option).toBeVisible();
      }
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      await expect(page.locator(".x6-edge")).toHaveCount(0);
    }
  });
}

test("Start rejects incoming drops once without persisting an edge", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto("http://127.0.0.1:5179");
  await page.waitForFunction(() => Boolean((window as any).designer?.graph));
  const points = await page.evaluate(async () => {
    const d = (window as any).designer;
    const content = d.document.getContent();
    const target = content.getNodes().find((n: any) => n.getTypeName() === "StartEvent");
    const source = await content.addNode({ type: "UserTask" });
    for (const other of content.getNodes()) other.setPosition(-1500, -1500);
    source.setPosition(350, 300);
    target.setPosition(750, 300);
    (window as any).__rejectedConnections = [];
    d.graph.on("connection:rejected", (e: unknown) =>
      (window as any).__rejectedConnections.push(e),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const point = (id: string) => {
      const node = d.graph.getX6Graph().getCellById(id);
      const offset = node.getPortsPosition(node.getPort("out-right").group)["out-right"].position;
      const origin = node.position();
      return d.graph.localToClient(origin.x + offset.x, origin.y + offset.y);
    };
    return { source: point(source.getId()), target: point(target.getId()) };
  });
  await page.mouse.move(points.source.x, points.source.y);
  await page.mouse.down();
  await page.mouse.move(points.target.x, points.target.y, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).__rejectedConnections.length))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__rejectedConnections[0].reason)).toBe(
    "workbench.connection.targetCannotReceive",
  );
  expect(
    await page.evaluate(
      () =>
        (window as any).designer.document
          .getContent()
          .getNodes()
          .flatMap((n: any) => n.getRelation().serialize()).length,
    ),
  ).toBe(0);
  await expect(page.locator('[data-fd-area="canvasQuickAdd"]')).toHaveCount(0);
  await expect(page.locator(".x6-edge")).toHaveCount(0);
});

for (const [sourcePort, targetPort, dx, dy] of [
  ["out-bottom", "in-top", 0, -180],
  ["in-top", "out-bottom", 0, 180],
  ["out-right", "in-left", -240, 0],
  ["in-left", "out-right", 240, 0],
] as const) {
  test(`ordinary BPMN nodes connect ${sourcePort} to ${targetPort}`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto("http://127.0.0.1:5179");
    await page.waitForFunction(() => Boolean((window as any).designer?.graph));
    const fixture = await page.evaluate(
      async ({ sourcePort, targetPort, dx, dy }) => {
        const d = (window as any).designer;
        const content = d.document.getContent();
        for (const node of content.getNodes()) node.setPosition(-1500, -1500);
        const source = await content.addNode({ type: "UserTask" });
        const target = await content.addNode({ type: "UserTask" });
        target.setPosition(600, 350);
        source.setPosition(600 + dx, 350 + dy);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const point = (id: string, port: string) => {
          const node = d.graph.getX6Graph().getCellById(id);
          const offset = node.getPortsPosition(node.getPort(port).group)[port].position;
          const origin = node.position();
          return d.graph.localToClient(origin.x + offset.x, origin.y + offset.y);
        };
        return {
          sourceId: source.getId(),
          targetId: target.getId(),
          source: point(source.getId(), sourcePort),
          target: point(target.getId(), targetPort),
        };
      },
      { sourcePort, targetPort, dx, dy },
    );
    await page.mouse.move(fixture.source.x, fixture.source.y);
    await page.mouse.down();
    await page.mouse.move(fixture.target.x, fixture.target.y, { steps: 15 });
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            (window as any).designer.document.getContent().getNode(id).getRelation().serialize()
              .length,
          fixture.sourceId,
        ),
      )
      .toBe(1);
    const edge = await page.evaluate(
      (id) =>
        (window as any).designer.document.getContent().getNode(id).getRelation().serialize()[0],
      fixture.sourceId,
    );
    expect(edge).toMatchObject({
      sourcePort,
      targetPort,
      targetNodeId: fixture.targetId,
      props: { name: "顺序流" },
    });
    await expect(page.locator('[data-fd-area="canvasQuickAdd"]')).toHaveCount(0);
  });
}
