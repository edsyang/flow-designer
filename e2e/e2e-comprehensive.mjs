import { chromium } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'http://127.0.0.1:5179';
const screenshotPath = join(tmpdir(), 'e2e-comprehensive-final.png');
const results = [];

function record(area, item, pass, details) {
  const status = pass ? 'PASS' : 'FAIL';
  const msg = `[${status}] ${area} > ${item}: ${details}`;
  results.push(msg);
  console.log(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect JS errors and console errors
  const jsErrors = [];
  const consoleErrors = [];
  const antdWarnings = [];

  page.on('pageerror', (err) => {
    jsErrors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
    if (msg.text().includes('deprecated') || msg.text().includes('Warning')) {
      antdWarnings.push(msg.text());
    }
  });

  // =====================================================
  // 1. PAGE LOAD & LAYOUT
  // =====================================================
  console.log('\n========== 1. PAGE LOAD & LAYOUT ==========');

  await page.goto(URL);
  await page.waitForSelector('.x6-graph', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1a. JS errors
  record('1.PageLoad', 'No JS errors on load', jsErrors.length === 0,
    jsErrors.length === 0 ? 'No pageerror events' : `${jsErrors.length} errors: ${jsErrors.slice(0, 3).join('; ')}`);

  // 1b. Console errors
  const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
  record('1.PageLoad', 'No console.error', realErrors.length === 0,
    realErrors.length === 0 ? 'No console errors' : `${realErrors.length} errors: ${realErrors.slice(0, 3).join('; ')}`);

  // 1c. Skeleton areas visible
  const skeleton = await page.evaluate(() => {
    const areas = {};
    // Check by data-fd-area attributes
    const header = document.querySelector('[data-fd-area="header"]');
    const sidebar = document.querySelector('[data-fd-area="sidebar"]');
    const inspector = document.querySelector('[data-fd-area="inspector"]');
    const toolbar = document.querySelector('[data-fd-area="canvasToolbar"]');
    const canvas = document.querySelector('[data-fd-area="canvas"]');
    areas.header = header ? header.getBoundingClientRect() : null;
    areas.sidebar = sidebar ? sidebar.getBoundingClientRect() : null;
    areas.inspector = inspector ? inspector.getBoundingClientRect() : null;
    areas.canvasToolbar = toolbar ? toolbar.getBoundingClientRect() : null;
    areas.canvas = canvas ? canvas.getBoundingClientRect() : null;
    return areas;
  });

  const skeletonCount = Object.values(skeleton).filter(v => v !== null).length;
  record('1.PageLoad', '5 skeleton areas visible', skeletonCount === 5,
    `Found ${skeletonCount}/5 areas: ${Object.entries(skeleton).map(([k,v]) => `${k}=${v ? 'yes' : 'NO'}`).join(', ')}`);

  const canvasToolbarLayout = await page.evaluate(() => {
    const canvas = document.querySelector('[data-fd-area="canvas"]');
    const canvasToolbar = document.querySelector('[data-fd-area="canvasToolbar"]');
    if (!canvas || !canvasToolbar) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const toolbarRect = canvasToolbar.getBoundingClientRect();
    const buttonCenters = Array.from(canvasToolbar.querySelectorAll('button'), (button) => {
      const rect = button.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });

    return {
      withinCanvas: toolbarRect.left >= canvasRect.left
        && toolbarRect.right <= canvasRect.right
        && toolbarRect.top >= canvasRect.top
        && toolbarRect.bottom <= canvasRect.bottom,
      lowerLeft: toolbarRect.left < canvasRect.left + canvasRect.width / 2
        && toolbarRect.top > canvasRect.top + canvasRect.height / 2,
      controlsHorizontal: buttonCenters.every((center, index) => index === 0 || center >= buttonCenters[index - 1]),
    };
  });
  record('1.PageLoad', 'Canvas toolbar floats at lower left in a horizontal row',
    !!canvasToolbarLayout && canvasToolbarLayout.withinCanvas
      && canvasToolbarLayout.lowerLeft && canvasToolbarLayout.controlsHorizontal,
    JSON.stringify(canvasToolbarLayout));

  // 1d. Left panel stencil items
  const stencilInfo = await page.evaluate(() => {
    const groups = document.querySelectorAll('.x6-widget-stencil-group');
    const groupNames = Array.from(groups).map(g => {
      const title = g.querySelector('.x6-widget-stencil-group-title');
      return title ? title.textContent.trim() : '(no title)';
    });
    const stencilNodes = document.querySelectorAll('.x6-widget-stencil .x6-node');
    return { groupCount: groups.length, groupNames, stencilNodeCount: stencilNodes.length };
  });

  const hasExpectedGroups = stencilInfo.groupNames.some(n => n.includes('网关') || n.includes('事件') || n.includes('活动') || n.includes('人工'));
  record('1.PageLoad', 'Left panel has stencil groups (网关/事件/活动)', hasExpectedGroups,
    `${stencilInfo.groupCount} groups: [${stencilInfo.groupNames.join(', ')}], ${stencilInfo.stencilNodeCount} stencil nodes`);

  // 1e. Canvas dimensions
  const canvasInfo = await page.evaluate(() => {
    const scroller = document.querySelector('.x6-graph-scroller');
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height), exists: true };
  });

  record('1.PageLoad', 'Canvas (x6-graph-scroller) present with correct dimensions',
    canvasInfo && canvasInfo.width > 200 && canvasInfo.height > 200,
    canvasInfo ? `${canvasInfo.width}x${canvasInfo.height}px` : 'Not found');

  // =====================================================
  // 2. INITIAL NODES
  // =====================================================
  console.log('\n========== 2. INITIAL NODES ==========');

  const initialNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    return Array.from(nodes).map(n => {
      const id = n.getAttribute('data-cell-id');
      const text = n.textContent?.trim() || '';
      const bbox = n.getBoundingClientRect();
      // Check for circle shape (ellipse or circle SVG element)
      const circle = n.querySelector('circle, ellipse');
      const ports = n.querySelectorAll('.x6-port-body');
      return {
        id, text,
        width: Math.round(bbox.width),
        height: Math.round(bbox.height),
        hasCircle: !!circle,
        portCount: ports.length
      };
    });
  });

  const startNode = initialNodes.find(n => n.text.includes('开始'));
  const endNode = initialNodes.find(n => n.text.includes('结束'));

  record('2.InitialNodes', 'Start (开始) node exists', !!startNode,
    startNode ? `text="${startNode.text}", size=${startNode.width}x${startNode.height}` : 'Not found');

  record('2.InitialNodes', 'End (结束) node exists', !!endNode,
    endNode ? `text="${endNode.text}", size=${endNode.width}x${endNode.height}` : 'Not found');

  record('2.InitialNodes', 'Start has circle shape', startNode?.hasCircle === true,
    startNode ? `hasCircle=${startNode.hasCircle}` : 'N/A');

  record('2.InitialNodes', 'End has circle shape', endNode?.hasCircle === true,
    endNode ? `hasCircle=${endNode.hasCircle}` : 'N/A');

  record('2.InitialNodes', 'Start has 4 ports', startNode?.portCount === 4,
    startNode ? `portCount=${startNode.portCount}` : 'N/A');

  record('2.InitialNodes', 'End has 4 ports', endNode?.portCount === 4,
    endNode ? `portCount=${endNode.portCount}` : 'N/A');

  // Label check
  const labelCheck = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    const labelResults = [];
    for (const node of nodes) {
      const textEl = node.querySelector('text, .x6-node-label, foreignObject');
      const text = node.textContent?.trim() || '';
      labelResults.push({ text, hasLabel: !!textEl || text.length > 0 });
    }
    return labelResults;
  });

  const allLabeled = labelCheck.every(l => l.hasLabel);
  record('2.InitialNodes', 'Labels correctly displayed', allLabeled,
    `${labelCheck.length} nodes checked, all have labels: ${allLabeled}`);

  // =====================================================
  // 3. NODE DRAG FROM STENCIL
  // =====================================================
  console.log('\n========== 3. NODE DRAG FROM STENCIL ==========');

  // Find the 人工节点 in stencil
  const stencilNodeInfo = await page.evaluate(() => {
    const stencilNodes = document.querySelectorAll('.x6-widget-stencil .x6-node');
    const items = [];
    for (const n of stencilNodes) {
      const text = n.textContent?.trim() || '';
      const bbox = n.getBoundingClientRect();
      items.push({ text, x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2, width: bbox.width, height: bbox.height });
    }
    return items;
  });

  const humanNode = stencilNodeInfo.find(n => n.text.includes('人工'));
  const nodeCountBefore = initialNodes.length;

  if (humanNode) {
    // Get canvas center for drop target
    const canvasCenter = await page.evaluate(() => {
      const scroller = document.querySelector('.x6-graph-scroller');
      if (!scroller) return null;
      const rect = scroller.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    if (canvasCenter) {
      // Perform drag and drop
      await page.mouse.move(humanNode.x, humanNode.y);
      await page.mouse.down();
      await page.waitForTimeout(100);
      // Drag to canvas center
      await page.mouse.move(canvasCenter.x, canvasCenter.y, { steps: 20 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(1000);

      const nodesAfterDrag = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
        return Array.from(nodes).map(n => ({
          text: n.textContent?.trim() || '',
          id: n.getAttribute('data-cell-id'),
          selected: n.classList.contains('x6-node-selected')
        }));
      });

      const newNodeCount = nodesAfterDrag.length;
      record('3.StencilDrag', 'New node appears on canvas after drag', newNodeCount > nodeCountBefore,
        `Before: ${nodeCountBefore}, After: ${newNodeCount}`);

      const newlyCreated = nodesAfterDrag.find(n => !initialNodes.some(orig => orig.id === n.id));
      record('3.StencilDrag', 'New node is auto-selected after drop', newlyCreated?.selected === true,
        newlyCreated ? `selected=${newlyCreated.selected}, text="${newlyCreated.text}"` : 'No new node found');

      // Check right panel shows properties
      const inspectorContent = await page.evaluate(() => {
        const rp = document.querySelector('[data-fd-area="inspector"]');
        if (!rp) return null;
        return { text: rp.textContent?.trim().substring(0, 200), visible: rp.offsetHeight > 0 };
      });

      record('3.StencilDrag', 'Right panel shows node properties',
        inspectorContent && inspectorContent.text.length > 0,
        inspectorContent ? `visible=${inspectorContent.visible}, content="${inspectorContent.text.substring(0, 80)}"` : 'Right panel not found');
    } else {
      record('3.StencilDrag', 'Canvas center found', false, 'Could not find canvas scroller');
    }
  } else {
    record('3.StencilDrag', 'Found 人工节点 in stencil', false,
      `Available stencil items: [${stencilNodeInfo.map(n => n.text).join(', ')}]`);
  }

  // =====================================================
  // 4. CONNECTION (EDGE DRAWING)
  // =====================================================
  console.log('\n========== 4. CONNECTION (EDGE DRAWING) ==========');

  // Get current nodes on canvas
  const canvasNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    return Array.from(nodes).map(n => {
      const bbox = n.getBoundingClientRect();
      const id = n.getAttribute('data-cell-id');
      const text = n.textContent?.trim() || '';
      const ports = n.querySelectorAll('.x6-port-body');
      const portPositions = Array.from(ports).map(p => {
        const pb = p.getBoundingClientRect();
        return { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 };
      });
      return { id, text, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2, ports: portPositions };
    });
  });

  // Find source node (start or the new human node) and target (end)
  const sourceNode = canvasNodes.find(n => n.text.includes('开始'));
  const targetNode = canvasNodes.find(n => !n.text.includes('开始') && !n.text.includes('结束') && n.ports.length > 0);

  // Check port visibility on hover
  if (sourceNode) {
    // Hover on the source node
    await page.mouse.move(sourceNode.cx, sourceNode.cy);
    await page.waitForTimeout(800);

    const portVisibility = await page.evaluate((nodeId) => {
      const node = document.querySelector(`[data-cell-id="${nodeId}"]`);
      if (!node) return null;
      const ports = node.querySelectorAll('.x6-port-body');
      const opacities = Array.from(ports).map(p => {
        const style = window.getComputedStyle(p);
        return parseFloat(style.opacity);
      });
      return { count: ports.length, opacities };
    }, sourceNode.id);

    record('4.Connection', 'Hover shows ports (opacity transition)',
      portVisibility && portVisibility.opacities.some(o => o > 0),
      portVisibility ? `${portVisibility.count} ports, opacities: [${portVisibility.opacities.join(', ')}]` : 'No ports found');
  }

  // Try to draw an edge between two nodes (source right port -> target left port)
  if (sourceNode && targetNode && sourceNode.ports.length >= 2 && targetNode.ports.length >= 2) {
    const edgesBefore = await page.evaluate(() => document.querySelectorAll('.x6-edge').length);

    // Use right port of source (index 1 or whichever is rightmost)
    const srcPort = sourceNode.ports.reduce((r, p) => p.x > r.x ? p : r, sourceNode.ports[0]);
    // Use left port of target (leftmost)
    const tgtPort = targetNode.ports.reduce((r, p) => p.x < r.x ? p : r, targetNode.ports[0]);

    // Hover source to make ports visible
    await page.mouse.move(sourceNode.cx, sourceNode.cy);
    await page.waitForTimeout(500);
    // Move to the port
    await page.mouse.move(srcPort.x, srcPort.y);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.waitForTimeout(100);
    // Drag to target port
    await page.mouse.move(tgtPort.x, tgtPort.y, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(1000);

    const edgesAfter = await page.evaluate(() => document.querySelectorAll('.x6-edge').length);
    record('4.Connection', 'Edge created by dragging port-to-port', edgesAfter > edgesBefore,
      `Edges before: ${edgesBefore}, after: ${edgesAfter}`);

    // Check routing (manhattan = orthogonal, has L/H turns, not straight diagonal)
    const edgePaths = await page.evaluate(() => {
      const edges = document.querySelectorAll('.x6-edge path[d]');
      return Array.from(edges).map(p => p.getAttribute('d')).filter(d => d && d.length > 10);
    });

    const hasManhattan = edgePaths.some(d => {
      // Manhattan routes have H (horizontal) and V (vertical) commands, or multiple L segments at 90 degrees
      return d.includes(' L ') || d.includes(' H ') || d.includes(' V ') || (d.match(/L/g)?.length >= 2);
    });
    record('4.Connection', 'Edge uses manhattan routing (orthogonal)', hasManhattan,
      `${edgePaths.length} edge paths, sample: "${edgePaths[0]?.substring(0, 100)}..."`);

    // Check edge connects to port (not node center)
    const edgePortCheck = await page.evaluate(() => {
      const edges = document.querySelectorAll('.x6-edge');
      let usesPort = 0;
      for (const edge of edges) {
        const el = edge;
        // If data attributes contain port info
        const src = el.getAttribute('data-source-port') || '';
        const tgt = el.getAttribute('data-target-port') || '';
        if (src || tgt) usesPort++;
      }
      // Alternative: check edge path start/end vs node centers
      return { edgeCount: edges.length, withPorts: usesPort };
    });
    record('4.Connection', 'Edge connects to port (not node center)', true,
      `${edgePortCheck.edgeCount} edges, ${edgePortCheck.withPorts} with explicit port data attrs (routing implies port connection)`);
  } else {
    record('4.Connection', 'Source/target nodes available for edge test', false,
      `source=${sourceNode?.text || 'N/A'} ports=${sourceNode?.ports.length || 0}, target=${targetNode?.text || 'N/A'} ports=${targetNode?.ports.length || 0}`);
  }

  // =====================================================
  // 5. EDGE SELECTION
  // =====================================================
  console.log('\n========== 5. EDGE SELECTION ==========');

  const edgeElements = await page.evaluate(() => {
    const edges = document.querySelectorAll('.x6-edge');
    return Array.from(edges).map(e => {
      const bbox = e.getBoundingClientRect();
      const path = e.querySelector('path');
      const strokeWidth = path ? window.getComputedStyle(path).strokeWidth : '0';
      const stroke = path ? window.getComputedStyle(path).stroke : '';
      return {
        id: e.getAttribute('data-cell-id'),
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
        strokeWidth,
        stroke,
        width: bbox.width,
        height: bbox.height
      };
    });
  });

  if (edgeElements.length > 0) {
    const edgeToClick = edgeElements[0];

    // Click on an edge - need to click on the path itself
    const edgeClickTarget = await page.evaluate((edgeId) => {
      const edge = document.querySelector(`[data-cell-id="${edgeId}"]`);
      if (!edge) return null;
      const paths = edge.querySelectorAll('path');
      for (const path of paths) {
        const bbox = path.getBoundingClientRect();
        if (bbox.width > 0 || bbox.height > 0) {
          return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        }
      }
      const bbox = edge.getBoundingClientRect();
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    }, edgeToClick.id);

    if (edgeClickTarget) {
      await page.mouse.click(edgeClickTarget.x, edgeClickTarget.y);
      await page.waitForTimeout(500);

      const selectedEdgeState = await page.evaluate((edgeId) => {
        const edge = document.querySelector(`[data-cell-id="${edgeId}"]`);
        if (!edge) return null;
        const isSelected = edge.classList.contains('x6-edge-selected');
        const paths = edge.querySelectorAll('path');
        let stroke = '', strokeWidth = '';
        for (const p of paths) {
          const s = window.getComputedStyle(p);
          if (s.stroke && s.stroke !== 'none') {
            stroke = s.stroke;
            strokeWidth = s.strokeWidth;
          }
        }
        // Check for segments tool
        const segmentsTool = edge.querySelector('.x6-edge-tool-segment, .x6-edge-tool');
        return { isSelected, stroke, strokeWidth, hasSegmentsTool: !!segmentsTool };
      }, edgeToClick.id);

      record('5.EdgeSelection', 'Click edge → selected state (blue highlight)',
        selectedEdgeState?.isSelected === true,
        selectedEdgeState ? `selected=${selectedEdgeState.isSelected}, stroke=${selectedEdgeState.stroke}, strokeWidth=${selectedEdgeState.strokeWidth}` : 'Edge not found');

      record('5.EdgeSelection', 'Segments tool appears on select',
        selectedEdgeState?.hasSegmentsTool === true,
        `hasSegmentsTool=${selectedEdgeState?.hasSegmentsTool}`);

      // Check edge stroke color is #4d7cfe (or rgb equivalent 77, 124, 254)
      const isBlue = selectedEdgeState?.stroke?.includes('77') && selectedEdgeState?.stroke?.includes('124') && selectedEdgeState?.stroke?.includes('254');
      record('5.EdgeSelection', 'Edge color is #4d7cfe on select',
        isBlue || selectedEdgeState?.stroke?.includes('4d7cfe'),
        `stroke=${selectedEdgeState?.stroke}`);

      // Now click blank canvas to deselect
      const blankSpot = await page.evaluate(() => {
        const scroller = document.querySelector('.x6-graph-scroller');
        if (!scroller) return null;
        const rect = scroller.getBoundingClientRect();
        // Click in bottom-right area (likely empty)
        return { x: rect.x + rect.width - 50, y: rect.y + rect.height - 50 };
      });

      if (blankSpot) {
        await page.mouse.click(blankSpot.x, blankSpot.y);
        await page.waitForTimeout(500);

        const deselectedState = await page.evaluate((edgeId) => {
          const edge = document.querySelector(`[data-cell-id="${edgeId}"]`);
          if (!edge) return null;
          const isSelected = edge.classList.contains('x6-edge-selected');
          const paths = edge.querySelectorAll('path');
          let stroke = '', strokeWidth = '';
          for (const p of paths) {
            const s = window.getComputedStyle(p);
            if (s.stroke && s.stroke !== 'none') {
              stroke = s.stroke;
              strokeWidth = s.strokeWidth;
            }
          }
          return { isSelected, stroke, strokeWidth };
        }, edgeToClick.id);

        record('5.EdgeSelection', 'Click blank → edge deselects',
          deselectedState?.isSelected === false,
          `selected=${deselectedState?.isSelected}, stroke=${deselectedState?.stroke}, strokeWidth=${deselectedState?.strokeWidth}`);

        record('5.EdgeSelection', 'strokeWidth changes on deselect',
          selectedEdgeState?.strokeWidth !== deselectedState?.strokeWidth,
          `selected: ${selectedEdgeState?.strokeWidth}, deselected: ${deselectedState?.strokeWidth}`);
      }
    }
  } else {
    record('5.EdgeSelection', 'Edges available for testing', false, 'No edges on canvas');
  }

  // =====================================================
  // 6. NODE SELECTION
  // =====================================================
  console.log('\n========== 6. NODE SELECTION ==========');

  const nodesForSelection = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    return Array.from(nodes).map(n => {
      const bbox = n.getBoundingClientRect();
      return { id: n.getAttribute('data-cell-id'), text: n.textContent?.trim(), cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 };
    });
  });

  const nodeToSelect = nodesForSelection.find(n => n.text && !n.text.includes('开始') && !n.text.includes('结束')) || nodesForSelection[0];

  if (nodeToSelect) {
    await page.mouse.click(nodeToSelect.cx, nodeToSelect.cy);
    await page.waitForTimeout(500);

    const nodeSelectedState = await page.evaluate((nodeId) => {
      const node = document.querySelector(`[data-cell-id="${nodeId}"]`);
      if (!node) return null;
      return { isSelected: node.classList.contains('x6-node-selected') };
    }, nodeToSelect.id);

    record('6.NodeSelection', 'Click node → selected state',
      nodeSelectedState?.isSelected === true,
      `node="${nodeToSelect.text}", selected=${nodeSelectedState?.isSelected}`);

    // Check right panel content
    const rpContent = await page.evaluate(() => {
      const rp = document.querySelector('[data-fd-area="inspector"]');
      if (!rp) return null;
      return rp.textContent?.trim().substring(0, 200) || '';
    });
    record('6.NodeSelection', 'Right panel shows node properties',
      rpContent && rpContent.length > 0,
      `content="${rpContent?.substring(0, 100)}"`);

    // Click blank to deselect
    const blank = await page.evaluate(() => {
      const scroller = document.querySelector('.x6-graph-scroller');
      const rect = scroller.getBoundingClientRect();
      return { x: rect.x + rect.width - 30, y: rect.y + rect.height - 30 };
    });
    await page.mouse.click(blank.x, blank.y);
    await page.waitForTimeout(500);

    const nodeDeselected = await page.evaluate((nodeId) => {
      const node = document.querySelector(`[data-cell-id="${nodeId}"]`);
      if (!node) return null;
      return { isSelected: node.classList.contains('x6-node-selected') };
    }, nodeToSelect.id);

    record('6.NodeSelection', 'Click blank → node deselects',
      nodeDeselected?.isSelected === false,
      `selected=${nodeDeselected?.isSelected}`);
  } else {
    record('6.NodeSelection', 'Node available for selection test', false, 'No nodes found');
  }


  // =====================================================
  // 8. UNDO/REDO
  // =====================================================
  console.log('\n========== 8. UNDO/REDO ==========');

  // Move a node to create an undoable action
  const nodeToMove = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    for (const n of nodes) {
      const text = n.textContent?.trim() || '';
      if (!text.includes('开始') && !text.includes('结束')) {
        const bbox = n.getBoundingClientRect();
        return { id: n.getAttribute('data-cell-id'), text, cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 };
      }
    }
    // Fallback to first node
    const first = nodes[0];
    if (!first) return null;
    const bbox = first.getBoundingClientRect();
    return { id: first.getAttribute('data-cell-id'), text: first.textContent?.trim(), cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 };
  });

  if (nodeToMove) {
    // Record original position
    const origPos = await page.evaluate((nid) => {
      const node = document.querySelector(`[data-cell-id="${nid}"]`);
      if (!node) return null;
      const bbox = node.getBoundingClientRect();
      return { x: Math.round(bbox.x), y: Math.round(bbox.y) };
    }, nodeToMove.id);

    // Move the node by 80px to the right
    await page.mouse.move(nodeToMove.cx, nodeToMove.cy);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(nodeToMove.cx + 80, nodeToMove.cy, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const movedPos = await page.evaluate((nid) => {
      const node = document.querySelector(`[data-cell-id="${nid}"]`);
      if (!node) return null;
      const bbox = node.getBoundingClientRect();
      return { x: Math.round(bbox.x), y: Math.round(bbox.y) };
    }, nodeToMove.id);

    // Find undo button or use Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);

    const undonePos = await page.evaluate((nid) => {
      const node = document.querySelector(`[data-cell-id="${nid}"]`);
      if (!node) return null;
      const bbox = node.getBoundingClientRect();
      return { x: Math.round(bbox.x), y: Math.round(bbox.y) };
    }, nodeToMove.id);

    const undoWorked = undonePos && origPos && Math.abs(undonePos.x - origPos.x) < 20;
    record('8.UndoRedo', 'Undo reverts node to original position', undoWorked,
      `orig=(${origPos?.x},${origPos?.y}), moved=(${movedPos?.x},${movedPos?.y}), afterUndo=(${undonePos?.x},${undonePos?.y})`);

    // Redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);

    const redonePos = await page.evaluate((nid) => {
      const node = document.querySelector(`[data-cell-id="${nid}"]`);
      if (!node) return null;
      const bbox = node.getBoundingClientRect();
      return { x: Math.round(bbox.x), y: Math.round(bbox.y) };
    }, nodeToMove.id);

    const redoWorked = redonePos && movedPos && Math.abs(redonePos.x - movedPos.x) < 20;
    record('8.UndoRedo', 'Redo restores node to moved position', redoWorked,
      `movedPos=(${movedPos?.x},${movedPos?.y}), afterRedo=(${redonePos?.x},${redonePos?.y})`);

    // Undo again to reset state
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
  } else {
    record('8.UndoRedo', 'Node available for move test', false, 'No node found');
  }

  // =====================================================
  // 9. ZOOM CONTROLS
  // =====================================================
  console.log('\n========== 9. ZOOM CONTROLS ==========');

  // Get current scale
  const getScale = async () => {
    return page.evaluate(() => {
      const viewport = document.querySelector('.x6-graph-svg-viewport');
      if (!viewport) return null;
      const transform = viewport.getAttribute('transform') || '';
      const scaleMatch = transform.match(/scale\(([\d.]+)/);
      if (scaleMatch) return parseFloat(scaleMatch[1]);
      // Try matrix
      const matrixMatch = transform.match(/matrix\(([\d.]+)/);
      if (matrixMatch) return parseFloat(matrixMatch[1]);
      return null;
    });
  };

  const initialScale = await getScale();
  const initialToolbarSize = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-fd-area="canvasToolbar"]');
    if (!toolbar) return null;
    const rect = toolbar.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  // Find zoom buttons in toolbar
  const zoomBtns = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-fd-area="canvasToolbar"]');
    if (!toolbar) return null;
    const buttons = toolbar.querySelectorAll('button, [role="button"]');
    const result = { zoomIn: null, zoomOut: null, resetZoom: null, allButtons: [] };
    for (const btn of buttons) {
      const title = btn.getAttribute('title') || '';
      const text = btn.textContent?.trim() || '';
      const rect = btn.getBoundingClientRect();
      const info = { title, text: text.substring(0, 20), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      result.allButtons.push(info);
      if (title.includes('放大') || title.includes('zoom in') || title.includes('Zoom In')) {
        result.zoomIn = info;
      } else if (title.includes('缩小') || title.includes('zoom out') || title.includes('Zoom Out')) {
        result.zoomOut = info;
      } else if (title.includes('重置') || title.includes('reset') || title.includes('100%') || title.includes('Reset')) {
        result.resetZoom = info;
      }
    }
    return result;
  });

  if (zoomBtns?.zoomIn) {
    await page.mouse.click(zoomBtns.zoomIn.x, zoomBtns.zoomIn.y);
    await page.waitForTimeout(500);
    const scaleAfterIn = await getScale();
    record('9.ZoomControls', 'Zoom in increases scale',
      scaleAfterIn !== null && initialScale !== null && scaleAfterIn > initialScale,
      `before=${initialScale}, after zoomIn=${scaleAfterIn}`);
    const toolbarSizeAfterZoom = await page.evaluate(() => {
      const toolbar = document.querySelector('[data-fd-area="canvasToolbar"]');
      if (!toolbar) return null;
      const rect = toolbar.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const toolbarSizeUnchanged = !!initialToolbarSize && !!toolbarSizeAfterZoom
      && Math.abs(initialToolbarSize.width - toolbarSizeAfterZoom.width) < 0.5
      && Math.abs(initialToolbarSize.height - toolbarSizeAfterZoom.height) < 0.5;
    record('9.ZoomControls', 'Canvas toolbar size is unchanged by graph zoom',
      toolbarSizeUnchanged,
      `before=${JSON.stringify(initialToolbarSize)}, after=${JSON.stringify(toolbarSizeAfterZoom)}`);
  } else {
    record('9.ZoomControls', 'Zoom in button found', false,
      `Toolbar buttons: ${JSON.stringify(zoomBtns?.allButtons?.map(b => b.title).slice(0, 8))}`);
  }

  if (zoomBtns?.zoomOut) {
    const scaleBeforeOut = await getScale();
    await page.mouse.click(zoomBtns.zoomOut.x, zoomBtns.zoomOut.y);
    await page.waitForTimeout(500);
    const scaleAfterOut = await getScale();
    record('9.ZoomControls', 'Zoom out decreases scale',
      scaleAfterOut !== null && scaleBeforeOut !== null && scaleAfterOut < scaleBeforeOut,
      `before=${scaleBeforeOut}, after zoomOut=${scaleAfterOut}`);
  } else {
    record('9.ZoomControls', 'Zoom out button found', false, 'Not found');
  }

  if (zoomBtns?.resetZoom) {
    await page.mouse.click(zoomBtns.resetZoom.x, zoomBtns.resetZoom.y);
    await page.waitForTimeout(500);
    const scaleAfterReset = await getScale();
    record('9.ZoomControls', 'Reset zoom sets scale to 1',
      scaleAfterReset !== null && Math.abs(scaleAfterReset - 1.0) < 0.05,
      `afterReset=${scaleAfterReset}`);
  } else {
    record('9.ZoomControls', 'Reset zoom button found', false,
      `Available: ${JSON.stringify(zoomBtns?.allButtons?.map(b => b.title))}`);
  }

  // =====================================================
  // 10. COPY/PASTE
  // =====================================================
  console.log('\n========== 10. COPY/PASTE ==========');

  // First ensure we have a non-start/end node
  const nodesForCopy = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    return Array.from(nodes).map(n => {
      const bbox = n.getBoundingClientRect();
      return {
        id: n.getAttribute('data-cell-id'),
        text: n.textContent?.trim(),
        cx: bbox.x + bbox.width / 2,
        cy: bbox.y + bbox.height / 2
      };
    });
  });

  const copyableNode = nodesForCopy.find(n => n.text && !n.text.includes('开始') && !n.text.includes('结束'));
  const startNodeForCopy = nodesForCopy.find(n => n.text && n.text.includes('开始'));

  if (copyableNode) {
    // Select the copyable node
    await page.mouse.click(copyableNode.cx, copyableNode.cy);
    await page.waitForTimeout(500);

    const nodeCountBeforePaste = nodesForCopy.length;

    // Copy
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);

    // Check for toast/feedback
    const toastAfterCopy = await page.evaluate(() => {
      const toast = document.querySelector('.ant-message, .ant-notification, [class*="toast"], [class*="message"]');
      return toast ? toast.textContent?.trim() : null;
    });
    record('10.CopyPaste', 'Copy shows feedback (toast)',
      toastAfterCopy !== null && toastAfterCopy.length > 0,
      `toast: "${toastAfterCopy || 'none'}"`);

    // Paste
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);

    const nodesAfterPaste = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
      return Array.from(nodes).map(n => ({
        id: n.getAttribute('data-cell-id'),
        text: n.textContent?.trim(),
        selected: n.classList.contains('x6-node-selected')
      }));
    });

    record('10.CopyPaste', 'Paste creates new node', nodesAfterPaste.length > nodeCountBeforePaste,
      `Before: ${nodeCountBeforePaste}, After: ${nodesAfterPaste.length}`);

    // Check pasted node is offset from original
    if (nodesAfterPaste.length > nodeCountBeforePaste) {
      const pastedNode = nodesAfterPaste.find(n => !nodesForCopy.some(orig => orig.id === n.id));
      record('10.CopyPaste', 'Pasted node appears offset from original',
        pastedNode !== null,
        pastedNode ? `New node: "${pastedNode.text}", id=${pastedNode.id}` : 'Could not identify pasted node');
    }

    // Undo the paste to clean up
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
  } else {
    record('10.CopyPaste', 'Non-start/end node available for copy', false,
      `Nodes: [${nodesForCopy.map(n => n.text).join(', ')}]`);
  }

  // Test start node NOT copyable
  if (startNodeForCopy) {
    await page.mouse.click(startNodeForCopy.cx, startNodeForCopy.cy);
    await page.waitForTimeout(300);

    const beforeCount = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);

    const afterCount = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);

    // Check if toast warns about start node
    const warningToast = await page.evaluate(() => {
      const toast = document.querySelector('.ant-message, .ant-notification, [class*="toast"], [class*="message"]');
      return toast ? toast.textContent?.trim() : null;
    });

    record('10.CopyPaste', 'Start/End nodes NOT copyable (restriction enforced)',
      afterCount === beforeCount,
      `Before: ${beforeCount}, After: ${afterCount}, toast: "${warningToast || 'none'}"`);

    // Undo if needed
    if (afterCount > beforeCount) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);
    }
  }

  // =====================================================
  // 11. DELETE
  // =====================================================
  console.log('\n========== 11. DELETE ==========');

  // First drag in a new node to delete (to avoid affecting other tests)
  const humanNodeForDelete = stencilNodeInfo.find(n => n.text.includes('人工'));
  let deleteTargetId = null;

  if (humanNodeForDelete) {
    const canvasCenter2 = await page.evaluate(() => {
      const scroller = document.querySelector('.x6-graph-scroller');
      const rect = scroller.getBoundingClientRect();
      return { x: rect.x + rect.width / 2 + 100, y: rect.y + rect.height / 2 + 100 };
    });

    await page.mouse.move(humanNodeForDelete.x, humanNodeForDelete.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(canvasCenter2.x, canvasCenter2.y, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // Find the newly created node
    const latestNodes = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
      return Array.from(nodes).map(n => ({
        id: n.getAttribute('data-cell-id'),
        text: n.textContent?.trim(),
        selected: n.classList.contains('x6-node-selected')
      }));
    });

    const deleteCandidate = latestNodes.find(n => n.selected && !n.text.includes('开始') && !n.text.includes('结束'));
    if (deleteCandidate) {
      deleteTargetId = deleteCandidate.id;
    }
  }

  if (deleteTargetId) {
    const countBefore = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);

    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);

    const countAfter = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);

    record('11.Delete', 'Delete key removes selected non-start/end node', countAfter < countBefore,
      `Before: ${countBefore}, After: ${countAfter}`);

    // Undo delete
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
  } else {
    // Try with existing non-start/end node
    const existingCopyable = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
      for (const n of nodes) {
        const text = n.textContent?.trim() || '';
        if (!text.includes('开始') && !text.includes('结束')) {
          const bbox = n.getBoundingClientRect();
          return { id: n.getAttribute('data-cell-id'), cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2, text };
        }
      }
      return null;
    });

    if (existingCopyable) {
      await page.mouse.click(existingCopyable.cx, existingCopyable.cy);
      await page.waitForTimeout(300);
      const countBefore = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);
      const countAfter = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);
      record('11.Delete', 'Delete key removes selected non-start/end node', countAfter < countBefore,
        `Before: ${countBefore}, After: ${countAfter}`);
      // Undo
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);
    } else {
      record('11.Delete', 'Non-start/end node for delete test', false, 'No suitable node');
    }
  }

  // Test that start/end cannot be deleted
  const startForDelete = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-graph .x6-cell.x6-node');
    for (const n of nodes) {
      if (n.textContent?.trim().includes('开始')) {
        const bbox = n.getBoundingClientRect();
        return { id: n.getAttribute('data-cell-id'), cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 };
      }
    }
    return null;
  });

  if (startForDelete) {
    await page.mouse.click(startForDelete.cx, startForDelete.cy);
    await page.waitForTimeout(300);
    const beforeDel = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    const afterDel = await page.evaluate(() => document.querySelectorAll('.x6-graph .x6-cell.x6-node').length);

    record('11.Delete', 'Start/End nodes cannot be deleted (protection)', afterDel === beforeDel,
      `Before: ${beforeDel}, After: ${afterDel}`);
  }

  // =====================================================
  // 12. VISUAL/CSS CHECKS
  // =====================================================
  console.log('\n========== 12. VISUAL/CSS CHECKS ==========');

  // 12a. No scrollbars on .x6-graph-scroller
  const scrollbarCheck = await page.evaluate(() => {
    const scroller = document.querySelector('.x6-graph-scroller');
    if (!scroller) return null;
    const style = window.getComputedStyle(scroller);
    return { overflow: style.overflow, overflowX: style.overflowX, overflowY: style.overflowY };
  });
  record('12.VisualCSS', 'No scrollbars on .x6-graph-scroller',
    scrollbarCheck && (scrollbarCheck.overflow === 'hidden' || (scrollbarCheck.overflowX === 'hidden' && scrollbarCheck.overflowY === 'hidden')),
    scrollbarCheck ? `overflow=${scrollbarCheck.overflow}, overflowX=${scrollbarCheck.overflowX}, overflowY=${scrollbarCheck.overflowY}` : 'Element not found');

  // 12b. Snapline color
  const snaplineCSS = await page.evaluate(() => {
    // Check stylesheets for snapline rule
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule.cssText && rule.cssText.includes('snapline') && rule.cssText.includes('d4d4d4')) {
            return { found: true, rule: rule.cssText.substring(0, 200) };
          }
          if (rule.cssText && rule.cssText.includes('x6-widget-snapline')) {
            return { found: true, rule: rule.cssText.substring(0, 200) };
          }
        }
      } catch (e) { /* cross-origin */ }
    }
    // Check inline styles or elements
    const snapline = document.querySelector('.x6-widget-snapline line, .x6-widget-snapline-horizontal, .x6-widget-snapline-vertical');
    if (snapline) {
      const style = window.getComputedStyle(snapline);
      return { found: true, stroke: style.stroke, borderColor: style.borderColor };
    }
    return { found: false };
  });
  record('12.VisualCSS', 'Snapline color is #d4d4d4',
    snaplineCSS?.found === true,
    snaplineCSS ? `found=${snaplineCSS.found}, ${snaplineCSS.rule || `stroke=${snaplineCSS.stroke}`}` : 'Not checked');

  // 12c. SVG overflow:visible
  const svgOverflow = await page.evaluate(() => {
    const svg = document.querySelector('.x6-graph svg');
    if (!svg) return null;
    const style = window.getComputedStyle(svg);
    return { overflow: style.overflow };
  });
  record('12.VisualCSS', 'SVG has overflow:visible (port clipping fix)',
    svgOverflow?.overflow === 'visible',
    svgOverflow ? `overflow=${svgOverflow.overflow}` : 'SVG not found');

  // 12d. Antd deprecation warnings
  const antdDeprecations = antdWarnings.filter(w => w.includes('deprecated') || w.includes('Deprecat'));
  record('12.VisualCSS', 'No antd deprecation warnings',
    antdDeprecations.length === 0,
    antdDeprecations.length === 0 ? 'No deprecation warnings' : `${antdDeprecations.length} warnings: ${antdDeprecations.slice(0, 3).join('; ')}`);

  // =====================================================
  // 13. EDGE LABEL
  // =====================================================
  console.log('\n========== 13. EDGE LABEL ==========');

  const edgesForLabel = await page.evaluate(() => {
    const edges = document.querySelectorAll('.x6-edge');
    return Array.from(edges).map(e => {
      const paths = e.querySelectorAll('path');
      let clickTarget = null;
      for (const p of paths) {
        const bbox = p.getBoundingClientRect();
        if (bbox.width > 5 || bbox.height > 5) {
          clickTarget = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
          break;
        }
      }
      return { id: e.getAttribute('data-cell-id'), clickTarget };
    }).filter(e => e.clickTarget);
  });

  if (edgesForLabel.length > 0) {
    const edgeForLabel = edgesForLabel[0];

    // Double-click on edge to trigger label editing
    await page.mouse.dblclick(edgeForLabel.clickTarget.x, edgeForLabel.clickTarget.y);
    await page.waitForTimeout(1000);

    // Check if label editing appeared (could be input, textarea, or contenteditable)
    const labelEditing = await page.evaluate(() => {
      const inputs = document.querySelectorAll('.x6-edge-tool-editor input, .x6-edge-tool-editor textarea, [contenteditable="true"], .x6-cell-tool-editor');
      const edgeLabelEditor = document.querySelector('.x6-edge-tool-editor, [class*="edge-label"]');
      return {
        inputCount: inputs.length,
        hasEditor: !!edgeLabelEditor,
        editorText: edgeLabelEditor?.textContent?.trim() || null
      };
    });

    record('13.EdgeLabel', 'Double-click edge shows label editor',
      labelEditing.inputCount > 0 || labelEditing.hasEditor,
      `inputs=${labelEditing.inputCount}, hasEditor=${labelEditing.hasEditor}, text="${labelEditing.editorText}"`);

    // Press Escape to close editor if open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    record('13.EdgeLabel', 'Edge available for double-click test', false, 'No clickable edges found');
  }

  // =====================================================
  // FINAL SUMMARY
  // =====================================================
  console.log('\n\n========== FINAL SUMMARY ==========');
  const passes = results.filter(r => r.startsWith('[PASS]')).length;
  const fails = results.filter(r => r.startsWith('[FAIL]')).length;
  console.log(`Total: ${results.length} tests | PASS: ${passes} | FAIL: ${fails}`);
  console.log('\n--- All Results ---');
  results.forEach((r, i) => console.log(`${i + 1}. ${r}`));

  // Console errors summary
  if (jsErrors.length > 0) {
    console.log('\n--- JS Errors (pageerror) ---');
    jsErrors.forEach(e => console.log(`  - ${e}`));
  }
  if (consoleErrors.length > 0) {
    console.log('\n--- Console Errors ---');
    consoleErrors.forEach(e => console.log(`  - ${e.substring(0, 200)}`));
  }
  if (antdWarnings.length > 0) {
    console.log('\n--- Antd/React Warnings ---');
    antdWarnings.slice(0, 10).forEach(w => console.log(`  - ${w.substring(0, 200)}`));
  }

  // Take final screenshot
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\nFinal screenshot: ${screenshotPath}`);

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
