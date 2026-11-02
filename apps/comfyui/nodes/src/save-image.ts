import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from './constants';

export const saveImageDef = defineNode({
  meta: {
    name: COMFYUI_TYPE_NAMES.SAVE_IMAGE,
    typeName: COMFYUI_TYPE_NAMES.SAVE_IMAGE,
    category: COMFYUI_CATEGORIES.IMAGE,
    icon: '💾',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 240, height: 80 },
    ports: [
      { id: 'images', group: 'in', position: 'left', dataType: DATA_TYPES.IMAGE, label: 'IMAGE', color: DATA_TYPE_COLORS[DATA_TYPES.IMAGE] },
    ],
  },
  schema: [
    { name: 'filename_prefix', type: 'string', defaultValue: 'ComfyUI' },
  ],
  editor: [
    { target: 'filename_prefix', description: 'Filename Prefix', setter: BuiltinSetters.String },
  ],
});
