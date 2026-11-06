import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES } from "./constants";

export const messageEventDef = defineNode({
  meta: {
    name: t("bpmn.node.messageEvent"),
    typeName: "MessageEvent",
    category: BPMN_CATEGORIES.EVENTS,
    icon: "✉",
  },
  view: {
    type: "node",
    shape: "fd-rect-event",
    defaultSize: { width: 100, height: 32 },
    ports: [
      { group: "in", position: "top", connectionDirection: "both" },
      { group: "in", position: "left", connectionDirection: "both" },
      { group: "out", position: "bottom", connectionDirection: "both" },
      { group: "out", position: "right", connectionDirection: "both" },
    ],
  },
  schema: [
    { name: "name", type: "string", defaultValue: "消息事件" },
    { name: "messageRef", type: "string", defaultValue: "" },
    { name: "messageName", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
    {
      target: "messageRef",
      description: t("bpmn.property.messageRef"),
      setter: BuiltinSetters.String,
    },
    {
      target: "messageName",
      description: t("bpmn.property.messageName"),
      setter: BuiltinSetters.String,
    },
  ],
});
