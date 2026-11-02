import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { BPMN_CATEGORIES } from './constants';

export const timerEventDef = defineNode({
  meta: {
    name: '定时事件',
    typeName: 'TimerEvent',
    category: BPMN_CATEGORIES.EVENTS,
    icon: '⏱',
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
    { name: 'name', type: 'string', defaultValue: '定时事件' },
    { name: 'timerType', type: 'string', defaultValue: 'duration' },
    { name: 'timerValue', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    {
      target: 'timerType',
      description: '定时类型',
      setter: {
        type: 'SelectSetter',
        props: {
          options: [
            { label: '持续时间', value: 'duration' },
            { label: '循环', value: 'cycle' },
            { label: '指定时间', value: 'date' },
          ],
        },
      },
    },
    { target: 'timerValue', description: '定时表达式', setter: BuiltinSetters.String },
  ],
});
