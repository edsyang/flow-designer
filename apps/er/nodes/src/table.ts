import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from './constants';

export const tableDef = defineNode({
  meta: {
    name: ER_TYPE_NAMES.TABLE,
    typeName: ER_TYPE_NAMES.TABLE,
    category: ER_CATEGORIES.ENTITIES,
    icon: '🗂',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 280, height: 120 },
    ports: [
      { id: 'pk', group: 'in', position: 'left', dataType: ER_DATA_TYPES.REFERENCE, label: 'PK', color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.REFERENCE] },
      { id: 'ref_out', group: 'out', position: 'right', dataType: ER_DATA_TYPES.REFERENCE, label: 'FK', color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.REFERENCE] },
      { id: 'row_out', group: 'out', position: 'bottom', dataType: ER_DATA_TYPES.ROW, label: 'ROW', color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.ROW] },
    ],
  },
  schema: [
    { name: 'tableName', type: 'string', defaultValue: '' },
    { name: 'fields', type: 'string', defaultValue: '[]' },
    { name: 'primaryKey', type: 'string', defaultValue: 'id' },
  ],
  editor: [
    { target: 'tableName', description: 'Table Name', setter: BuiltinSetters.String },
    { target: 'fields', description: 'Fields (JSON)', setter: BuiltinSetters.Json },
    { target: 'primaryKey', description: 'Primary Key', setter: BuiltinSetters.String },
  ],
});
