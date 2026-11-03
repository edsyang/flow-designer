import { expect, test, type Page } from "@playwright/test";
import type { Designer } from "@flow-designer/engine";

interface CellProjection {
  id: string;
  isVisible(): boolean;
  hide(): void;
  getBBox(): { x: number; y: number; width: number; height: number };
}
interface GraphProjection {
  getCellById(id: string): CellProjection;
  getNodes(): CellProjection[];
  centerCell(cell: CellProjection): void;
}

// This suite exercises default viewportCulling at or above its 300-node activation threshold.
// Run only after the implementation is ready; no test installs its own culling logic.
async function fixture(page: Page): Promise<string> {
  await page.goto("/");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { designer?: Designer }).designer?.graph),
  );
  const snapshot = await page.evaluate(() => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const nodes = [
      {
        id: "viewport-anchor",
        typeName: "UserTask",
        props: { name: "Viewport anchor" },
        position: { x: 500, y: 300 },
      },
      {
        id: "cross-left",
        typeName: "UserTask",
        props: { name: "Crossing source" },
        position: { x: -3000, y: 300 },
      },
      {
        id: "cross-right",
        typeName: "UserTask",
        props: { name: "Crossing target" },
        position: { x: 3500, y: 500 },
      },
      {
        id: "far-node",
        typeName: "UserTask",
        props: { name: "Far task" },
        position: { x: 10000, y: 2000 },
      },
      ...Array.from({ length: 500 }, (_, index) => ({
        id: `viewport-filler-${index}`,
        typeName: "UserTask",
        props: { name: `Filler ${index}` },
        position: {
          x: 15000 + (index % 25) * 240,
          y: 10000 + Math.floor(index / 25) * 120,
        },
      })),
    ];
    designer.document.load({
      id: "viewport-fixture",
      documentType: "process",
      documentVersion: "1.0.0",
      elements: [
        ...nodes,
        {
          id: "crossing-edge",
          typeName: "SequenceFlow",
          sourceRef: "cross-left",
          targetRef: "cross-right",
          sourcePort: "out-right",
          targetPort: "in-left",
        },
      ],
    });
    const graph = designer.graph!.getX6Graph() as GraphProjection;
    graph.centerCell(graph.getCellById("viewport-anchor"));
    designer.graph!.select([]);
    designer.document.getSelection().setKeys([]);
    designer.document.getTimeline().reset();
    return JSON.stringify(designer.document.getData());
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const designer = (window as unknown as { designer: Designer }).designer;
        const graph = designer.graph!.getX6Graph() as GraphProjection;
        const shown = (id: string) => {
          const element = document.querySelector(`.x6-cell[data-cell-id="${id}"]`);
          return (
            !!element &&
            getComputedStyle(element).visibility !== "hidden" &&
            getComputedStyle(element).display !== "none"
          );
        };
        return {
          count: graph.getNodes().length,
          anchor: shown("viewport-anchor"),
          far: shown("far-node"),
          modelFarVisible: graph.getCellById("far-node").isVisible(),
        };
      }),
    )
    .toEqual({ count: 504, anchor: true, far: false, modelFarVisible: true });
  return snapshot;
}

test("offscreen endpoints retain a visible edge crossing the viewport without persisting visibility", async ({
  page,
}) => {
  const snapshot = await fixture(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const graph = (
          window as unknown as { designer: Designer }
        ).designer.graph!.getX6Graph() as GraphProjection;
        const shown = (id: string) => {
          const element = document.querySelector(`.x6-cell[data-cell-id="${id}"]`);
          return (
            !!element &&
            getComputedStyle(element).visibility !== "hidden" &&
            getComputedStyle(element).display !== "none"
          );
        };
        return {
          left: shown("cross-left"),
          right: shown("cross-right"),
          edge: shown("crossing-edge"),
          sourceModelVisible: graph.getCellById("cross-left").isVisible(),
          targetModelVisible: graph.getCellById("cross-right").isVisible(),
        };
      }),
    )
    .toEqual({
      left: false,
      right: false,
      edge: true,
      sourceModelVisible: true,
      targetModelVisible: true,
    });
  const edge = page.locator('.x6-edge[data-cell-id="crossing-edge"]');
  await expect(edge).toBeVisible();
  const crossesViewport = await edge
    .locator("path[d]")
    .first()
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const viewport = document.querySelector(".x6-graph-scroller")!.getBoundingClientRect();
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error("Crossing edge transform unavailable");
      const length = path.getTotalLength();
      return Array.from({ length: 101 }, (_, index) => {
        const point = path.getPointAtLength((length * index) / 100).matrixTransform(matrix);
        return (
          point.x > viewport.left &&
          point.x < viewport.right &&
          point.y > viewport.top &&
          point.y < viewport.bottom
        );
      }).some(Boolean);
    });
  expect(crossesViewport).toBe(true);
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(snapshot);
});

