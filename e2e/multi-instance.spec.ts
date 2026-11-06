import { expect, test } from "@playwright/test";
import type { Designer } from "@flow-designer/engine";

type Fixtures = Record<string, { designer: Designer; destroy(): Promise<void> }>;

test("same-name editors retain rendering, commands, focus and resources after sibling destruction", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/instance-fixture.html");
  await page.waitForFunction(() => {
    const state = window as unknown as {
      instanceFixtures?: Fixtures;
      instanceFixtureError?: string;
    };
    if (state.instanceFixtureError) throw new Error(state.instanceFixtureError);
    return state.instanceFixtures?.A.designer.graph && state.instanceFixtures.B.designer.graph;
  });
  const a = page.locator('[data-instance="A"]');
  const b = page.locator('[data-instance="B"]');
  await expect(a.locator('[data-instance-renderer="A"]')).toBeVisible();
  await expect(b.locator('[data-instance-renderer="B"]')).toBeVisible();
  await expect(a.locator('[data-instance-renderer="B"]')).toHaveCount(0);
  await page.evaluate(() => {
    const f = (window as unknown as { instanceFixtures: Fixtures }).instanceFixtures;
    for (const entry of Object.values(f))
      entry.designer.document.getSelection().setKeys(["same-node"]);
  });
  await a.locator('[data-instance-renderer="A"]').click();
  await page.keyboard.press("Delete");
  await expect(a.locator('[data-instance-renderer="A"]')).toHaveCount(0);
  await expect(b.locator('[data-instance-renderer="B"]')).toBeVisible();
  await page.evaluate(async () => {
    const f = (window as unknown as { instanceFixtures: Fixtures }).instanceFixtures;
    await f.A.designer.editor.commands.executeCommand("undo");
  });
  await expect(a.locator('[data-instance-renderer="A"]')).toBeVisible();
  await page.evaluate(async () => {
    const f = (window as unknown as { instanceFixtures: Fixtures }).instanceFixtures;
    await f.A.destroy();
    await f.B.designer.document.getContent().addNode({
      id: "after-destroy",
      type: "SameType",
      props: { __position: { x: 180, y: 260 } },
    });
  });
  await expect(b.locator('[data-instance-renderer="B"]')).toHaveCount(2);
  await b.locator('[data-instance-renderer="B"]').last().click();
  await page.keyboard.press("Delete");
  await expect(b.locator('[data-instance-renderer="B"]')).toHaveCount(1);
  await page.evaluate(async () => {
    const f = (window as unknown as { instanceFixtures: Fixtures }).instanceFixtures;
    await f.B.designer.editor.commands.executeCommand("undo");
  });
  await expect(b.locator('[data-instance-renderer="B"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});
