import { expect, test } from "@playwright/test";
import type { Designer } from "@flow-designer/engine";

for (const [port, title] of [
  [5179, "BPMN Flow Designer"],
  [5180, "ComfyUI Designer"],
  [5181, "ER Diagram Designer"],
] as const) {
  test(`language switch preserves document/history and survives reload in ${port}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem("flow-designer:locale"))
        localStorage.setItem("flow-designer:locale", "zh-CN");
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForFunction(() =>
      Boolean((window as unknown as { designer?: Designer }).designer?.graph),
    );
    const snapshot = () =>
      page.evaluate(() => {
        const { document } = (window as unknown as { designer: Designer }).designer;
        return {
          data: document.getData(),
          history: document.getTimeline().getPoints().length,
          selection: document.getSelection().getKeys(),
        };
      });
    const before = await snapshot();
    await page.getByRole("button", { name: "语言", exact: true }).click();
    await page.getByRole("menuitem", { name: "英语", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("button", { name: "Language", exact: true })).toBeVisible();
    expect(await snapshot()).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem("flow-designer:locale"))).toBe("en-US");
    await page.reload();
    await expect(page.getByRole("button", { name: "Language", exact: true })).toBeVisible();
    await expect(page).toHaveTitle(title);
    const reloaded = await snapshot();
    await page.getByRole("button", { name: "Language", exact: true }).click();
    await page.getByRole("menuitem", { name: "Simplified Chinese", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    expect(await snapshot()).toEqual(reloaded);
    expect(errors).toEqual([]);
  });
}
