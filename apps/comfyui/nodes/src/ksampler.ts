import { defineNode, t } from "@flow-designer/model";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from "./constants";

export const ksamplerDef = defineNode({
  meta: {
    name: t("comfyui.node.sampler"),
    typeName: COMFYUI_TYPE_NAMES.KSAMPLER,
    category: COMFYUI_CATEGORIES.SAMPLING,
    icon: "🎲",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 280, height: 180 },
    ports: [
      {
        id: "model",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.MODEL,
        label: t("comfyui.port.model"),
        color: DATA_TYPE_COLORS[DATA_TYPES.MODEL],
      },
      {
        id: "positive",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.CONDITIONING,
        label: "positive",
        color: DATA_TYPE_COLORS[DATA_TYPES.CONDITIONING],
      },
      {
        id: "negative",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.CONDITIONING,
        label: "negative",
        color: DATA_TYPE_COLORS[DATA_TYPES.CONDITIONING],
      },
      {
        id: "latent_image",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.LATENT,
        label: t("comfyui.port.latent"),
        color: DATA_TYPE_COLORS[DATA_TYPES.LATENT],
      },
      {
        id: "latent",
        group: "out",
        position: "right",
        dataType: DATA_TYPES.LATENT,
        label: t("comfyui.port.latent"),
        color: DATA_TYPE_COLORS[DATA_TYPES.LATENT],
      },
    ],
  },
  schema: [
    { name: "seed", type: "number", defaultValue: 0 },
    { name: "steps", type: "number", defaultValue: 20 },
    { name: "cfg", type: "number", defaultValue: 8 },
    { name: "sampler_name", type: "string", defaultValue: "euler" },
    { name: "scheduler", type: "string", defaultValue: "normal" },
    { name: "denoise", type: "number", defaultValue: 1 },
  ],
  editor: [
    {
      target: "seed",
      description: t("comfyui.property.seed"),
      setter: BuiltinSetters.Number,
    },
    {
      target: "steps",
      description: t("comfyui.property.steps"),
      setter: BuiltinSetters.Number,
    },
    {
      target: "cfg",
      description: t("comfyui.property.cfgScale"),
      setter: BuiltinSetters.Number,
    },
    {
      target: "sampler_name",
      description: t("comfyui.property.sampler"),
      setter: BuiltinSetters.String,
    },
    {
      target: "scheduler",
      description: t("comfyui.property.scheduler"),
      setter: BuiltinSetters.String,
    },
    {
      target: "denoise",
      description: t("comfyui.property.denoise"),
      setter: BuiltinSetters.Number,
    },
  ],
});
