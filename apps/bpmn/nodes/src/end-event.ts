import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const endEventDef = defineNode({
  meta: {
    name: '结束',
    typeName: BPMN_TYPE_NAMES.END_EVENT,
    category: BPMN_CATEGORIES.EVENTS,
    icon: '⏹',
  },
  view: {
    type: 'node',
    quickAdd: false,
    draggable: false,
    deletable: false,
    copyable: false,
    shape: 'fd-circle-end',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { group: 'in', position: 'top' },
      { group: 'in', position: 'right' },
      { group: 'in', position: 'bottom' },
      { group: 'in', position: 'left' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '结束' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
  ],
});
