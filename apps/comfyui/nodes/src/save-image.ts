import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from "./constants";

export const saveImageDef = defineNode({
  meta: {
    name: t("comfyui.node.saveImage"),
    typeName: COMFYUI_TYPE_NAMES.SAVE_IMAGE,
    category: COMFYUI_CATEGORIES.IMAGE,
    icon: "💾",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 240, height: 80 },
    ports: [
      {
        id: "images",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.IMAGE,
        label: t("comfyui.port.image"),
        color: DATA_TYPE_COLORS[DATA_TYPES.IMAGE],
      },
    ],
  },
  schema: [{ name: "filename_prefix", type: "string", defaultValue: "ComfyUI" }],
  editor: [
    {
      target: "filename_prefix",
      description: t("comfyui.property.filenamePrefix"),
      setter: BuiltinSetters.String,
    },
  ],
});
