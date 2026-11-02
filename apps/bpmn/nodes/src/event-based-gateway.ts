import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

export const eventBasedGatewayDef = defineNode({
  meta: {
    name: '事件网关',
    typeName: BPMN_TYPE_NAMES.EVENT_BASED_GATEWAY,
    category: BPMN_CATEGORIES.GATEWAYS,
    icon: '⬠',
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
    { name: 'name', type: 'string', defaultValue: '事件网关' },
    { name: 'instantiate', type: 'boolean', defaultValue: false },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    { target: 'instantiate', description: '实例化', setter: BuiltinSetters.Boolean },
  ],
});
