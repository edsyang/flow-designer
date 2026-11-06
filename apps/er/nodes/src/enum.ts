import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from "./constants";

export const enumDef = defineNode({
  meta: {
    name: t("er.node.enum"),
    typeName: ER_TYPE_NAMES.ENUM,
    category: ER_CATEGORIES.ENUMS,
    icon: "📋",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 200, height: 80 },
    ports: [
      {
        id: "enum_out",
        group: "out",
        position: "right",
        dataType: ER_DATA_TYPES.ENUM_VALUE,
        label: "ENUM",
        color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.ENUM_VALUE],
      },
    ],
  },
  schema: [
    { name: "enumName", type: "string", defaultValue: "" },
    { name: "values", type: "string", defaultValue: "[]" },
  ],
  editor: [
    {
      target: "enumName",
      description: t("er.property.enumName"),
      setter: BuiltinSetters.String,
    },
    {
      target: "values",
      description: t("er.property.values"),
      setter: BuiltinSetters.Json,
    },
  ],
});
