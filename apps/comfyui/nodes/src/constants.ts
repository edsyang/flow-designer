export const COMFYUI_CATEGORIES = {
  LOADERS: 'loaders',
  SAMPLING: 'sampling',
  CONDITIONING: 'conditioning',
  LATENT: 'latent',
  IMAGE: 'image',
} as const;

export const COMFYUI_TYPE_NAMES = {
  CHECKPOINT_LOADER: 'CheckpointLoaderSimple',
  KSAMPLER: 'KSampler',
  CLIP_TEXT_ENCODE: 'CLIPTextEncode',
  VAE_DECODE: 'VAEDecode',
  SAVE_IMAGE: 'SaveImage',
} as const;

export const DATA_TYPES = {
  MODEL: 'MODEL',
  CLIP: 'CLIP',
  VAE: 'VAE',
  CONDITIONING: 'CONDITIONING',
  LATENT: 'LATENT',
  IMAGE: 'IMAGE',
} as const;

export const DATA_TYPE_COLORS: Record<string, string> = {
  [DATA_TYPES.MODEL]: '#b39ddb',
  [DATA_TYPES.CLIP]: '#ffd54f',
  [DATA_TYPES.VAE]: '#ef5350',
  [DATA_TYPES.CONDITIONING]: '#ffb74d',
  [DATA_TYPES.LATENT]: '#ff6e9c',
  [DATA_TYPES.IMAGE]: '#64b5f6',
};
