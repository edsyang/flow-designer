import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const processGlobalDef = defineNode({
  meta: {
    name: '流程属性',
    typeName: BPMN_TYPE_NAMES.PROCESS_GLOBAL,
    category: BPMN_CATEGORIES.GLOBAL,
    icon: '⚙',
  },
  view: {
    type: 'node',
    draggable: false,
    deletable: false,
  },
  schema: [
    { name: 'processName', type: 'string', defaultValue: '' },
    { name: 'processId', type: 'string', defaultValue: '' },
    { name: 'description', type: 'string', defaultValue: '' },
    { name: 'isExecutable', type: 'boolean', defaultValue: true },
  ],
  editor: [
    { target: 'processName', description: '流程名称', setter: BuiltinSetters.String },
    { target: 'processId', description: '流程标识', setter: BuiltinSetters.String },
    { target: 'description', description: '流程描述', setter: BuiltinSetters.TextArea },
    { target: 'isExecutable', description: '可执行', setter: BuiltinSetters.Boolean },
  ],
});
