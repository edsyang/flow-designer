import { prototypeRegistry, t } from "@flow-designer/model";
export { comfyuiMessages } from "./i18n";
import type { NodeDefinition } from "@flow-designer/model";
import { checkpointLoaderDef } from "./checkpoint-loader";
import { ksamplerDef } from "./ksampler";
import { clipTextEncodeDef } from "./clip-text-encode";
import { vaeDecodeDef } from "./vae-decode";
import { saveImageDef } from "./save-image";

export { checkpointLoaderDef } from "./checkpoint-loader";
export { ksamplerDef } from "./ksampler";
export { clipTextEncodeDef } from "./clip-text-encode";
export { vaeDecodeDef } from "./vae-decode";
export { saveImageDef } from "./save-image";
export { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from "./constants";
export { dataLinkConfig, DATA_LINK_TYPE, getDataLinkEdgeType } from "./data-link";

const allDefs: NodeDefinition[] = [
  checkpointLoaderDef,
  ksamplerDef,
  clipTextEncodeDef,
  vaeDecodeDef,
  saveImageDef,
];

/**
 * Registers the ComfyUI node definitions in the global prototype registry.
 *
 * Idempotent: already-registered types are left to `refreshComfyUITranslations()`,
 * which owns locale updates. Registering an absent type is this function's job.
 */
export function registerComfyUINodes(): void {
  for (const def of allDefs) {
    if (!prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }
}

/**
 * Rewrites the shared ComfyUI definitions with the active locale and
 * re-registers the types that are already present. It never registers a new
 * type: a translation refresh must not create nodes as a side effect.
 */
export function refreshComfyUITranslations(): void {
  const names: Record<string, string> = {
    CheckpointLoaderSimple: "comfyui.node.checkpointLoader",
    KSampler: "comfyui.node.sampler",
    CLIPTextEncode: "comfyui.node.clipTextEncode",
    VAEDecode: "comfyui.node.vaeDecode",
    SaveImage: "comfyui.node.saveImage",
  };
  const descriptions: Record<string, string> = {
    ckpt_name: "comfyui.property.checkpoint",
    seed: "comfyui.property.seed",
    steps: "comfyui.property.steps",
    cfg: "comfyui.property.cfgScale",
    sampler_name: "comfyui.property.sampler",
    scheduler: "comfyui.property.scheduler",
    denoise: "comfyui.property.denoise",
    text: "comfyui.property.prompt",
    filename_prefix: "comfyui.property.filenamePrefix",
  };
  const categoryTitles: Record<string, string> = {
    loaders: "comfyui.category.loaders",
    sampling: "comfyui.category.sampling",
    conditioning: "comfyui.category.conditioning",
    latent: "comfyui.category.latent",
    image: "comfyui.category.image",
  };
  const portLabels: Record<string, string> = {
    model: "comfyui.port.model",
    clip: "comfyui.port.clip",
    vae: "comfyui.port.vae",
    conditioning: "comfyui.port.conditioning",
    latent: "comfyui.port.latent",
    image: "comfyui.port.image",
  };

  for (const def of allDefs) {
    def.meta.name = t(names[def.meta.typeName]!);
    if (def.meta.category && categoryTitles[def.meta.category]) {
      def.meta.categoryTitle = t(categoryTitles[def.meta.category]!);
    }
    for (const field of def.editor) {
      if (typeof field.target === "string" && descriptions[field.target]) {
        field.description = t(descriptions[field.target]!);
      }
    }
    for (const port of def.view.ports ?? []) {
      if (port.id && portLabels[port.id]) port.label = t(portLabels[port.id]!);
    }
    if (prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }
}
