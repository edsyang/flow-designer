import { chromium } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = 'http://127.0.0.1:5179';
const screenshotPath = join(tmpdir(), 'e2e-verify.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL);
  await page.waitForSelector('.x6-graph', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // --- Test 1: Check if nodes have ports ---
  console.log('\n=== Test 1: Nodes have ports ===');
  const portCount = await page.evaluate(() => {
    const ports = document.querySelectorAll('.x6-port-body');
    return ports.length;
  });
  console.log(`Port elements found: ${portCount}`);
  if (portCount === 0) {
    console.log('FAIL: No ports found on any nodes!');
  } else {
    console.log('PASS: Ports exist on nodes');
  }

  // --- Test 2: Check edge connections (source/target should have port) ---
  console.log('\n=== Test 2: Edge connections use ports ===');
  const edgeInfo = await page.evaluate(() => {
    // Access the X6 graph instance
    const graphEl = document.querySelector('.x6-graph');
    if (!graphEl) return { error: 'no graph element' };

    // Try to find edges via SVG
    const edges = document.querySelectorAll('.x6-cell.x6-edge');
    const results = [];

    // Get the graph from window if exposed
    // Check for edge path data
    const paths = document.querySelectorAll('.x6-edge path[d]');
    for (const path of paths) {
      const d = path.getAttribute('d') || '';
      results.push(d.substring(0, 80));
    }
    return { edgeCount: edges.length, pathCount: paths.length, samplePaths: results.slice(0, 3) };
  });
  console.log(`Edges found: ${edgeInfo.edgeCount}, Paths: ${edgeInfo.pathCount}`);
  if (edgeInfo.samplePaths) {
    edgeInfo.samplePaths.forEach((p, i) => console.log(`  Path ${i}: ${p}...`));
  }

  // --- Test 3: Try copy-paste ---
  console.log('\n=== Test 3: Copy-paste behavior ===');

  // Click on a node to select it (find a non-start/end node)
  const nodeElements = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.x6-cell.x6-node');
    return Array.from(nodes).map(n => ({
      id: n.getAttribute('data-cell-id'),
      bbox: n.getBoundingClientRect(),
      text: n.textContent?.trim()
    }));
  });
  console.log(`Nodes on canvas: ${nodeElements.length}`);
  nodeElements.forEach(n => console.log(`  Node: "${n.text}" at (${Math.round(n.bbox.x)}, ${Math.round(n.bbox.y)})`));

  // Find a copyable node (not start/end)
  const copyableNode = nodeElements.find(n =>
    n.text && !n.text.includes('开始') && !n.text.includes('结束')
  );

  if (copyableNode) {
    console.log(`\nSelecting node: "${copyableNode.text}"`);
    const cx = copyableNode.bbox.x + copyableNode.bbox.width / 2;
    const cy = copyableNode.bbox.y + copyableNode.bbox.height / 2;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(500);

    // Check selection state
    const selectedBefore = await page.evaluate(() => {
      const selected = document.querySelectorAll('.x6-cell.x6-node-selected, .x6-node-selected');
      return selected.length;
    });
    console.log(`Selected nodes before copy: ${selectedBefore}`);

    // Copy
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // Paste
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);

    // Check how many nodes now and selection state
    const afterPaste = await page.evaluate(() => {
      const allNodes = document.querySelectorAll('.x6-cell.x6-node');
      const selected = document.querySelectorAll('.x6-node-selected');
      return { totalNodes: allNodes.length, selectedNodes: selected.length };
    });
    console.log(`After paste: total nodes=${afterPaste.totalNodes}, selected=${afterPaste.selectedNodes}`);
    if (afterPaste.totalNodes > nodeElements.length) {
      console.log('PASS: New node was created');
    } else {
      console.log('FAIL: No new node created after paste');
    }
    if (afterPaste.selectedNodes <= 1) {
      console.log('PASS: Only pasted node is selected');
    } else {
      console.log('FAIL: Multiple nodes selected after paste');
    }
  } else {
    console.log('No copyable node found, skipping paste test');
  }

  // --- Test 4: Check edge endpoints vs port positions ---
  console.log('\n=== Test 4: Edge endpoint positions ===');
  const edgeEndpoints = await page.evaluate(() => {
    const results = [];
    const nodes = document.querySelectorAll('.x6-cell.x6-node');
    const nodeBoxes = [];
    for (const node of nodes) {
      const id = node.getAttribute('data-cell-id');
      const bbox = node.getBoundingClientRect();
      nodeBoxes.push({ id, x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height,
        cx: bbox.x + bbox.width/2, cy: bbox.y + bbox.height/2 });
    }

    // Check edge paths - if they start/end at node center, that's wrong
    const edges = document.querySelectorAll('.x6-edge path.x6-edge-line');
    for (const edge of edges) {
      const d = edge.getAttribute('d');
      if (!d) continue;
      // Parse first M and last point
      const mMatch = d.match(/M\s*([\d.]+)\s+([\d.]+)/);
      const points = d.match(/[\d.]+\s+[\d.]+/g);
      if (!mMatch || !points) continue;
      const startX = parseFloat(mMatch[1]);
      const startY = parseFloat(mMatch[2]);
      const lastPt = points[points.length - 1].split(/\s+/);
      const endX = parseFloat(lastPt[0]);
      const endY = parseFloat(lastPt[1]);

      // Check if start/end is at any node center
      let startsAtCenter = false;
      let endsAtCenter = false;
      for (const nb of nodeBoxes) {
        if (Math.abs(startX - nb.cx) < 5 && Math.abs(startY - nb.cy) < 5) startsAtCenter = true;
        if (Math.abs(endX - nb.cx) < 5 && Math.abs(endY - nb.cy) < 5) endsAtCenter = true;
      }
      results.push({ start: {x: startX, y: startY}, end: {x: endX, y: endY}, startsAtCenter, endsAtCenter });
    }
    return { nodeBoxes, edges: results };
  });

  if (edgeEndpoints.edges.length > 0) {
    for (const e of edgeEndpoints.edges) {
      const status = (e.startsAtCenter || e.endsAtCenter) ? 'FAIL (center)' : 'OK (port)';
      console.log(`  Edge: start=(${Math.round(e.start.x)},${Math.round(e.start.y)}) end=(${Math.round(e.end.x)},${Math.round(e.end.y)}) ${status}`);
    }
  } else {
    console.log('  No edges with line paths found');
  }

  // Screenshot for reference
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\nScreenshot saved to ${screenshotPath}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
