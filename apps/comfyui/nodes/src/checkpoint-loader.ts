import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from './constants';

export const checkpointLoaderDef = defineNode({
  meta: {
    name: COMFYUI_TYPE_NAMES.CHECKPOINT_LOADER,
    typeName: COMFYUI_TYPE_NAMES.CHECKPOINT_LOADER,
    category: COMFYUI_CATEGORIES.LOADERS,
    icon: '📦',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 260, height: 100 },
    ports: [
      { id: 'model', group: 'out', position: 'right', dataType: DATA_TYPES.MODEL, label: 'MODEL', color: DATA_TYPE_COLORS[DATA_TYPES.MODEL] },
      { id: 'clip', group: 'out', position: 'right', dataType: DATA_TYPES.CLIP, label: 'CLIP', color: DATA_TYPE_COLORS[DATA_TYPES.CLIP] },
      { id: 'vae', group: 'out', position: 'right', dataType: DATA_TYPES.VAE, label: 'VAE', color: DATA_TYPE_COLORS[DATA_TYPES.VAE] },
    ],
  },
  schema: [
    { name: 'ckpt_name', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'ckpt_name', description: 'Checkpoint', setter: BuiltinSetters.String },
  ],
});
