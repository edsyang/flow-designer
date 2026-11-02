import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES } from './constants';

export const messageEventDef = defineNode({
  meta: {
    name: '消息事件',
    typeName: 'MessageEvent',
    category: BPMN_CATEGORIES.EVENTS,
    icon: '✉',
  },
  view: {
    type: 'node',
    shape: 'fd-rect-event',
    defaultSize: { width: 100, height: 32 },
    ports: [
      { group: 'in', position: 'top' },
      { group: 'in', position: 'left' },
      { group: 'out', position: 'bottom' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '消息事件' },
    { name: 'messageRef', type: 'string', defaultValue: '' },
    { name: 'messageName', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    { target: 'messageRef', description: '消息引用', setter: BuiltinSetters.String },
    { target: 'messageName', description: '消息名称', setter: BuiltinSetters.String },
  ],
});
