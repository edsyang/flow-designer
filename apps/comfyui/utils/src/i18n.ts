const strings: Record<string, Record<string, string>> = {
  cn: {
    'comfyui.checkpoint': '模型加载器',
    'comfyui.ksampler': '采样器',
    'comfyui.clipTextEncode': '文本编码',
    'comfyui.vaeDecode': 'VAE 解码',
    'comfyui.saveImage': '保存图片',
    'comfyui.model': '模型',
    'comfyui.clip': 'CLIP',
    'comfyui.vae': 'VAE',
    'comfyui.conditioning': '条件',
    'comfyui.latent': '潜空间',
    'comfyui.image': '图像',
  },
  en: {
    'comfyui.checkpoint': 'Checkpoint Loader',
    'comfyui.ksampler': 'KSampler',
    'comfyui.clipTextEncode': 'CLIP Text Encode',
    'comfyui.vaeDecode': 'VAE Decode',
    'comfyui.saveImage': 'Save Image',
    'comfyui.model': 'Model',
    'comfyui.clip': 'CLIP',
    'comfyui.vae': 'VAE',
    'comfyui.conditioning': 'Conditioning',
    'comfyui.latent': 'Latent',
    'comfyui.image': 'Image',
  },
};

export function t(key: string, lang: string = 'cn'): string {
  return strings[lang]?.[key] ?? key;
}
