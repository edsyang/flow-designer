import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Graph } from '@antv/x6';
import type { Scroller } from '@antv/x6-plugin-scroller';
import { DragEdgePanController } from '../src/viewport-input';

function setup() {
  const owner = document.createElement('div'); owner.dataset.fdArea = 'workbench';
  const container = document.createElement('div'); owner.appendChild(container); document.body.appendChild(owner);
  let left = 100; let top = 100;
  Object.defineProperties(container, {
    scrollLeft: { configurable: true, get: () => left, set: (value: number) => { left = Math.max(0, Math.min(100, value)); } },
    scrollTop: { configurable: true, get: () => top, set: (value: number) => { top = Math.max(0, Math.min(100, value)); } },
  });
  container.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  let origin = { x: 0, y: 0 };
  const graph = { container, clientToLocal: (x: number, y: number) => ({ x: x + left + origin.x, y: y + top + origin.y }), transform: { getScale: () => ({ sx: 1, sy: 1 }) } } as unknown as Graph;
  const centerPoint = vi.fn((x: number, y: number) => { origin = { x: x - 400 - left, y: y - 300 - top }; });
  const scroller = { container, centerPoint } as unknown as Scroller;
  const pan = new DragEdgePanController(graph, scroller);
  return { pan, container, owner, centerPoint };
}

describe('edge drag panning', () => {
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it('requires a stable 500ms panel dwell and continues panning without mousemove', () => {
    vi.useFakeTimers();
    const { pan, centerPoint } = setup();
    pan.update({ x: 795, y: 300 }, 'panel');
    vi.advanceTimersByTime(499);
    expect(centerPoint).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(centerPoint).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(48);
    expect(centerPoint.mock.calls.length).toBeGreaterThan(1);
    document.dispatchEvent(new MouseEvent('mouseup'));
    const calls = centerPoint.mock.calls.length;
    vi.advanceTimersByTime(100);
    expect(centerPoint).toHaveBeenCalledTimes(calls);
    pan.dispose();
  });

  it('restarts dwell when sliding along the edge and cancels it when leaving', () => {
    vi.useFakeTimers();
    const { pan, centerPoint } = setup();
    pan.update({ x: 795, y: 100 }, 'panel'); vi.advanceTimersByTime(400);
    pan.update({ x: 795, y: 200 }, 'panel'); vi.advanceTimersByTime(400);
    expect(centerPoint).not.toHaveBeenCalled();
    pan.update({ x: 400, y: 300 }, 'panel'); vi.advanceTimersByTime(1000);
    expect(centerPoint).not.toHaveBeenCalled();
    pan.dispose();
  });

  it('pans existing canvas nodes immediately and releases resources on disposal', () => {
    vi.useFakeTimers();
    const { pan, centerPoint } = setup();
    const afterPan = vi.fn();
    pan.update({ x: 795, y: 300 }, 'canvas', afterPan);
    expect(centerPoint).toHaveBeenCalledTimes(1);
    expect(afterPan).toHaveBeenCalledWith({ x: 12, y: 0 });
    pan.dispose(); vi.advanceTimersByTime(1000);
    expect(centerPoint).toHaveBeenCalledTimes(1);
  });

  it('does not pan over panels or while the panel drag remains outside the canvas', () => {
    vi.useFakeTimers();
    const { pan, owner, centerPoint } = setup();
    const inspector = document.createElement('div'); inspector.dataset.fdArea = 'inspector';
    inspector.getBoundingClientRect = () => new DOMRect(700, 0, 100, 600); owner.appendChild(inspector);
    pan.update({ x: 795, y: 300 }, 'panel'); vi.advanceTimersByTime(1000);
    pan.update({ x: -5, y: 300 }, 'panel'); vi.advanceTimersByTime(1000);
    expect(centerPoint).not.toHaveBeenCalled();
    pan.update({ x: 695, y: 300 }, 'panel'); vi.advanceTimersByTime(500);
    expect(centerPoint).not.toHaveBeenCalled();
    inspector.remove();
    pan.update({ x: 795, y: 300 }, 'panel'); vi.advanceTimersByTime(500);
    expect(centerPoint).toHaveBeenCalledTimes(1);
    pan.dispose();
  });

  it('avoids overlay DOM scans for movement away from every viewport edge', () => {
    const { pan, owner, centerPoint } = setup();
    const query = vi.spyOn(owner, 'querySelectorAll');
    pan.update({ x: 400, y: 300 }, 'canvas');
    expect(query).not.toHaveBeenCalled();
    expect(centerPoint).not.toHaveBeenCalled();
    pan.dispose();
  });

  it('stops a stationary drag when a modal or quick-add overlay appears and on resize', () => {
    vi.useFakeTimers();
    const { pan, owner, centerPoint } = setup();
    pan.update({ x: 795, y: 300 }, 'canvas');
    expect(centerPoint).toHaveBeenCalledTimes(1);
    const modal = document.createElement('div'); modal.className = 'ant-modal-mask';
    modal.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600); owner.appendChild(modal);
    vi.advanceTimersByTime(80);
    expect(centerPoint).toHaveBeenCalledTimes(1);
    modal.remove();
    const quick = document.createElement('div'); quick.dataset.fdArea = 'canvasQuickAdd';
    quick.getBoundingClientRect = () => new DOMRect(700, 200, 100, 200); owner.appendChild(quick);
    pan.update({ x: 795, y: 300 }, 'canvas'); vi.advanceTimersByTime(80);
    expect(centerPoint).toHaveBeenCalledTimes(1);
    quick.remove(); pan.update({ x: 795, y: 300 }, 'canvas');
    expect(centerPoint).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(80);
    expect(centerPoint).toHaveBeenCalledTimes(2);
    pan.dispose();
  });
});
