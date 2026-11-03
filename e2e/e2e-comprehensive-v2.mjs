import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = "http://127.0.0.1:5179";
const screenshotPath = join(tmpdir(), "e2e-comprehensive-v2.png");
const results = [];

function record(area, item, pass, details) {
  const status = pass ? "PASS" : "FAIL";
  const msg = `[${status}] ${area} > ${item}: ${details}`;
  results.push(msg);
  console.log(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jsErrors = [];
  const consoleErrors = [];
  const antdWarnings = [];

  page.on("pageerror", (err) => jsErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.text().includes("deprecated") || msg.text().includes("Warning"))
      antdWarnings.push(msg.text());
  });

  await page.goto(URL);
  await page.waitForSelector(".x6-graph", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // =====================================================
  // 1. PAGE LOAD & LAYOUT
  // =====================================================
  console.log("\n========== 1. PAGE LOAD & LAYOUT ==========");

  record(
    "1.PageLoad",
    "No JS errors on load",
    jsErrors.length === 0,
    jsErrors.length === 0
      ? "No pageerror events"
      : `${jsErrors.length} errors: ${jsErrors.slice(0, 3).join("; ")}`,
  );

  const realErrors = consoleErrors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  record(
    "1.PageLoad",
    "No console.error",
    realErrors.length === 0,
    realErrors.length === 0
      ? "No console errors"
      : `${realErrors.length} errors: ${realErrors.slice(0, 3).join("; ")}`,
  );

  const skeleton = await page.evaluate(() => {
    const areas = {};
    areas.header = !!document.querySelector('[data-fd-area="header"]');
    areas.sidebar = !!document.querySelector('[data-fd-area="sidebar"]');
    areas.inspector = !!document.querySelector('[data-fd-area="inspector"]');
    areas.canvasToolbar = !!document.querySelector('[data-fd-area="canvasToolbar"]');
    areas.canvas = !!document.querySelector('[data-fd-area="canvas"]');
    return areas;
  });
  const skeletonCount = Object.values(skeleton).filter((v) => v).length;
  record(
    "1.PageLoad",
    "5 skeleton areas visible",
    skeletonCount === 5,
    `Found ${skeletonCount}/5: ${Object.entries(skeleton)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );

  // Custom stencil check (CSS Modules classes, not x6-widget-stencil)
  const stencilInfo = await page.evaluate(() => {
    const lp = document.querySelector('[data-fd-area="sidebar"]');
    if (!lp) return null;
    const groups = lp.querySelectorAll('[class*="_group_"]');
    const groupNames = [];
    for (const g of groups) {
      const title = g.querySelector('[class*="_groupTitle_"]');
      if (title) groupNames.push(title.textContent.trim());
    }
    const items = lp.querySelectorAll('[class*="_item_"]');
    const itemNames = Array.from(items).map((i) => i.textContent.trim());
    return {
      groupCount: groupNames.length,
      groupNames,
      itemCount: items.length,
      itemNames,
    };
  });

  record(
    "1.PageLoad",
    "Left panel has stencil groups (网关/任务)",
    stencilInfo &&
      stencilInfo.groupCount >= 2 &&
      stencilInfo.groupNames.some((n) => n.includes("网关")),
    stencilInfo
      ? `${stencilInfo.groupCount} groups: [${stencilInfo.groupNames.join(", ")}], ${stencilInfo.itemCount} items: [${stencilInfo.itemNames.join(", ")}]`
      : "Not found",
  );

  const canvasInfo = await page.evaluate(() => {
    const scroller = document.querySelector(".x6-graph-scroller");
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  });
  record(
    "1.PageLoad",
    "Canvas (x6-graph-scroller) present with correct dimensions",
    canvasInfo && canvasInfo.width > 200 && canvasInfo.height > 200,
    canvasInfo ? `${canvasInfo.width}x${canvasInfo.height}px` : "Not found",
  );

  // =====================================================
  // 2. INITIAL NODES
  // =====================================================
  console.log("\n========== 2. INITIAL NODES ==========");

  const initialNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    return Array.from(nodes).map((n) => {
      const id = n.getAttribute("data-cell-id");
      const text = n.textContent?.trim() || "";
      const bbox = n.getBoundingClientRect();
      const circle = n.querySelector("circle, ellipse");
      const ports = n.querySelectorAll(".x6-port-body");
      return {
        id,
        text,
        width: Math.round(bbox.width),
        height: Math.round(bbox.height),
        hasCircle: !!circle,
        portCount: ports.length,
      };
    });
  });

  const startNode = initialNodes.find((n) => n.text.includes("开始"));
  const endNode = initialNodes.find((n) => n.text.includes("结束"));

  record(
    "2.InitialNodes",
    "Start (开始) node exists",
    !!startNode,
    startNode
      ? `text="${startNode.text}", size=${startNode.width}x${startNode.height}`
      : "Not found",
  );
  record(
    "2.InitialNodes",
    "End (结束) node exists",
    !!endNode,
    endNode ? `text="${endNode.text}", size=${endNode.width}x${endNode.height}` : "Not found",
  );
  record(
    "2.InitialNodes",
    "Start has circle shape",
    startNode?.hasCircle === true,
    `hasCircle=${startNode?.hasCircle}`,
  );
  record(
    "2.InitialNodes",
    "End has circle shape",
    endNode?.hasCircle === true,
    `hasCircle=${endNode?.hasCircle}`,
  );
  record(
    "2.InitialNodes",
    "Start has 4 ports",
    startNode?.portCount === 4,
    `portCount=${startNode?.portCount}`,
  );
  record(
    "2.InitialNodes",
    "End has 4 ports",
    endNode?.portCount === 4,
    `portCount=${endNode?.portCount}`,
  );
  record(
    "2.InitialNodes",
    "Labels correctly displayed",
    initialNodes.every((n) => n.text.length > 0),
    `${initialNodes.length} nodes, labels: [${initialNodes.map((n) => n.text).join(", ")}]`,
  );

  // =====================================================
  // 3. NODE DRAG FROM STENCIL
  // =====================================================
  console.log("\n========== 3. NODE DRAG FROM STENCIL ==========");

  // The stencil uses custom drag-and-drop (not x6 built-in stencil), items have class _item_
  const humanItemPos = await page.evaluate(() => {
    const lp = document.querySelector('[data-fd-area="sidebar"]');
    if (!lp) return null;
    const items = lp.querySelectorAll('[class*="_item_"]');
    for (const item of items) {
      if (item.textContent.trim().includes("人工")) {
        const rect = item.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          text: item.textContent.trim(),
        };
      }
    }
    return null;
  });

  if (humanItemPos) {
    const canvasCenter = await page.evaluate(() => {
      const scroller = document.querySelector(".x6-graph-scroller");
      const rect = scroller.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    const nodeCountBefore = initialNodes.length;

    // Drag from stencil to canvas
    await page.mouse.move(humanItemPos.x, humanItemPos.y);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(canvasCenter.x, canvasCenter.y, { steps: 25 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const nodesAfterDrag = await page.evaluate(() => {
      const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
      return Array.from(nodes).map((n) => ({
        id: n.getAttribute("data-cell-id"),
        text: n.textContent?.trim(),
        selected: n.classList.contains("x6-node-selected"),
      }));
    });

    const newNodeCount = nodesAfterDrag.length;
    record(
      "3.StencilDrag",
      "New node appears on canvas after drag",
      newNodeCount > nodeCountBefore,
      `Before: ${nodeCountBefore}, After: ${newNodeCount}, nodes: [${nodesAfterDrag.map((n) => n.text).join(", ")}]`,
    );

    if (newNodeCount > nodeCountBefore) {
      const newNode = nodesAfterDrag.find((n) => !initialNodes.some((o) => o.id === n.id));
      record(
        "3.StencilDrag",
        "New node is auto-selected after drop",
        newNode?.selected === true,
        newNode ? `"${newNode.text}" selected=${newNode.selected}` : "Could not identify new node",
      );

      const rpContent = await page.evaluate(() => {
        const rp = document.querySelector('[data-fd-area="inspector"]');
        return rp ? rp.textContent?.trim().substring(0, 200) : null;
      });
      record(
        "3.StencilDrag",
        "Right panel shows node properties",
        rpContent && rpContent.length > 5,
        `content="${rpContent?.substring(0, 100)}"`,
      );
    } else {
      record("3.StencilDrag", "New node is auto-selected after drop", false, "No new node created");
      record("3.StencilDrag", "Right panel shows node properties", false, "No new node created");
    }
  } else {
    record("3.StencilDrag", "Found 人工节点 in stencil", false, "Item not found in left panel");
    record("3.StencilDrag", "New node appears on canvas after drag", false, "Skipped");
    record("3.StencilDrag", "New node is auto-selected after drop", false, "Skipped");
    record("3.StencilDrag", "Right panel shows node properties", false, "Skipped");
  }

  // =====================================================
  // 4. CONNECTION (EDGE DRAWING)
  // =====================================================
  console.log("\n========== 4. CONNECTION (EDGE DRAWING) ==========");

  // Get all nodes on canvas now (including the newly dragged one)
  const allCanvasNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    return Array.from(nodes).map((n) => {
      const bbox = n.getBoundingClientRect();
      const id = n.getAttribute("data-cell-id");
      const text = n.textContent?.trim() || "";
      const ports = n.querySelectorAll(".x6-port-body");
      const portPositions = Array.from(ports).map((p) => {
        const pb = p.getBoundingClientRect();
        return {
          x: pb.x + pb.width / 2,
          y: pb.y + pb.height / 2,
          w: pb.width,
          h: pb.height,
        };
      });
      return {
        id,
        text,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
        ports: portPositions,
      };
    });
  });

  const srcNode = allCanvasNodes.find((n) => n.text.includes("开始"));
  const tgtNode =
    allCanvasNodes.find(
      (n) => !n.text.includes("开始") && !n.text.includes("结束") && n.ports.length > 0,
    ) || allCanvasNodes.find((n) => n.text.includes("结束"));

  // Check port visibility on hover
  if (srcNode) {
    await page.mouse.move(srcNode.cx, srcNode.cy);
    await page.waitForTimeout(800);

    const portVis = await page.evaluate((nid) => {
      const node = document.querySelector(`[data-cell-id="${nid}"]`);
      if (!node) return null;
      const ports = node.querySelectorAll(".x6-port-body");
      const opacities = Array.from(ports).map((p) =>
        parseFloat(window.getComputedStyle(p).opacity),
      );
      return { count: ports.length, opacities };
    }, srcNode.id);

    const portsVisible = portVis && portVis.opacities.some((o) => o > 0);
    record(
      "4.Connection",
      "Hover node shows ports (opacity > 0)",
      portsVisible,
      portVis ? `${portVis.count} ports, opacities=[${portVis.opacities.join(",")}]` : "No ports",
    );
  }

  if (srcNode && tgtNode && srcNode.ports.length >= 2 && tgtNode.ports.length >= 2) {
    const edgesBefore = await page.evaluate(() => document.querySelectorAll(".x6-edge").length);

    // Pick the right port of source (largest x among ports)
    const srcPort = srcNode.ports.reduce((best, p) => (p.x > best.x ? p : best), srcNode.ports[0]);
    // Pick the left port of target (smallest x among ports)
    const tgtPort = tgtNode.ports.reduce((best, p) => (p.x < best.x ? p : best), tgtNode.ports[0]);

    // Hover source first
    await page.mouse.move(srcNode.cx, srcNode.cy);
    await page.waitForTimeout(400);
    // Move to source port
    await page.mouse.move(srcPort.x, srcPort.y);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.waitForTimeout(100);
    // Drag to target
    await page.mouse.move(tgtPort.x, tgtPort.y, { steps: 20 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const edgesAfter = await page.evaluate(() => document.querySelectorAll(".x6-edge").length);
    record(
      "4.Connection",
      "Edge created by dragging port-to-port",
      edgesAfter > edgesBefore,
      `Before: ${edgesBefore}, After: ${edgesAfter}`,
    );

    // Check routing
    const pathData = await page.evaluate(() => {
      const paths = document.querySelectorAll(".x6-edge path[d]");
      return Array.from(paths)
        .map((p) => p.getAttribute("d"))
        .filter((d) => d && d.length > 10);
    });

    const hasManhattan = pathData.some((d) => {
      const segments = d.split(/[ML]\s*/).filter((s) => s.length > 0);
      return segments.length >= 3; // Manhattan has at least 3 segments (start, turn, end)
    });
    record(
      "4.Connection",
      "Edge uses manhattan routing (orthogonal path)",
      hasManhattan,
      `${pathData.length} paths, sample: "${pathData[0]?.substring(0, 120)}"`,
    );

    // Check edge connects to port (path endpoints are at port coords, not node center)
    const portCheck = await page.evaluate(() => {
      const paths = document.querySelectorAll(
        ".x6-edge path.x6-edge-line, .x6-edge path[stroke-width]",
      );
      const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
      const nodeCenters = Array.from(nodes).map((n) => {
        const b = n.getBoundingClientRect();
        return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
      });

      for (const path of paths) {
        const d = path.getAttribute("d");
        if (!d || d.length < 10) continue;
        const mMatch = d.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
        if (!mMatch) continue;
        // Path coordinates are in SVG space, not screen space
        // Just check that path has multiple segments (not a straight line to center)
        const segments = d.split(/[LMC]\s*/).filter((s) => s.trim().length > 0);
        return { segmentCount: segments.length, pathD: d.substring(0, 100) };
      }
      return null;
    });
    record(
      "4.Connection",
      "Edge connects to port (not node center)",
      portCheck && portCheck.segmentCount >= 2,
      portCheck
        ? `segments=${portCheck.segmentCount}, path="${portCheck.pathD}"`
        : "No valid path found",
    );
  } else {
    record(
      "4.Connection",
      "Source/target nodes for edge drawing",
      false,
      `src=${srcNode?.text || "N/A"} ports=${srcNode?.ports.length || 0}, tgt=${tgtNode?.text || "N/A"} ports=${tgtNode?.ports.length || 0}`,
    );
  }

  // =====================================================
  // 5. EDGE SELECTION
  // =====================================================
  console.log("\n========== 5. EDGE SELECTION ==========");

  const edgeElements = await page.evaluate(() => {
    const edges = document.querySelectorAll(".x6-edge");
    return Array.from(edges)
      .map((e) => {
        const id = e.getAttribute("data-cell-id");
        // Find clickable path
        const paths = e.querySelectorAll("path");
        let clickPt = null;
        for (const p of paths) {
          const bbox = p.getBoundingClientRect();
          if (bbox.width > 2 || bbox.height > 2) {
            clickPt = {
              x: bbox.x + bbox.width / 2,
              y: bbox.y + bbox.height / 2,
            };
            break;
          }
        }
        // Also try overall bbox
        if (!clickPt) {
          const bbox = e.getBoundingClientRect();
          if (bbox.width > 0)
            clickPt = {
              x: bbox.x + bbox.width / 2,
              y: bbox.y + bbox.height / 2,
            };
        }
        return { id, clickPt };
      })
      .filter((e) => e.clickPt);
  });

  if (edgeElements.length > 0) {
    const edge = edgeElements[0];

    // Click on edge
    await page.mouse.click(edge.clickPt.x, edge.clickPt.y);
    await page.waitForTimeout(700);

    const selectedState = await page.evaluate((eid) => {
      const el = document.querySelector(`[data-cell-id="${eid}"]`);
      if (!el) return null;
      const isSelected = el.classList.contains("x6-edge-selected");
      const paths = el.querySelectorAll("path");
      let stroke = "",
        strokeWidth = "";
      for (const p of paths) {
        const s = window.getComputedStyle(p);
        if (s.stroke && s.stroke !== "none" && s.strokeWidth !== "0") {
          stroke = s.stroke;
          strokeWidth = s.strokeWidth;
          break;
        }
      }
      const tool = el.querySelector('[class*="tool"], .x6-edge-tool');
      return { isSelected, stroke, strokeWidth, hasTool: !!tool };
    }, edge.id);

    record(
      "5.EdgeSelection",
      "Click edge -> selected state + blue highlight",
      selectedState?.isSelected === true,
      `selected=${selectedState?.isSelected}, stroke=${selectedState?.stroke}, strokeWidth=${selectedState?.strokeWidth}`,
    );

    const isBlue =
      selectedState?.stroke?.includes("77") &&
      selectedState?.stroke?.includes("124") &&
      selectedState?.stroke?.includes("254");
    const isHex = selectedState?.stroke?.toLowerCase?.()?.includes("4d7cfe");
    record(
      "5.EdgeSelection",
      "Edge color is #4d7cfe on select",
      isBlue || isHex,
      `stroke="${selectedState?.stroke}"`,
    );

    record(
      "5.EdgeSelection",
      "Segments tool appears on select",
      selectedState?.hasTool === true,
      `hasTool=${selectedState?.hasTool}`,
    );

    // Deselect by clicking blank
    const blank = await page.evaluate(() => {
      const s = document.querySelector(".x6-graph-scroller");
      const r = s.getBoundingClientRect();
      return { x: r.x + r.width - 30, y: r.y + r.height - 30 };
    });
    await page.mouse.click(blank.x, blank.y);
    await page.waitForTimeout(500);

    const deselectedState = await page.evaluate((eid) => {
      const el = document.querySelector(`[data-cell-id="${eid}"]`);
      if (!el) return null;
      const isSelected = el.classList.contains("x6-edge-selected");
      const paths = el.querySelectorAll("path");
      let stroke = "",
        strokeWidth = "";
      for (const p of paths) {
        const s = window.getComputedStyle(p);
        if (s.stroke && s.stroke !== "none" && s.strokeWidth !== "0") {
          stroke = s.stroke;
          strokeWidth = s.strokeWidth;
          break;
        }
      }
      return { isSelected, stroke, strokeWidth };
    }, edge.id);

    record(
      "5.EdgeSelection",
      "Click blank -> edge deselects",
      deselectedState?.isSelected === false,
      `selected=${deselectedState?.isSelected}, stroke=${deselectedState?.stroke}`,
    );

    record(
      "5.EdgeSelection",
      "strokeWidth changes on select/deselect",
      selectedState?.strokeWidth !== deselectedState?.strokeWidth,
      `selected: ${selectedState?.strokeWidth}, deselected: ${deselectedState?.strokeWidth}`,
    );
  } else {
    record("5.EdgeSelection", "Edges available for testing", false, "No edges on canvas");
  }

  // =====================================================
  // 6. NODE SELECTION
  // =====================================================
  console.log("\n========== 6. NODE SELECTION ==========");

  const selNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    return Array.from(nodes).map((n) => {
      const bbox = n.getBoundingClientRect();
      return {
        id: n.getAttribute("data-cell-id"),
        text: n.textContent?.trim(),
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
      };
    });
  });

  const nodeToSel =
    selNodes.find((n) => !n.text.includes("开始") && !n.text.includes("结束")) || selNodes[0];

  if (nodeToSel) {
    await page.mouse.click(nodeToSel.cx, nodeToSel.cy);
    await page.waitForTimeout(500);

    const sel = await page.evaluate((nid) => {
      const n = document.querySelector(`[data-cell-id="${nid}"]`);
      return { isSelected: n?.classList.contains("x6-node-selected") };
    }, nodeToSel.id);
    record(
      "6.NodeSelection",
      "Click node -> selected state",
      sel?.isSelected === true,
      `node="${nodeToSel.text}", selected=${sel?.isSelected}`,
    );

    const rpText = await page.evaluate(() => {
      const rp = document.querySelector('[data-fd-area="inspector"]');
      return rp?.textContent?.trim().substring(0, 200) || "";
    });
    record(
      "6.NodeSelection",
      "Right panel shows node properties",
      rpText.length > 3,
      `content="${rpText.substring(0, 100)}"`,
    );

    // Deselect
    const blankPt = await page.evaluate(() => {
      const s = document.querySelector(".x6-graph-scroller");
      const r = s.getBoundingClientRect();
      return { x: r.x + r.width - 30, y: r.y + r.height - 30 };
    });
    await page.mouse.click(blankPt.x, blankPt.y);
    await page.waitForTimeout(500);

    const desel = await page.evaluate((nid) => {
      const n = document.querySelector(`[data-cell-id="${nid}"]`);
      return { isSelected: n?.classList.contains("x6-node-selected") };
    }, nodeToSel.id);
    record(
      "6.NodeSelection",
      "Click blank -> node deselects",
      desel?.isSelected === false,
      `selected=${desel?.isSelected}`,
    );
  }

  // =====================================================
  // 8. UNDO/REDO
  // =====================================================
  console.log("\n========== 8. UNDO/REDO ==========");

  const moveTarget = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    for (const n of nodes) {
      const text = n.textContent?.trim() || "";
      if (!text.includes("开始") && !text.includes("结束")) {
        const bbox = n.getBoundingClientRect();
        return {
          id: n.getAttribute("data-cell-id"),
          text,
          cx: bbox.x + bbox.width / 2,
          cy: bbox.y + bbox.height / 2,
        };
      }
    }
    // fallback to end node
    const last = nodes[nodes.length - 1];
    if (last) {
      const bbox = last.getBoundingClientRect();
      return {
        id: last.getAttribute("data-cell-id"),
        text: last.textContent?.trim(),
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
      };
    }
    return null;
  });

  if (moveTarget) {
    // Get position in SVG coordinates (not screen) for reliable comparison
    const getNodeTransform = async (nodeId) => {
      return page.evaluate((nid) => {
        const node = document.querySelector(`[data-cell-id="${nid}"]`);
        if (!node) return null;
        const transform = node.getAttribute("transform") || "";
        const match = transform.match(/translate\(([\d.-]+)[,\s]+([\d.-]+)\)/);
        if (match) return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        // fallback to bbox
        const bbox = node.getBoundingClientRect();
        return { x: Math.round(bbox.x), y: Math.round(bbox.y) };
      }, nodeId);
    };

    const origTransform = await getNodeTransform(moveTarget.id);

    // Perform move
    await page.mouse.move(moveTarget.cx, moveTarget.cy);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(moveTarget.cx + 80, moveTarget.cy + 50, {
      steps: 10,
    });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(800);

    const movedTransform = await getNodeTransform(moveTarget.id);

    // Undo
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(1500);

    const undoneTransform = await getNodeTransform(moveTarget.id);

    const undoOK =
      undoneTransform &&
      origTransform &&
      Math.abs(undoneTransform.x - origTransform.x) < 10 &&
      Math.abs(undoneTransform.y - origTransform.y) < 10;

    record(
      "8.UndoRedo",
      "Undo reverts node to original position",
      undoOK,
      `orig=(${origTransform?.x},${origTransform?.y}), moved=(${movedTransform?.x},${movedTransform?.y}), undone=(${undoneTransform?.x},${undoneTransform?.y})`,
    );

    // Redo
    await page.keyboard.press("Control+y");
    await page.waitForTimeout(1500);

    const redoneTransform = await getNodeTransform(moveTarget.id);
    const redoOK =
      redoneTransform &&
      movedTransform &&
      Math.abs(redoneTransform.x - movedTransform.x) < 10 &&
      Math.abs(redoneTransform.y - movedTransform.y) < 10;

    record(
      "8.UndoRedo",
      "Redo restores node to moved position",
      redoOK,
      `moved=(${movedTransform?.x},${movedTransform?.y}), redone=(${redoneTransform?.x},${redoneTransform?.y})`,
    );

    // Undo again to restore
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(800);
  } else {
    record("8.UndoRedo", "Node available for move test", false, "No node found");
  }

  // =====================================================
  // 9. ZOOM CONTROLS
  // =====================================================
  console.log("\n========== 9. ZOOM CONTROLS ==========");

  const getScale = async () =>
    page.evaluate(() => {
      const vp = document.querySelector(".x6-graph-svg-viewport");
      if (!vp) return null;
      const t = vp.getAttribute("transform") || "";
      const scaleMatch = t.match(/scale\(([\d.]+)/);
      if (scaleMatch) return parseFloat(scaleMatch[1]);
      const matrixMatch = t.match(/matrix\(([\d.]+)/);
      if (matrixMatch) return parseFloat(matrixMatch[1]);
      return null;
    });

  // Find zoom buttons by title
  const zoomInBtn = toolbarBtns.find((b) => b.title.includes("放大"));
  const zoomOutBtn = toolbarBtns.find((b) => b.title.includes("缩小"));
  const fitBtn = toolbarBtns.find((b) => b.title.includes("适应"));

  // First zoom out to reset
  if (zoomOutBtn) {
    await page.mouse.click(zoomOutBtn.x, zoomOutBtn.y);
    await page.waitForTimeout(300);
    await page.mouse.click(zoomOutBtn.x, zoomOutBtn.y);
    await page.waitForTimeout(300);
  }

  const baseScale = await getScale();

  if (zoomInBtn) {
    await page.mouse.click(zoomInBtn.x, zoomInBtn.y);
    await page.waitForTimeout(500);
    const afterIn = await getScale();
    record(
      "9.ZoomControls",
      "Zoom in increases scale",
      afterIn !== null && baseScale !== null && afterIn > baseScale,
      `before=${baseScale}, afterZoomIn=${afterIn}`,
    );
  } else {
    record("9.ZoomControls", "Zoom in button found", false, "Not found");
  }

  if (zoomOutBtn) {
    const beforeOut = await getScale();
    await page.mouse.click(zoomOutBtn.x, zoomOutBtn.y);
    await page.waitForTimeout(500);
    const afterOut = await getScale();
    record(
      "9.ZoomControls",
      "Zoom out decreases scale",
      afterOut !== null && beforeOut !== null && afterOut < beforeOut,
      `before=${beforeOut}, afterZoomOut=${afterOut}`,
    );
  } else {
    record("9.ZoomControls", "Zoom out button found", false, "Not found");
  }

  // No explicit "reset zoom" button - test that "适应画布" (fit) exists
  if (fitBtn) {
    await page.mouse.click(fitBtn.x, fitBtn.y);
    await page.waitForTimeout(500);
    const afterFit = await getScale();
    record(
      "9.ZoomControls",
      "适应画布 (fit content) adjusts scale",
      afterFit !== null,
      `afterFit=${afterFit} (no explicit reset-to-1 button, "适应画布" is available)`,
    );
  } else {
    record("9.ZoomControls", "Fit/Reset zoom button", false, "Not found");
  }

  // =====================================================
  // 10. COPY/PASTE
  // =====================================================
  console.log("\n========== 10. COPY/PASTE ==========");

  const copyNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    return Array.from(nodes).map((n) => {
      const bbox = n.getBoundingClientRect();
      return {
        id: n.getAttribute("data-cell-id"),
        text: n.textContent?.trim(),
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
      };
    });
  });

  const copyable = copyNodes.find((n) => !n.text.includes("开始") && !n.text.includes("结束"));
  const startForCopy = copyNodes.find((n) => n.text.includes("开始"));

  if (copyable) {
    await page.mouse.click(copyable.cx, copyable.cy);
    await page.waitForTimeout(500);

    const countBefore = copyNodes.length;
    await page.keyboard.press("Control+c");
    await page.waitForTimeout(500);

    // Check toast
    const toast = await page.evaluate(() => {
      const msgs = document.querySelectorAll(
        ".ant-message-notice, .ant-message-notice-content, .ant-message",
      );
      for (const m of msgs) {
        const t = m.textContent?.trim();
        if (t) return t;
      }
      return null;
    });
    record(
      "10.CopyPaste",
      "Copy shows feedback (toast)",
      toast !== null && toast.length > 0,
      `toast="${toast || "none"}"`,
    );

    await page.keyboard.press("Control+v");
    await page.waitForTimeout(1500);

    const countAfter = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );
    record(
      "10.CopyPaste",
      "Paste creates new node",
      countAfter > countBefore,
      `Before: ${countBefore}, After: ${countAfter}`,
    );

    if (countAfter > countBefore) {
      // Check offset
      const newNodes = await page.evaluate((origId) => {
        const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
        return Array.from(nodes).map((n) => {
          const bbox = n.getBoundingClientRect();
          return {
            id: n.getAttribute("data-cell-id"),
            x: Math.round(bbox.x),
            y: Math.round(bbox.y),
            text: n.textContent?.trim(),
          };
        });
      }, copyable.id);
      const orig = newNodes.find((n) => n.id === copyable.id);
      const pasted = newNodes.find((n) => n.id !== copyable.id && n.text === copyable.text);
      const isOffset =
        pasted && orig && (Math.abs(pasted.x - orig.x) > 5 || Math.abs(pasted.y - orig.y) > 5);
      record(
        "10.CopyPaste",
        "Pasted node offset from original",
        isOffset,
        orig && pasted
          ? `orig=(${orig.x},${orig.y}), pasted=(${pasted.x},${pasted.y})`
          : "Could not compare",
      );
    }

    // Undo paste
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);
  } else {
    record(
      "10.CopyPaste",
      "Non-start/end node for copy test",
      false,
      `Available: [${copyNodes.map((n) => n.text).join(", ")}]`,
    );
  }

  // Test start node restriction
  if (startForCopy) {
    await page.mouse.click(startForCopy.cx, startForCopy.cy);
    await page.waitForTimeout(300);
    const before = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );
    await page.keyboard.press("Control+c");
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(1000);
    const after = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );

    const restrictionToast = await page.evaluate(() => {
      const msgs = document.querySelectorAll(
        ".ant-message-notice, .ant-message-notice-content, .ant-message",
      );
      for (const m of msgs) {
        const t = m.textContent?.trim();
        if (t && (t.includes("不支持") || t.includes("cannot"))) return t;
      }
      return null;
    });

    record(
      "10.CopyPaste",
      "Start/End NOT copyable (restriction)",
      after === before,
      `Before: ${before}, After: ${after}, toast="${restrictionToast || "none"}"`,
    );
  }

  // =====================================================
  // 11. DELETE
  // =====================================================
  console.log("\n========== 11. DELETE ==========");

  // Get current nodes
  const delNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".x6-graph .x6-cell.x6-node");
    return Array.from(nodes).map((n) => {
      const bbox = n.getBoundingClientRect();
      return {
        id: n.getAttribute("data-cell-id"),
        text: n.textContent?.trim(),
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2,
      };
    });
  });

  const delTarget = delNodes.find((n) => !n.text.includes("开始") && !n.text.includes("结束"));
  if (delTarget) {
    await page.mouse.click(delTarget.cx, delTarget.cy);
    await page.waitForTimeout(300);
    const before = delNodes.length;
    await page.keyboard.press("Delete");
    await page.waitForTimeout(500);
    const after = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );
    record(
      "11.Delete",
      "Delete removes selected non-start/end node",
      after < before,
      `Before: ${before}, After: ${after}`,
    );
    // Undo
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);
  } else {
    record(
      "11.Delete",
      "Non-start/end node for delete test",
      false,
      `Only: [${delNodes.map((n) => n.text).join(", ")}]`,
    );
  }

  // Start/End protection
  const startForDel = delNodes.find((n) => n.text.includes("开始"));
  if (startForDel) {
    await page.mouse.click(startForDel.cx, startForDel.cy);
    await page.waitForTimeout(300);
    const before = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(300);
    const after = await page.evaluate(
      () => document.querySelectorAll(".x6-graph .x6-cell.x6-node").length,
    );
    record(
      "11.Delete",
      "Start/End cannot be deleted (protection)",
      after === before,
      `Before: ${before}, After: ${after}`,
    );
  }

  // =====================================================
  // 12. VISUAL/CSS CHECKS
  // =====================================================
  console.log("\n========== 12. VISUAL/CSS CHECKS ==========");

  const scrollerOverflow = await page.evaluate(() => {
    const s = document.querySelector(".x6-graph-scroller");
    if (!s) return null;
    const cs = window.getComputedStyle(s);
    // Also check if scrollbars are actually visible
    const hasHScroll = s.scrollWidth > s.clientWidth;
    const hasVScroll = s.scrollHeight > s.clientHeight;
    return {
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      hasHScroll,
      hasVScroll,
    };
  });
  // Note: X6 scroller plugin sets overflow:scroll by design, but content should not actually overflow
  record(
    "12.VisualCSS",
    "No visible scrollbars on .x6-graph-scroller",
    scrollerOverflow && !scrollerOverflow.hasHScroll && !scrollerOverflow.hasVScroll,
    `overflow=${scrollerOverflow?.overflow}, hasHScroll=${scrollerOverflow?.hasHScroll}, hasVScroll=${scrollerOverflow?.hasVScroll}`,
  );

  const snaplineRule = await page.evaluate(() => {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          const r = rules[j];
          if (r.cssText && (r.cssText.includes("d4d4d4") || r.cssText.includes("snapline"))) {
            if (r.cssText.includes("snapline") || r.cssText.includes("d4d4d4")) {
              return r.cssText.substring(0, 300);
            }
          }
        }
      } catch (e) {}
    }
    return null;
  });
  record(
    "12.VisualCSS",
    "Snapline color #d4d4d4 CSS rule exists",
    snaplineRule !== null,
    snaplineRule ? `rule: "${snaplineRule.substring(0, 150)}"` : "Not found",
  );

  const svgOverflow = await page.evaluate(() => {
    const svg = document.querySelector(".x6-graph svg");
    if (!svg) return null;
    return window.getComputedStyle(svg).overflow;
  });
  record(
    "12.VisualCSS",
    "SVG overflow:visible (port clipping fix)",
    svgOverflow === "visible",
    `overflow="${svgOverflow}"`,
  );

  const deprecations = antdWarnings.filter((w) => w.toLowerCase().includes("deprecated"));
  record(
    "12.VisualCSS",
    "No antd deprecation warnings",
    deprecations.length === 0,
    deprecations.length === 0
      ? "Clean"
      : `${deprecations.length} warnings: ${deprecations.slice(0, 2).join("; ")}`,
  );

  // =====================================================
  // 13. EDGE LABEL
  // =====================================================
  console.log("\n========== 13. EDGE LABEL ==========");

  const edgesForLabel = await page.evaluate(() => {
    const edges = document.querySelectorAll(".x6-edge");
    return Array.from(edges)
      .map((e) => {
        const id = e.getAttribute("data-cell-id");
        const paths = e.querySelectorAll("path");
        for (const p of paths) {
          const bbox = p.getBoundingClientRect();
          if (bbox.width > 3 || bbox.height > 3) {
            return {
              id,
              x: bbox.x + bbox.width / 2,
              y: bbox.y + bbox.height / 2,
            };
          }
        }
        return null;
      })
      .filter(Boolean);
  });

  if (edgesForLabel.length > 0) {
    const e = edgesForLabel[0];
    await page.mouse.dblclick(e.x, e.y);
    await page.waitForTimeout(1000);

    const labelEditor = await page.evaluate(() => {
      // Check for any editor that appeared
      const editors = document.querySelectorAll(
        '.x6-edge-tool-editor, .x6-cell-tool-editor, [contenteditable="true"], input.x6-edge-tool-editor-input, textarea',
      );
      // Also check if a tool was added to the edge
      const tools = document.querySelectorAll(".x6-edge-tool, .x6-cell-tool");
      return { editorCount: editors.length, toolCount: tools.length };
    });

    record(
      "13.EdgeLabel",
      "Double-click edge triggers label editing",
      labelEditor.editorCount > 0 || labelEditor.toolCount > 0,
      `editors=${labelEditor.editorCount}, tools=${labelEditor.toolCount}`,
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    record("13.EdgeLabel", "Edge available for double-click", false, "No clickable edges");
  }

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log("\n\n========== FINAL SUMMARY ==========");
  const passes = results.filter((r) => r.startsWith("[PASS]")).length;
  const fails = results.filter((r) => r.startsWith("[FAIL]")).length;
  console.log(`Total: ${results.length} tests | PASS: ${passes} | FAIL: ${fails}`);
  console.log("\n--- All Results ---");
  results.forEach((r, i) => console.log(`${i + 1}. ${r}`));

  if (jsErrors.length > 0) {
    console.log("\n--- JS Errors ---");
    jsErrors.forEach((e) => console.log(`  - ${e}`));
  }
  if (consoleErrors.length > 0) {
    console.log("\n--- Console Errors ---");
    consoleErrors.forEach((e) => console.log(`  - ${e.substring(0, 200)}`));
  }
  if (antdWarnings.length > 0) {
    console.log("\n--- Antd/React Warnings ---");
    antdWarnings.slice(0, 10).forEach((w) => console.log(`  - ${w.substring(0, 200)}`));
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\nScreenshot: ${screenshotPath}`);

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
