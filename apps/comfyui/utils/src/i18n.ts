import { t as translate } from "@flow-designer/i18n";

const keyMap: Record<string, string> = {
  "comfyui.checkpoint": "comfyui.node.checkpointLoader",
  "comfyui.ksampler": "comfyui.node.sampler",
  "comfyui.clipTextEncode": "comfyui.node.clipTextEncode",
  "comfyui.vaeDecode": "comfyui.node.vaeDecode",
  "comfyui.saveImage": "comfyui.node.saveImage",
  "comfyui.model": "comfyui.port.model",
  "comfyui.clip": "comfyui.port.clip",
  "comfyui.vae": "comfyui.port.vae",
  "comfyui.conditioning": "comfyui.port.conditioning",
  "comfyui.latent": "comfyui.port.latent",
  "comfyui.image": "comfyui.port.image",
};

export function t(key: string, language?: string): string {
  const lng =
    language === "cn" || language === "zh-CN"
      ? "zh-CN"
      : language === "en" || language === "en-US"
        ? "en-US"
        : undefined;
  return translate(keyMap[key] ?? key, lng ? { lng } : undefined);
}
