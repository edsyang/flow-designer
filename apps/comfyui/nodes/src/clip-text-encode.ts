import { defineNode, t } from "@flow-designer/model";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { COMFYUI_CATEGORIES, COMFYUI_TYPE_NAMES, DATA_TYPES, DATA_TYPE_COLORS } from "./constants";

export const clipTextEncodeDef = defineNode({
  meta: {
    name: t("comfyui.node.clipTextEncode"),
    typeName: COMFYUI_TYPE_NAMES.CLIP_TEXT_ENCODE,
    category: COMFYUI_CATEGORIES.CONDITIONING,
    icon: "📝",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 240, height: 80 },
    ports: [
      {
        id: "clip",
        group: "in",
        position: "left",
        dataType: DATA_TYPES.CLIP,
        label: t("comfyui.port.clip"),
        color: DATA_TYPE_COLORS[DATA_TYPES.CLIP],
      },
      {
        id: "conditioning",
        group: "out",
        position: "right",
        dataType: DATA_TYPES.CONDITIONING,
        label: t("comfyui.port.conditioning"),
        color: DATA_TYPE_COLORS[DATA_TYPES.CONDITIONING],
      },
    ],
  },
  schema: [{ name: "text", type: "string", defaultValue: "" }],
  editor: [
    {
      target: "text",
      description: t("comfyui.property.prompt"),
      setter: BuiltinSetters.TextArea,
    },
  ],
});
