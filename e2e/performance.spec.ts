import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Run against an explicitly started BPMN server. Results are observations, not FPS assertions.
for (const count of [100, 300, 500]) {
  test(`model-backed canvas performance: ${count} nodes`, async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean((window as any).designer?.editor.getGraph()));
    const profiler = process.env.PERF_PROFILE ? await page.context().newCDPSession(page) : null;
    if (profiler) {
      await profiler.send("Profiler.enable");
      await profiler.send("Profiler.start");
    }
    const result = await page.evaluate(async (count) => {
      const designer = (window as any).designer;
      const manager = designer.editor.getGraph();
      const graph = manager.getX6Graph();
      (window as any).__perfGeometryCount = 0;
      graph.on("edge:geometry:changed", () => (window as any).__perfGeometryCount++);
      (window as any).__waitPerfRoutes = () =>
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          let previous = -1;
          let stable = 0;
          const tick = () => {
            const total = (window as any).__perfGeometryCount;
            const ready = graph
              .getEdges()
              .every((edge: any) => graph.findViewByCell(edge)?.container.querySelector("path[d]"));
            stable = ready && total === previous ? stable + 1 : 0;
            previous = total;
            if (stable >= 5) resolve();
            else if (performance.now() - start > 15000)
              reject(new Error("Routes did not settle within15s"));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      const edgeCount = count === 500 ? 1000 : count * 2;
      const elements: any[] = Array.from({ length: count }, (_, i) => ({
        id: `perf-node-${i}`,
        typeName: "UserTask",
        props: { name: `Task ${i}` },
        position: {
          x: 100 + (i % 25) * 240,
          y: 100 + Math.floor(i / 25) * 120,
        },
      }));
      for (let i = 0; i < edgeCount; i++)
        elements.push({
          id: `perf-edge-${i}`,
          typeName: "SequenceFlow",
          sourceRef: `perf-node-${i % count}`,
          targetRef: `perf-node-${(i + 1 + Math.floor(i / count)) % count}`,
        });
      let nodeAddMs = 0;
      let edgeAddMs = 0;
      const addNode = manager.addNode.bind(manager);
      const addEdge = manager.addEdge.bind(manager);
      manager.addNode = (config: unknown) => {
        const start = performance.now();
        try {
          return addNode(config);
        } finally {
          nodeAddMs += performance.now() - start;
        }
      };
      manager.addEdge = (config: unknown) => {
        const start = performance.now();
        try {
          return addEdge(config);
        } finally {
          edgeAddMs += performance.now() - start;
        }
      };
      (window as any).__perfRoutingFailures = 0;
      graph.on("edge:routing:failed", () => (window as any).__perfRoutingFailures++);
      let added = 0;
      let removed = 0;
      let changed = 0;
      let changeKeys: Record<string, number> = {};
      graph.on("cell:added", () => added++);
      graph.on("cell:removed", () => removed++);
      graph.on("cell:change:*", ({ key }: { key: string }) => {
        changed++;
        changeKeys[key] = (changeKeys[key] ?? 0) + 1;
      });
      const start = performance.now();
      designer.document.load({
        id: "perf",
        documentType: "process",
        documentVersion: "1.0.0",
        elements,
      });
      const loadSyncMs = performance.now() - start;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const loadPaintMs = performance.now() - start;
      await (window as any).__waitPerfRoutes();
      const loadFinalRenderMs = performance.now() - start;
      const loaded = {
        nodes: graph.getNodes().length,
        edges: graph.getEdges().length,
        added,
        removed,
      };
      const node = designer.document.getContent().getNode("perf-node-0");
      const before = node.getPosition();
      const cell = graph.getCellById("perf-node-0");
      const originalCell = cell;
      changed = 0;
      const moveStart = performance.now();
      cell.position(before.x + 20, before.y + 20);
      graph.trigger("node:moved", { cell });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const moveMs = performance.now() - moveStart;
      const moved = node.getPosition();
      const moveChanges = changed;
      changed = 0;
      changeKeys = {};
      const undoStart = performance.now();
      const removedBeforeUndo = removed;
      designer.document.getTimeline().back();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const undoMs = performance.now() - undoStart;
      const restored = node.getPosition();
      return {
        count,
        edgeCount,
        loadSyncMs,
        loadPaintMs,
        loadFinalRenderMs,
        nodeAddMs,
        edgeAddMs,
        moveMs,
        undoMs,
        loaded,
        moved,
        restored,
        sameCellAfterUndo: graph.getCellById("perf-node-0") === originalCell,
        removedOnUndo: removed - removedBeforeUndo,
        moveChanges,
        undoChanges: changed,
        undoChangeKeys: changeKeys,
      };
    }, count);
    if (profiler) {
      const { profile } = await profiler.send("Profiler.stop");
      const counts = new Map<number, number>();
      for (const id of profile.samples ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
      const hottest = profile.nodes
        .map((node: any) => ({
          function: node.callFrame.functionName,
          url: node.callFrame.url,
          samples: counts.get(node.id) ?? 0,
        }))
        .filter((entry: any) => entry.samples)
        .sort((a: any, b: any) => b.samples - a.samples)
        .slice(0, 20);
      console.log("CPU_PROFILE", JSON.stringify(hottest));
      await profiler.detach();
    }
    expect(result.loaded.nodes).toBe(count);
    expect(result.loaded.edges).toBe(result.edgeCount);
    expect(result.moved.x).toBe(120);
    expect(result.restored.x).toBe(100);
    expect(result.sameCellAfterUndo).toBe(true);
    expect(result.removedOnUndo).toBe(0);
    await page.evaluate(() => {
      const graph = (window as any).designer.editor.getGraph().getX6Graph();
      const cell = graph.getCellById("perf-node-24");
      graph.centerCell(cell);
      const scroller = graph.getPlugin("scroller").container;
      const rect = scroller.getBoundingClientRect();
      const point = graph.localToClient(cell.getBBox().getCenter());
      // Leave enough real screen space for a 300px drag without touching edge-pan zones.
      scroller.scrollLeft += point.x - (rect.left + 180);
      scroller.scrollTop += point.y - (rect.top + 180);
      const stats = {
        positionEvents: 0,
        routePasses: 0,
        active: false,
        nodeId: "perf-node-24",
        routeEdges: {} as Record<string, number>,
      };
      (window as any).__perfDragStats = stats;
      graph.on("node:change:position", ({ node }: any) => {
        if (stats.active && node.id === stats.nodeId) stats.positionEvents++;
      });
      for (const edge of graph.getEdges()) {
        const view = graph.findViewByCell(edge);
        const original = view.findRoutePoints;
        view.findRoutePoints = function (...args: unknown[]) {
          if (stats.active) {
            stats.routePasses++;
            stats.routeEdges[edge.id] = (stats.routeEdges[edge.id] ?? 0) + 1;
          }
          return original.apply(this, args);
        };
      }
    });
    const dragDistance = Number(process.env.PERF_DRAG_DISTANCE ?? 300);
    const nodeView = page.locator('[data-cell-id="perf-node-24"]').first();
    const nodeBounds = await nodeView.boundingBox();
    expect(nodeBounds).not.toBeNull();
    const dragViewport = await page.locator(".x6-graph-scroller").boundingBox();
    expect(nodeBounds!.x + nodeBounds!.width / 2).toBeGreaterThan(dragViewport!.x + 24);
    expect(nodeBounds!.x + nodeBounds!.width / 2 + dragDistance).toBeLessThan(
      dragViewport!.x + dragViewport!.width - 24,
    );
    await page.evaluate(() => {
      const state = { active: true, times: [] as number[] };
      (window as any).__perfFrames = state;
      const tick = (time: number) => {
        if (state.active) {
          state.times.push(time);
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    const viewportSettleMs = await page.evaluate(async () => {
      const start = performance.now();
      await (window as any).__waitPerfRoutes();
      return performance.now() - start;
    });
    const dragProfiler = process.env.PERF_PROFILE ? await page.context().newCDPSession(page) : null;
    if (dragProfiler) {
      await dragProfiler.send("Profiler.enable");
      await dragProfiler.send("Profiler.start");
    }
    const dragStart = Date.now();
    await page.mouse.move(
      nodeBounds!.x + nodeBounds!.width / 2,
      nodeBounds!.y + nodeBounds!.height / 2,
    );
    await page.evaluate(() => {
      const frames = (window as any).__perfFrames;
      frames.times = [];
      const stats = (window as any).__perfDragStats;
      stats.active = true;
    });
    await page.mouse.down();
    await page.mouse.move(
      nodeBounds!.x + nodeBounds!.width / 2 + dragDistance,
      nodeBounds!.y + nodeBounds!.height / 2,
      { steps: 60 },
    );
    await page.mouse.up();
    const dragMs = Date.now() - dragStart;
    const dragSnapshot = await page.evaluate(() => {
      const frames = (window as any).__perfFrames;
      frames.active = false;
      const stats = (window as any).__perfDragStats;
      stats.active = false;
      return {
        intervals: frames.times.slice(1).map((time: number, i: number) => time - frames.times[i]),
        work: {
          positionEvents: stats.positionEvents,
          routePasses: stats.routePasses,
          routeEdges: stats.routeEdges,
        },
      };
    });
    const frameIntervals = dragSnapshot.intervals as number[];
    const dragWork = dragSnapshot.work;
    if (dragProfiler) {
      const { profile } = await dragProfiler.send("Profiler.stop");
      const profilePath = testInfo.outputPath("real-drag.cpuprofile.json");
      await writeFile(profilePath, JSON.stringify(profile));
      await testInfo.attach("real-drag.cpuprofile.json", {
        path: profilePath,
        contentType: "application/json",
      });
      const counts = new Map<number, number>();
      for (const id of profile.samples ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
      const hot = profile.nodes
        .map((node: any) => ({
          function: node.callFrame.functionName,
          url: node.callFrame.url,
          samples: counts.get(node.id) ?? 0,
        }))
        .filter((entry: any) => entry.samples)
        .sort((a: any, b: any) => b.samples - a.samples)
        .slice(0, 25);
      console.log("REAL_DRAG_CPU_PROFILE", JSON.stringify(hot));
      await dragProfiler.detach();
    }
    const actualPosition = await page.evaluate(() =>
      (window as any).designer.document.getContent().getNode("perf-node-24").getPosition(),
    );
    expect(Math.abs(actualPosition.x - 5860)).toBeGreaterThanOrEqual(dragDistance - 10);
    expect(dragWork.positionEvents).toBeGreaterThanOrEqual(
      Math.min(20, Math.floor(dragDistance / 10)),
    );
    const canvas = page.locator(".x6-graph-scroller").first();
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const scrollBefore = await canvas.evaluate((el) => ({
      x: el.scrollLeft,
      y: el.scrollTop,
    }));
    await page.evaluate(() => {
      const state = { active: true, times: [] as number[] };
      (window as any).__perfFrames = state;
      const tick = (time: number) => {
        if (state.active) {
          state.times.push(time);
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    const panStart = Date.now();
    await page.mouse.move(bounds!.x + 300, bounds!.y + 200);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(bounds!.x + 480, bounds!.y + 240, { steps: 60 });
    await page.mouse.up({ button: "middle" });
    const panMs = Date.now() - panStart;
    const scrollAfter = await canvas.evaluate((el) => ({
      x: el.scrollLeft,
      y: el.scrollTop,
    }));
    expect(scrollAfter).not.toEqual(scrollBefore);
    const panIntervals = await page.evaluate(() => {
      const state = (window as any).__perfFrames;
      state.active = false;
      return state.times.slice(1).map((time: number, i: number) => time - state.times[i]);
    });
    const zoomBefore = await page.evaluate(() =>
      (window as any).designer.editor.getGraph().getZoom(),
    );
    await page.evaluate(() => {
      const state = { active: true, times: [] as number[] };
      (window as any).__perfFrames = state;
      const tick = (time: number) => {
        if (state.active) {
          state.times.push(time);
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(bounds!.x + 450, bounds!.y + 250);
    const wheelStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -8);
      await page.waitForTimeout(16);
    }
    const zoomAfter = await page.evaluate(() =>
      (window as any).designer.editor.getGraph().getZoom(),
    );
    const zoom = {
      before: zoomBefore,
      after: zoomAfter,
      durationMs: Date.now() - wheelStart,
    };
    const wheelIntervals = await page.evaluate(() => {
      const state = (window as any).__perfFrames;
      state.active = false;
      return state.times.slice(1).map((time: number, i: number) => time - state.times[i]);
    });
    expect(zoom.after).toBeGreaterThan(zoom.before);
    const sorted = [...frameIntervals].sort((a, b) => a - b);
    const dragFrameP95Ms = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
    const dragFramesOver25Percent =
      (frameIntervals.filter((value) => value > 25).length / frameIntervals.length) * 100;
    await page.evaluate(() => (window as any).designer.editor.getGraph().zoomToFit());
    await page.waitForTimeout(100);
    await page.evaluate(async () => {
      const graph = (window as any).designer.editor.getGraph().getX6Graph();
      const cell = graph.getCellById("perf-node-24");
      graph.centerCell(cell);
      const scroller = graph.getPlugin("scroller").container;
      const rect = scroller.getBoundingClientRect();
      const point = graph.localToClient(cell.getBBox().getCenter());
      scroller.scrollLeft += point.x - (rect.left + 180);
      scroller.scrollTop += point.y - (rect.top + 180);
      const stats = (window as any).__perfDragStats;
      stats.nodeId = "perf-node-24";
      stats.routeEdges = {};
      stats.positionEvents = 0;
      stats.routePasses = 0;
      stats.active = false;
      await (window as any).__waitPerfRoutes();
    });
    const fitNode = await page.locator('[data-cell-id="perf-node-24"]').first().boundingBox();
    expect(fitNode).not.toBeNull();
    const fitPoint = await page.evaluate(() => {
      const graph = (window as any).designer.editor.getGraph().getX6Graph();
      return graph.localToClient(graph.getCellById("perf-node-24").getBBox().getCenter());
    });
    await page.evaluate(() => {
      const state = { active: true, times: [] as number[] };
      (window as any).__perfFrames = state;
      const tick = (time: number) => {
        if (state.active) {
          state.times.push(time);
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    const fitBefore = await page.evaluate(() =>
      (window as any).designer.document.getContent().getNode("perf-node-24").getPosition(),
    );
    const fitDragStart = Date.now();
    await page.mouse.move(fitPoint.x, fitPoint.y);
    await page.evaluate(() => {
      (window as any).__perfFrames.times = [];
      (window as any).__perfDragStats.active = true;
    });
    await page.mouse.down();
    await page.mouse.move(fitPoint.x + 300, fitPoint.y, { steps: 60 });
    await page.mouse.up();
    const fitDragMs = Date.now() - fitDragStart;
    const fitAfter = await page.evaluate(() =>
      (window as any).designer.document.getContent().getNode("perf-node-24").getPosition(),
    );
    expect(fitAfter).not.toEqual(fitBefore);
    const fitDragWork = await page.evaluate(() => {
      const stats = (window as any).__perfDragStats;
      stats.active = false;
      return {
        positionEvents: stats.positionEvents,
        routePasses: stats.routePasses,
        routeEdges: stats.routeEdges,
      };
    });
    expect(fitDragWork.positionEvents).toBeGreaterThanOrEqual(20);
    const fitIntervals = await page.evaluate(() => {
      const state = (window as any).__perfFrames;
      state.active = false;
      return state.times.slice(1).map((time: number, i: number) => time - state.times[i]);
    });
    const fitSorted = [...fitIntervals].sort((a, b) => a - b);
    const fitDragFrameP95Ms = fitSorted[Math.max(0, Math.ceil(fitSorted.length * 0.95) - 1)];
    const fitDragFramesOver25Percent =
      (fitIntervals.filter((value) => value > 25).length / fitIntervals.length) * 100;
    const summarize = (intervals: number[]) => {
      const sorted = [...intervals].sort((a, b) => a - b);
      return {
        frameP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)],
        over25Percent: (intervals.filter((value) => value > 25).length / intervals.length) * 100,
      };
    };
    const routing = await page.evaluate(() => {
      const graph = (window as any).designer.editor.getGraph().getX6Graph();
      return {
        edgeCount: graph.getEdges().length,
        failureEvents: (window as any).__perfRoutingFailures,
        errorElements: document.querySelectorAll("[data-routing-error]").length,
        renderedEdges: document.querySelectorAll(".x6-edge").length,
      };
    });
    const builtScripts = await page
      .locator("script[src]")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("src")));
    const measurement = {
      ...result,
      builtScripts,
      routing,
      viewportSettleMs,
      dragMs,
      dragDistancePx: dragDistance,
      dragWork,
      frameIntervals,
      dragFrameP95Ms,
      dragFramesOver25Percent,
      actualPosition,
      panMs,
      panIntervals,
      panFrames: summarize(panIntervals),
      scrollBefore,
      scrollAfter,
      zoom,
      wheelIntervals,
      wheelFrames: summarize(wheelIntervals),
      fitBefore,
      fitAfter,
      fitDragMs,
      fitDragWork,
      fitIntervals,
      fitDragFrameP95Ms,
      fitDragFramesOver25Percent,
      mode: process.env.PERF_MODE ?? "unspecified",
      cpuProfiled: Boolean(process.env.PERF_PROFILE),
    };
    const artifact = testInfo.outputPath("performance.json");
    await writeFile(artifact, JSON.stringify(measurement, null, 2));
    await testInfo.attach("performance.json", {
      path: artifact,
      contentType: "application/json",
    });
    console.log(JSON.stringify(measurement));
  });
}
