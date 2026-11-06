import { defineNode } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const endEventDef = defineNode({
  meta: {
    name: t("bpmn.node.endEvent.label"),
    typeName: BPMN_TYPE_NAMES.END_EVENT,
    category: BPMN_CATEGORIES.EVENTS,
    icon: "⏹",
  },
  view: {
    type: "node",
    quickAdd: false,
    draggable: false,
    deletable: false,
    copyable: false,
    shape: "fd-circle-end",
    defaultSize: { width: 50, height: 50 },
    ports: [
      { group: "in", position: "top", connectionDirection: "in" },
      { group: "in", position: "right", connectionDirection: "in" },
      { group: "in", position: "bottom", connectionDirection: "in" },
      { group: "in", position: "left", connectionDirection: "in" },
    ],
  },
  schema: [{ name: "name", type: "string", defaultValue: "结束" }],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
  ],
});
