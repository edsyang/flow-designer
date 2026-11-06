import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const startEventDef = defineNode({
  meta: {
    name: t("bpmn.node.startEvent.label"),
    typeName: BPMN_TYPE_NAMES.START_EVENT,
    category: BPMN_CATEGORIES.EVENTS,
    icon: "▶",
  },
  view: {
    type: "node",
    quickAdd: false,
    draggable: false,
    deletable: false,
    copyable: false,
    shape: "fd-circle",
    defaultSize: { width: 50, height: 50 },
    ports: [
      { group: "out", position: "top", connectionDirection: "out" },
      { group: "out", position: "right", connectionDirection: "out" },
      { group: "out", position: "bottom", connectionDirection: "out" },
      { group: "out", position: "left", connectionDirection: "out" },
    ],
  },
  schema: [{ name: "name", type: "string", defaultValue: "开始" }],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
  ],
});
