import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from './constants';

export const enumDef = defineNode({
  meta: {
    name: ER_TYPE_NAMES.ENUM,
    typeName: ER_TYPE_NAMES.ENUM,
    category: ER_CATEGORIES.ENUMS,
    icon: '📋',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 200, height: 80 },
    ports: [
      { id: 'enum_out', group: 'out', position: 'right', dataType: ER_DATA_TYPES.ENUM_VALUE, label: 'ENUM', color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.ENUM_VALUE] },
    ],
  },
  schema: [
    { name: 'enumName', type: 'string', defaultValue: '' },
    { name: 'values', type: 'string', defaultValue: '[]' },
  ],
  editor: [
    { target: 'enumName', description: 'Enum Name', setter: BuiltinSetters.String },
    { target: 'values', description: 'Values (JSON)', setter: BuiltinSetters.Json },
  ],
});
