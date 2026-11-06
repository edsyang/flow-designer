import { defineNode } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from "./constants";

export const checkpointLoaderDef = defineNode({
  meta: {
    name: t("comfyui.node.checkpointLoader"),
    typeName: COMFYUI_TYPE_NAMES.CHECKPOINT_LOADER,
    category: COMFYUI_CATEGORIES.LOADERS,
    icon: "📦",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 260, height: 100 },
    ports: [
      {
        id: "model",
        group: "out",
        position: "right",
        dataType: DATA_TYPES.MODEL,
        label: t("comfyui.port.model"),
        color: DATA_TYPE_COLORS[DATA_TYPES.MODEL],
      },
      {
        id: "clip",
        group: "out",
        position: "right",
        dataType: DATA_TYPES.CLIP,
        label: t("comfyui.port.clip"),
        color: DATA_TYPE_COLORS[DATA_TYPES.CLIP],
      },
      {
        id: "vae",
        group: "out",
        position: "right",
        dataType: DATA_TYPES.VAE,
        label: t("comfyui.port.vae"),
        color: DATA_TYPE_COLORS[DATA_TYPES.VAE],
      },
    ],
  },
  schema: [{ name: "ckpt_name", type: "string", defaultValue: "" }],
  editor: [
    {
      target: "ckpt_name",
      description: t("comfyui.property.checkpoint"),
      setter: BuiltinSetters.String,
    },
  ],
});