test("scrolling to a distant culled node reveals it", async ({ page }) => {
  await fixture(page);
  const scrollDiagnostic = await page.evaluate(() => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const point = designer.graph!.localToClient(10060, 2020);
    const scroller = document.querySelector<HTMLElement>(".x6-graph-scroller")!;
    const rect = scroller.getBoundingClientRect();
    scroller.scrollLeft += point.x - rect.left - rect.width / 2;
    scroller.scrollTop += point.y - rect.top - rect.height / 2;
    return {
      point,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scroll: {
        x: scroller.scrollLeft,
        y: scroller.scrollTop,
        width: scroller.scrollWidth,
        height: scroller.scrollHeight,
      },
      targetAfter: designer.graph!.localToClient(10060, 2020),
    };
  });
  console.info("viewport-scroll", JSON.stringify(scrollDiagnostic));
  const node = page.locator('.x6-node[data-cell-id="far-node"]');
  await expect(node).toBeVisible();
  expect(
    await node.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const viewport = document.querySelector(".x6-graph-scroller")!.getBoundingClientRect();
      return (
        rect.left >= viewport.left &&
        rect.right <= viewport.right &&
        rect.top >= viewport.top &&
        rect.bottom <= viewport.bottom
      );
    }),
  ).toBe(true);
});

test("zoom-to-fit includes all model nodes, including previously culled nodes", async ({
  page,
}) => {
  const snapshot = await fixture(page);
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.graph!.zoomToFit(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const designer = (window as unknown as { designer: Designer }).designer;
        const graph = designer.graph!.getX6Graph() as GraphProjection;
        const viewport = document.querySelector(".x6-graph-scroller")!.getBoundingClientRect();
        return graph.getNodes().filter((node) => {
          const box = node.getBBox();
          const a = designer.graph!.localToClient(box.x, box.y);
          const b = designer.graph!.localToClient(box.x + box.width, box.y + box.height);
          const element = document.querySelector(`.x6-cell[data-cell-id="${node.id}"]`);
          const shown =
            !!element &&
            getComputedStyle(element).visibility !== "hidden" &&
            getComputedStyle(element).display !== "none";
          return (
            !node.isVisible() ||
            !shown ||
            a.x < viewport.left - 2 ||
            a.y < viewport.top - 2 ||
            b.x > viewport.right + 2 ||
            b.y > viewport.bottom + 2
          );
        }).length;
      }),
    )
    .toBe(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(snapshot);
});

