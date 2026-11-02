import { describe, it, expect } from 'vitest';
import { defineNode } from '../src/prototype';
import Prototype from '../src/prototype';
import type { NodeDefinition, PrototypeConfig } from '../src/prototype';

describe('defineNode', () => {
  it('returns a valid NodeDefinition', () => {
    const def = defineNode({
      meta: { name: 'Task', typeName: 'task', description: 'A task' },
      view: { type: 'node', draggable: true },
      schema: [
        { name: 'label', type: 'string', defaultValue: '' },
        { name: 'count', type: 'number', defaultValue: 0 },
      ],
      editor: [
        { target: 'label', setter: 'StringSetter' },
      ],
    });
    expect(def.meta.name).toBe('Task');
    expect(def.meta.typeName).toBe('task');
    expect(def.view.type).toBe('node');
    expect(def.schema).toHaveLength(2);
    expect(def.editor).toHaveLength(1);
  });
});

describe('Prototype with NodeDefinition', () => {
  it('constructs from NodeDefinition', () => {
    const def: NodeDefinition = {
      meta: { name: 'Gateway', typeName: 'gateway', description: 'An exclusive gateway', category: 'control' },
      view: { type: 'node', draggable: true, ports: [{ group: 'in', position: 'left' }] },
      schema: [{ name: 'condition', type: 'string' }],
      editor: [{ target: 'condition', setter: 'ExpressionSetter' }],
    };
    const proto = new Prototype(def);
    expect(proto.getName()).toBe('Gateway');
    expect(proto.getTypeName()).toBe('gateway');
    expect(proto.getCategory()).toBe('control');
    expect(proto.getSchema()).toHaveLength(1);
    expect(proto.getEditor()).toHaveLength(1);
    expect(proto.getView().type).toBe('node');
    expect(proto.getView().draggable).toBe(true);
    expect(proto.getDefinition()).toBe(def);
  });

  it('lifecycle callbacks are invoked', () => {
    let initCalled = false;
    const def: NodeDefinition = {
      meta: { name: 'LC', typeName: 'lc' },
      view: { type: 'node' },
      schema: [],
      editor: [],
      lifecycle: {
        nodeDidInit: () => { initCalled = true; },
      },
    };
    const proto = new Prototype(def);
    proto.nodeDidInit(null as any, false);
    expect(initCalled).toBe(true);
  });
});

describe('Prototype with legacy PrototypeConfig', () => {
  it('constructs from legacy config', () => {
    const config: PrototypeConfig = {
      name: 'Approve',
      typeName: 'approve',
      description: 'Approval node',
      icon: 'check',
      view: { type: 'node', pulled: true, shape: () => null },
      props: [{ name: 'assignee', defaultValue: '' }],
      settings: [],
    };
    const proto = new Prototype(config);
    expect(proto.getName()).toBe('Approve');
    expect(proto.getTypeName()).toBe('approve');
    expect(proto.getView().type).toBe('node');
    expect(proto.getView().draggable).toBe(true);
    expect(proto.getDefinition()).toBeNull();
    expect(proto.getIcon()).toBe('check');
  });

  it('legacy line type converts to edge', () => {
    const config: PrototypeConfig = {
      name: 'Connection',
      view: { type: 'line', pulled: false, shape: () => null },
    };
    const proto = new Prototype(config);
    expect(proto.getView().type).toBe('edge');
  });

  it('auto-generates typeName from name', () => {
    const config: PrototypeConfig = {
      name: 'my test node',
      view: { type: 'node', pulled: false, shape: () => null },
    };
    const proto = new Prototype(config);
    expect(proto.getTypeName()).toBe('myTestNode');
  });
});
