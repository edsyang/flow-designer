import { defineNode } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from "./constants";

export const viewDef = defineNode({
  meta: {
    name: t("er.node.view"),
    typeName: ER_TYPE_NAMES.VIEW,
    category: ER_CATEGORIES.ENTITIES,
    icon: "👁",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 260, height: 100 },
    ports: [
      {
        id: "source",
        group: "in",
        position: "left",
        dataType: ER_DATA_TYPES.ROW,
        label: "SOURCE",
        color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.ROW],
      },
      {
        id: "row_out",
        group: "out",
        position: "right",
        dataType: ER_DATA_TYPES.ROW,
        label: "ROW",
        color: ER_DATA_TYPE_COLORS[ER_DATA_TYPES.ROW],
      },
    ],
  },
  schema: [
    { name: "viewName", type: "string", defaultValue: "" },
    { name: "query", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "viewName",
      description: t("er.property.viewName"),
      setter: BuiltinSetters.String,
    },
    {
      target: "query",
      description: t("er.property.query"),
      setter: BuiltinSetters.TextArea,
    },
  ],
});
