import { prototypeRegistry } from '@flow-designer/model';
import type { NodeDefinition } from '@flow-designer/model';
import { checkpointLoaderDef } from './checkpoint-loader';
import { ksamplerDef } from './ksampler';
import { clipTextEncodeDef } from './clip-text-encode';
import { vaeDecodeDef } from './vae-decode';
import { saveImageDef } from './save-image';

export { checkpointLoaderDef } from './checkpoint-loader';
export { ksamplerDef } from './ksampler';
export { clipTextEncodeDef } from './clip-text-encode';
export { vaeDecodeDef } from './vae-decode';
export { saveImageDef } from './save-image';
export { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from './constants';
export { dataLinkConfig, DATA_LINK_TYPE, getDataLinkEdgeType } from './data-link';

const allDefs: NodeDefinition[] = [
  checkpointLoaderDef,
  ksamplerDef,
  clipTextEncodeDef,
  vaeDecodeDef,
  saveImageDef,
];

export function registerComfyUINodes(): void {
  for (const def of allDefs) {
    prototypeRegistry.register(def);
  }
}
