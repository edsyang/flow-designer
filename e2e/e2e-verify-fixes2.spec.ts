import { test } from "@playwright/test";
import { seedBpmnEdge, assertOrthogonalEdge, assertPinchZoom } from "./workbench-fixtures";

test("BPMN model edge projects to a nonempty orthogonal route", async ({ page }) => {
  await page.goto("http://127.0.0.1:5179");
  const id = await seedBpmnEdge(page);
  await assertOrthogonalEdge(page, id);
});

test("Ctrl+wheel increases the graph zoom", async ({ page }) => {
  await page.goto("http://127.0.0.1:5179");
  await assertPinchZoom(page);
});
