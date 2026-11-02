import { defineNode } from '@flow-designer/model';
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from './constants';

export const vaeDecodeDef = defineNode({
  meta: {
    name: COMFYUI_TYPE_NAMES.VAE_DECODE,
    typeName: COMFYUI_TYPE_NAMES.VAE_DECODE,
    category: COMFYUI_CATEGORIES.LATENT,
    icon: '🖼️',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 240, height: 80 },
    ports: [
      { id: 'samples', group: 'in', position: 'left', dataType: DATA_TYPES.LATENT, label: 'LATENT', color: DATA_TYPE_COLORS[DATA_TYPES.LATENT] },
      { id: 'vae', group: 'in', position: 'left', dataType: DATA_TYPES.VAE, label: 'VAE', color: DATA_TYPE_COLORS[DATA_TYPES.VAE] },
      { id: 'image', group: 'out', position: 'right', dataType: DATA_TYPES.IMAGE, label: 'IMAGE', color: DATA_TYPE_COLORS[DATA_TYPES.IMAGE] },
    ],
  },
  schema: [],
  editor: [],
});
