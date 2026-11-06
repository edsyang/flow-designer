import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES } from "./constants";

export const timerEventDef = defineNode({
  meta: {
    name: t("bpmn.node.timerEvent"),
    typeName: "TimerEvent",
    category: BPMN_CATEGORIES.EVENTS,
    icon: "⏱",
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
    { name: "name", type: "string", defaultValue: "定时事件" },
    { name: "timerType", type: "string", defaultValue: "duration" },
    { name: "timerValue", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
    {
      target: "timerType",
      description: t("bpmn.property.timerType"),
      setter: {
        type: "SelectSetter",
        props: {
          options: [
            { label: t("bpmn.property.duration"), value: "duration" },
            { label: t("bpmn.property.cycle"), value: "cycle" },
            { label: t("bpmn.property.date"), value: "date" },
          ],
        },
      },
    },
    {
      target: "timerValue",
      description: t("bpmn.property.timerExpression"),
      setter: BuiltinSetters.String,
    },
  ],
});
