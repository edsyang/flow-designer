import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const userTaskDef = defineNode({
  meta: {
    name: '人工节点',
    typeName: BPMN_TYPE_NAMES.USER_TASK,
    category: BPMN_CATEGORIES.TASKS,
    icon: '👤',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { group: 'in', position: 'top' },
      { group: 'in', position: 'left' },
      { group: 'out', position: 'bottom' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '人工节点' },
    { name: 'assignee', type: 'string', defaultValue: '' },
    { name: 'description', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    { target: 'assignee', description: '处理人', setter: BuiltinSetters.String },
    { target: 'description', description: '描述', setter: BuiltinSetters.TextArea },
  ],
});
