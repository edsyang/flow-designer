import { describe, it, expect, vi } from 'vitest';
import Relation from '../src/content/relation';
import { GenericRelation } from '../src/content/relation';
import type { SerializedRelation } from '../src/types';

function mockContentAndNode() {
  const content = { getDocument: () => ({ sendSignal: vi.fn(), timelineLog: vi.fn() }) } as any;
  const node = { getId: () => 'node-1' } as any;
  return { content, node };
}

describe('Relation', () => {
  it('serialize returns empty array by default', () => {
    const { content, node } = mockContentAndNode();
    const rel = new Relation(content, node);
    expect(rel.serialize()).toEqual([]);
  });

  it('getContent and getNode return constructor args', () => {
    const { content, node } = mockContentAndNode();
    const rel = new Relation(content, node);
    expect(rel.getContent()).toBe(content);
    expect(rel.getNode()).toBe(node);
  });

  it('onChange subscribes and unsubscribes', () => {
    const { content, node } = mockContentAndNode();
    const rel = new Relation(content, node);
    const fn = vi.fn();
    const unsub = rel.onChange(fn);
    (rel as any).emitChange();
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    (rel as any).emitChange();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('GenericRelation', () => {
  it('isolates input and output snapshots and logs endpoint updates', () => {
    const { content, node } = mockContentAndNode();
    const edge = { id: 'e1', targetNodeId: 'n2', props: { label: 'old' } };
    const rel = new GenericRelation(content, node, [edge]);
    const before = rel.serialize();
    edge.props.label = 'mutated';
    rel.updateEdge('e1', { targetNodeId: 'n3', props: { label: 'new' } });
    expect(before[0]).toEqual({ id: 'e1', targetNodeId: 'n2', props: { label: 'old' } });
    const result = rel.getEdges(); result[0].targetNodeId = 'bad';
    expect(rel.getEdgeById('e1')?.targetNodeId).toBe('n3');
  });
  it('initializes with edges', () => {
    const { content, node } = mockContentAndNode();
    const edges: SerializedRelation[] = [
      { id: 'e1', targetNodeId: 'node-2' },
    ];
    const rel = new GenericRelation(content, node, edges);
    expect(rel.getEdges()).toHaveLength(1);
    expect(rel.serialize()).toEqual(edges);
  });

  it('addEdge appends and emits change', () => {
    const { content, node } = mockContentAndNode();
    const rel = new GenericRelation(content, node);
    const fn = vi.fn();
    rel.onChange(fn);
    rel.addEdge({ id: 'e1', targetNodeId: 'node-2' });
    expect(rel.getEdges()).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('removeEdge filters by targetNodeId and emits change', () => {
    const { content, node } = mockContentAndNode();
    const rel = new GenericRelation(content, node, [
      { id: 'e1', targetNodeId: 'node-2' },
      { id: 'e2', targetNodeId: 'node-3' },
    ]);
    const fn = vi.fn();
    rel.onChange(fn);
    rel.removeEdge('node-2');
    expect(rel.getEdges()).toHaveLength(1);
    expect(rel.getEdges()[0].targetNodeId).toBe('node-3');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serialize returns current edges', () => {
    const { content, node } = mockContentAndNode();
    const rel = new GenericRelation(content, node);
    rel.addEdge({ id: 'e1', targetNodeId: 'n2' });
    rel.addEdge({ id: 'e2', targetNodeId: 'n3' });
    const serialized = rel.serialize();
    expect(serialized).toHaveLength(2);
    expect(serialized[0].id).toBe('e1');
    expect(serialized[1].id).toBe('e2');
  });

  it('defaults to empty edges', () => {
    const { content, node } = mockContentAndNode();
    const rel = new GenericRelation(content, node);
    expect(rel.getEdges()).toEqual([]);
    expect(rel.serialize()).toEqual([]);
  });
});
