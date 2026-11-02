import { describe, it, expect, beforeEach } from 'vitest';
import Document from '../src/document';
import GenericContent from '../src/content/generic';
import type { ContentData } from '../src/content';

const contentTypesRegistry = await import('../src/registries').then(m => m.contentTypesRegistry);
const prototypeRegistry = await import('../src/registries').then(m => m.prototypeRegistry);

function setup() {
  if (!contentTypesRegistry.getSuitableContentType('*')) {
    contentTypesRegistry.register(GenericContent as any);
  }
  if (!prototypeRegistry.getPrototypeByType('Unknown')) {
    prototypeRegistry.register({
      name: 'Unknown',
      typeName: 'Unknown',
      view: { type: 'node', pulled: false, shape: () => null },
    } as any);
  }
  if (!prototypeRegistry.getPrototypeByType('task')) {
    prototypeRegistry.register({
      name: 'Task',
      typeName: 'task',
      view: { type: 'node', pulled: false, shape: () => null },
      props: [{ name: 'label', defaultValue: '' }],
    } as any);
  }
}

describe('GenericContent', () => {
  beforeEach(() => {
    setup();
  });

  it('nodesFromData parses serialized nodes', () => {
    const doc = new Document({
      id: 'doc-gc',
      documentType: '*',
      documentVersion: '1.0.0',
      nodes: [
        { id: 'n1', typeName: 'task', props: { label: 'A' }, position: { x: 0, y: 0 } },
        { id: 'n2', typeName: 'task', props: { label: 'B' }, position: { x: 100, y: 0 } },
      ],
    });
    const content = doc.getContent() as GenericContent;
    expect(content.getNodes()).toHaveLength(2);
    expect(content.getNode('n1')).not.toBeNull();
    expect(content.getNode('n2')).not.toBeNull();
  });

  it('getData serializes nodes and edges as top-level elements', () => {
    const doc = new Document({
      id: 'doc-gc2',
      documentType: '*',
      documentVersion: '1.0.0',
      nodes: [
        { id: 'n1', typeName: 'task', props: { label: 'Hello' }, position: { x: 10, y: 20 } },
      ],
    });
    const content = doc.getContent() as GenericContent;
    const data = content.getData() as any;
    expect(data.elements).toHaveLength(1);
    expect(data.elements[0].id).toBe('n1');
    expect(data.elements[0].typeName).toBe('task');
    expect(data.elements[0]).not.toHaveProperty('relations');
  });

  it('createRelation populates edges from top-level edge elements', () => {
    const doc = new Document({
      id: 'doc-gc3',
      documentType: '*',
      documentVersion: '1.0.0',
      elements: [
        { id: 'n1', typeName: 'task', props: {}, position: { x: 0, y: 0 } },
        { id: 'n2', typeName: 'task', props: {}, position: { x: 100, y: 0 } },
        { id: 'e1', typeName: 'Edge', sourceRef: 'n1', targetRef: 'n2' },
      ],
    });
    const content = doc.getContent() as GenericContent;
    const n1 = content.getNode('n1')!;
    const edges = n1.getRelation().serialize();
    expect(edges).toHaveLength(1);
    expect(edges[0].targetNodeId).toBe('n2');
  });

  it('getData outputs edges as independent elements', async () => {
    const doc = new Document({
      id: 'doc-gc4',
      documentType: '*',
      documentVersion: '1.0.0',
      elements: [
        { id: 'n1', typeName: 'task', props: {}, position: { x: 0, y: 0 } },
        { id: 'n2', typeName: 'task', props: {}, position: { x: 100, y: 0 } },
      ],
    });
    const content = doc.getContent() as GenericContent;
    const n1 = content.getNode('n1')!;
    n1.getRelation().addEdge({ id: 'e1', targetNodeId: 'n2', sourcePort: 'right', targetPort: 'left' });

    const data = content.getData() as any;
    expect(data.elements).toHaveLength(3);

    const nodeEls = data.elements.filter((el: any) => !el.sourceRef);
    const edgeEls = data.elements.filter((el: any) => el.sourceRef);
    expect(nodeEls).toHaveLength(2);
    expect(edgeEls).toHaveLength(1);
    expect(edgeEls[0]).toMatchObject({
      id: 'e1',
      sourceRef: 'n1',
      targetRef: 'n2',
      sourcePort: 'right',
      targetPort: 'left',
    });
  });

  it('round-trips getData/nodesFromData', async () => {
    const doc1 = new Document({
      id: 'doc-rt',
      documentType: '*',
      documentVersion: '1.0.0',
      elements: [
        { id: 'n1', typeName: 'task', props: { label: 'A' }, position: { x: 0, y: 0 } },
        { id: 'n2', typeName: 'task', props: { label: 'B' }, position: { x: 100, y: 0 } },
        { id: 'e1', typeName: 'Edge', sourceRef: 'n1', targetRef: 'n2' },
      ],
    });
    const data = (doc1.getContent() as GenericContent).getData();

    const doc2 = new Document({
      id: 'doc-rt2',
      documentType: '*',
      documentVersion: '1.0.0',
      ...data,
    });
    const content2 = doc2.getContent() as GenericContent;
    expect(content2.getNodes()).toHaveLength(2);
    const n1 = content2.getNode('n1')!;
    expect(n1.getRelation().serialize()).toHaveLength(1);
    expect(n1.getRelation().serialize()[0].targetNodeId).toBe('n2');
  });

  it('node getPosition/setPosition works', () => {
    const doc = new Document({
      id: 'doc-pos',
      documentType: '*',
      documentVersion: '1.0.0',
      nodes: [
        { id: 'n1', typeName: 'task', props: {}, position: { x: 0, y: 0 } },
      ],
    });
    const node = doc.getContent().getNode('n1')!;
    expect(node.getPosition()).toEqual({ x: 0, y: 0 });
    node.setPosition(50, 75);
    expect(node.getPosition()).toEqual({ x: 50, y: 75 });
  });

  it('addNode creates a new node', async () => {
    const doc = new Document({
      id: 'doc-add',
      documentType: '*',
      documentVersion: '1.0.0',
      nodes: [],
    });
    const content = doc.getContent();
    const newNode = await content.addNode({ type: 'task', props: { label: 'New' } });
    expect(newNode).not.toBeNull();
    expect(content.getNodes()).toHaveLength(1);
  });
});