test("culled-node selection, copy/paste and undo preserve model data and IDs", async ({ page }) => {
  const snapshot = await fixture(page);
  const restored = await page.evaluate(async () => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const node = designer.document.getContent().getNode("far-node");
    if (!node) throw new Error("Far node fixture missing");
    await designer.document.transaction("Move culled node", () => {
      node.setPosition(10100, 2100);
    });
    designer.document.getTimeline().back();
    return JSON.stringify(designer.document.getData());
  });
  expect(restored).toBe(snapshot);
  await page.evaluate(() => {
    const designer = (window as unknown as { designer: Designer }).designer;
    designer.graph!.select(["far-node"]);
    designer.document.getSelection().setKeys(["far-node"]);
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const designer = (window as unknown as { designer: Designer }).designer;
        const graph = designer.graph!.getX6Graph() as GraphProjection;
        const element = document.querySelector('.x6-cell[data-cell-id="far-node"]');
        return {
          visible:
            !!element &&
            getComputedStyle(element).visibility !== "hidden" &&
            getComputedStyle(element).display !== "none",
          modelVisible: graph.getCellById("far-node").isVisible(),
          selected: designer.graph!.getSelection(),
        };
      }),
    )
    .toEqual({ visible: true, modelVisible: true, selected: ["far-node"] });
  const canvas = page.locator('[data-fd-area="canvas"]');
  await canvas.focus();
  await canvas.press("ControlOrMeta+c");
  await canvas.press("ControlOrMeta+v");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { designer: Designer }).designer.document.getContent().getNodes()
            .length,
      ),
    )
    .toBe(505);
  const result = await page.evaluate(() => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const content = designer.document.getContent();
    return {
      originalPresent: !!content.getNode("far-node"),
      copied: content.getNodes().filter((node) => node.getProps().getData().name === "Far task")
        .length,
    };
  });
  expect(result).toEqual({ originalPresent: true, copied: 2 });
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.document.getTimeline().back(),
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(snapshot);
});

test("programmatic endpoint movement and undo invalidate crossing-edge viewport bounds", async ({
  page,
}) => {
  const snapshot = await fixture(page);
  await expect(page.locator('.x6-edge[data-cell-id="crossing-edge"]')).toBeVisible();
  await page.evaluate(async () => {
    const designer = (window as unknown as { designer: Designer }).designer;
    const content = designer.document.getContent();
    await designer.document.transaction("Move crossing endpoints offscreen", () => {
      content.getNode("cross-left")!.setPosition(-3000, 8000);
      content.getNode("cross-right")!.setPosition(3500, 8200);
    });
  });
  await expect(page.locator('.x6-edge[data-cell-id="crossing-edge"]')).toBeHidden();
  await page.evaluate(() =>
    (window as unknown as { designer: Designer }).designer.document.getTimeline().back(),
  );
  await expect(page.locator('.x6-edge[data-cell-id="crossing-edge"]')).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(snapshot);
});

test("a third-party obstacle reroute invalidates a culled edge without endpoint model changes", async ({
  page,
}) => {
  await fixture(page);
  await page.evaluate(async () => {
    const designer = (window as unknown as { designer: Designer }).designer;
    await designer.document.transaction("Move edge above viewport", () => {
      designer.document.getContent().getNode("cross-left")!.setPosition(-3000, -1200);
      designer.document.getContent().getNode("cross-right")!.setPosition(3500, -1200);
    });
    const graph = designer.graph!.getX6Graph() as any;
    graph.addNode({
      id: "routing-obstacle",
      shape: "fd-rect",
      x: 10000,
      y: -6000,
      width: 160,
      height: 6350,
    });
  });
  const edge = page.locator('.x6-edge[data-cell-id="crossing-edge"]');
  await expect(edge).toBeHidden();
  const model = await page.evaluate(() =>
    JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
  );
  await page.evaluate(() => {
    const graph = (window as unknown as { designer: Designer }).designer.graph!.getX6Graph() as any;
    graph.getCellById("routing-obstacle").position(500, -6000);
  });
  await expect(edge).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(model);
});

test("caller-hidden cells stay hidden after scrolling out and back into the viewport", async ({
  page,
}) => {
  const snapshot = await fixture(page);
  await page.evaluate(() => {
    const graph = (
      window as unknown as { designer: Designer }
    ).designer.graph!.getX6Graph() as GraphProjection;
    graph.getCellById("viewport-anchor").hide();
    graph.centerCell(graph.getCellById("far-node"));
  });
  await expect(page.locator('.x6-node[data-cell-id="far-node"]')).toBeVisible();
  await page.evaluate(() => {
    const graph = (
      window as unknown as { designer: Designer }
    ).designer.graph!.getX6Graph() as GraphProjection;
    graph.centerCell(graph.getCellById("viewport-anchor"));
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const graph = (
          window as unknown as { designer: Designer }
        ).designer.graph!.getX6Graph() as GraphProjection;
        return graph.getCellById("viewport-anchor").isVisible();
      }),
    )
    .toBe(false);
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as unknown as { designer: Designer }).designer.document.getData()),
    ),
  ).toBe(snapshot);
});
