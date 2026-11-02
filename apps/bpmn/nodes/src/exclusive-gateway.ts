import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const exclusiveGatewayDef = defineNode({
  meta: {
    name: '排他网关',
    typeName: BPMN_TYPE_NAMES.EXCLUSIVE_GATEWAY,
    category: BPMN_CATEGORIES.GATEWAYS,
    icon: '◇',
  },
  view: {
    type: 'node',
    shape: 'fd-diamond',
    defaultSize: { width: 90, height: 58 },
    ports: [
      { group: 'in', position: 'top' },
      { group: 'in', position: 'left' },
      { group: 'out', position: 'bottom' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '排他网关' },
    { name: 'defaultFlow', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    { target: 'defaultFlow', description: '默认分支', setter: BuiltinSetters.String },
  ],
});
