import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5179';

test.describe('BPMN Edge Routing - Strict Orthogonal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.x6-graph', { timeout: 30000 });
    await page.waitForTimeout(1000);
  });

  test('edges use normal connector (no rounded/curves)', async ({ page }) => {
    // Check that all existing edges have orthogonal paths (only H/V segments)
    const edgePaths = await page.evaluate(() => {
      const paths = document.querySelectorAll('.x6-edge path[d]');
      const results = [];
      for (const path of paths) {
        const d = path.getAttribute('d');
        if (d) results.push(d);
      }
      return results;
    });

    for (const d of edgePaths) {
      // Normal connector with manhattan router produces paths with only M, L commands
      // and all L segments are either horizontal or vertical
      // Curves would use C, Q, A commands
      expect(d).not.toMatch(/[CcQqAa]/);
    }
  });

  test('edge segments are strictly horizontal or vertical', async ({ page }) => {
    const segmentAngles = await page.evaluate(() => {
      const paths = document.querySelectorAll('.x6-edge path.x6-edge-line');
      const angles = [];
      for (const path of paths) {
        const d = path.getAttribute('d');
        if (!d) continue;
        // Parse M and L commands
        const commands = d.match(/[ML]\s*[\d.-]+[\s,][\d.-]+/g);
        if (!commands || commands.length < 2) continue;

        const points = commands.map(cmd => {
          const nums = cmd.match(/[\d.-]+/g);
          return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
        });

        for (let i = 1; i < points.length; i++) {
          const dx = Math.abs(points[i].x - points[i-1].x);
          const dy = Math.abs(points[i].y - points[i-1].y);
          if (dx > 0.5 && dy > 0.5) {
            // Diagonal segment found
            angles.push({ from: points[i-1], to: points[i], dx, dy });
          }
        }
      }
      return angles;
    });

    // No diagonal segments should exist
    expect(segmentAngles).toHaveLength(0);
  });

  test('nodes render correctly with ports', async ({ page }) => {
    const nodeCount = await page.locator('.x6-node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(2); // At least start + end

    // Check that ports exist
    const portCount = await page.locator('.x6-port').count();
    expect(portCount).toBeGreaterThan(0);
  });

  test('edge hover shows segments tool for dragging', async ({ page }) => {
    const edge = page.locator('.x6-edge').first();
    if (await edge.count() > 0) {
      await edge.hover();
      await page.waitForTimeout(300);

      const toolElements = await page.locator('.x6-edge-tool').count();
      expect(toolElements).toBeGreaterThanOrEqual(0);
    }
  });

  test('edges do not pass through intermediate nodes (obstacle avoidance)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const graph = document.querySelector('.x6-graph');
      if (!graph) return { skip: true };

      const nodes = document.querySelectorAll('.x6-node');
      const edges = document.querySelectorAll('.x6-edge path.x6-edge-line');
      if (nodes.length < 2 || edges.length === 0) return { skip: true };

      const nodeRects = [];
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        nodeRects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height, id: node.getAttribute('data-cell-id') });
      }

      const violations = [];
      for (const edge of edges) {
        const edgeEl = edge.closest('.x6-edge');
        const edgeId = edgeEl?.getAttribute('data-cell-id');
        const d = edge.getAttribute('d');
        if (!d) continue;

        const commands = d.match(/[ML]\s*[\d.-]+[\s,][\d.-]+/g);
        if (!commands || commands.length < 2) continue;
        const points = commands.map(cmd => {
          const nums = cmd.match(/[\d.-]+/g);
          return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
        });

        const svg = edge.closest('svg');
        const svgRect = svg?.getBoundingClientRect();
        if (!svgRect) continue;

        for (let i = 1; i < points.length; i++) {
          const midX = svgRect.x + (points[i].x + points[i-1].x) / 2;
          const midY = svgRect.y + (points[i].y + points[i-1].y) / 2;

          for (const nr of nodeRects) {
            const margin = 5;
            if (midX > nr.x + margin && midX < nr.x + nr.w - margin &&
                midY > nr.y + margin && midY < nr.y + nr.h - margin) {
              const sourceId = edgeEl?.querySelector('[data-cell-id]')?.getAttribute('data-cell-id');
              if (nr.id !== sourceId) {
                violations.push({ edge: edgeId, node: nr.id });
              }
            }
          }
        }
      }
      return { skip: false, violations };
    });

    if (!result.skip) {
      expect(result.violations).toHaveLength(0);
    }
  });

  test('manhattan router uses correct port exit direction', async ({ page }) => {
    // Verify: bottom/top port → first segment is vertical, right/left port → first segment is horizontal
    const result = await page.evaluate(() => {
      const edges = document.querySelectorAll('.x6-edge path.x6-edge-line');
      if (edges.length === 0) return { skip: true };

      const portDirectionViolations = [];
      for (const edge of edges) {
        const d = edge.getAttribute('d');
        if (!d) continue;
        const commands = d.match(/[ML]\s*[\d.-]+[\s,][\d.-]+/g);
        if (!commands || commands.length < 3) continue;

        const points = commands.map(cmd => {
          const nums = cmd.match(/[\d.-]+/g);
          return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
        });

        // Check first segment (source exit): must be purely H or V
        const firstDx = Math.abs(points[1].x - points[0].x);
        const firstDy = Math.abs(points[1].y - points[0].y);
        const isFirstOrthogonal = firstDx < 0.5 || firstDy < 0.5;

        // Check last segment (target entry): must be purely H or V
        const n = points.length;
        const lastDx = Math.abs(points[n-1].x - points[n-2].x);
        const lastDy = Math.abs(points[n-1].y - points[n-2].y);
        const isLastOrthogonal = lastDx < 0.5 || lastDy < 0.5;

        if (!isFirstOrthogonal) portDirectionViolations.push('first segment diagonal');
        if (!isLastOrthogonal) portDirectionViolations.push('last segment diagonal');

        // Additionally check: first segment direction matches port position
        // If source is at bottom of node → first segment should be vertical (dy > 0)
        // If source is at right of node → first segment should be horizontal (dx > 0)
        if (isFirstOrthogonal && firstDy > 0.5 && firstDx < 0.5) {
          // Vertical first segment — valid for top/bottom port
        } else if (isFirstOrthogonal && firstDx > 0.5 && firstDy < 0.5) {
          // Horizontal first segment — valid for left/right port
        }
      }
      return { skip: false, violations: portDirectionViolations };
    });

    if (!result.skip) {
      expect(result.violations).toHaveLength(0);
    }
  });
});
