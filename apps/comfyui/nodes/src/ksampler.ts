import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from './constants';

export const ksamplerDef = defineNode({
  meta: {
    name: COMFYUI_TYPE_NAMES.KSAMPLER,
    typeName: COMFYUI_TYPE_NAMES.KSAMPLER,
    category: COMFYUI_CATEGORIES.SAMPLING,
    icon: '🎲',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 280, height: 180 },
    ports: [
      { id: 'model', group: 'in', position: 'left', dataType: DATA_TYPES.MODEL, label: 'MODEL', color: DATA_TYPE_COLORS[DATA_TYPES.MODEL] },
      { id: 'positive', group: 'in', position: 'left', dataType: DATA_TYPES.CONDITIONING, label: 'positive', color: DATA_TYPE_COLORS[DATA_TYPES.CONDITIONING] },
      { id: 'negative', group: 'in', position: 'left', dataType: DATA_TYPES.CONDITIONING, label: 'negative', color: DATA_TYPE_COLORS[DATA_TYPES.CONDITIONING] },
      { id: 'latent_image', group: 'in', position: 'left', dataType: DATA_TYPES.LATENT, label: 'LATENT', color: DATA_TYPE_COLORS[DATA_TYPES.LATENT] },
      { id: 'latent', group: 'out', position: 'right', dataType: DATA_TYPES.LATENT, label: 'LATENT', color: DATA_TYPE_COLORS[DATA_TYPES.LATENT] },
    ],
  },
  schema: [
    { name: 'seed', type: 'number', defaultValue: 0 },
    { name: 'steps', type: 'number', defaultValue: 20 },
    { name: 'cfg', type: 'number', defaultValue: 8 },
    { name: 'sampler_name', type: 'string', defaultValue: 'euler' },
    { name: 'scheduler', type: 'string', defaultValue: 'normal' },
    { name: 'denoise', type: 'number', defaultValue: 1 },
  ],
  editor: [
    { target: 'seed', description: 'Seed', setter: BuiltinSetters.Number },
    { target: 'steps', description: 'Steps', setter: BuiltinSetters.Number },
    { target: 'cfg', description: 'CFG Scale', setter: BuiltinSetters.Number },
    { target: 'sampler_name', description: 'Sampler', setter: BuiltinSetters.String },
    { target: 'scheduler', description: 'Scheduler', setter: BuiltinSetters.String },
    { target: 'denoise', description: 'Denoise', setter: BuiltinSetters.Number },
  ],
});
