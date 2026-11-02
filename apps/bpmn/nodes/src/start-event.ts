import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const startEventDef = defineNode({
  meta: {
    name: '开始',
    typeName: BPMN_TYPE_NAMES.START_EVENT,
    category: BPMN_CATEGORIES.EVENTS,
    icon: '▶',
  },
  view: {
    type: 'node',
    quickAdd: false,
    draggable: false,
    deletable: false,
    copyable: false,
    shape: 'fd-circle',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { group: 'out', position: 'top' },
      { group: 'out', position: 'right' },
      { group: 'out', position: 'bottom' },
      { group: 'out', position: 'left' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '开始' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
  ],
});
