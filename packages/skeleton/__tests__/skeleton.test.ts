import { describe, it, expect } from 'vitest';
import { Skeleton } from '../src/skeleton';

describe('Skeleton', () => {
  it('has 5 area instances', () => {
    const skeleton = new Skeleton();
    expect(skeleton.header).toBeDefined();
    expect(skeleton.canvasToolbar).toBeDefined();
    expect(skeleton.sidebar).toBeDefined();
    expect(skeleton.inspector).toBeDefined();
    expect(skeleton.canvas).toBeDefined();
  });

  it('add() dispatches to header', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'a', area: 'header', content: 'test' });
    expect(skeleton.header.getItems()).toHaveLength(1);
    expect(skeleton.canvasToolbar.getItems()).toHaveLength(0);
  });

  it('add() dispatches to canvasToolbar', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'a', area: 'canvasToolbar', content: 'test' });
    expect(skeleton.canvasToolbar.getItems()).toHaveLength(1);
  });

  it('add() dispatches to sidebar', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'a', area: 'sidebar', content: 'test' });
    expect(skeleton.sidebar.getItems()).toHaveLength(1);
  });

  it('add() dispatches to inspector', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'a', area: 'inspector', content: 'test' });
    expect(skeleton.inspector.getItems()).toHaveLength(1);
  });

  it('add() dispatches to canvas', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'a', area: 'canvas', content: 'test' });
    expect(skeleton.canvas.getItems()).toHaveLength(1);
  });

  it('remove() removes from all areas', () => {
    const skeleton = new Skeleton();
    skeleton.add({ key: 'x', area: 'header', content: 'test' });
    skeleton.add({ key: 'x', area: 'canvasToolbar', content: 'test' });
    skeleton.remove('x');
    expect(skeleton.header.getItems()).toHaveLength(0);
    expect(skeleton.canvasToolbar.getItems()).toHaveLength(0);
  });
});
