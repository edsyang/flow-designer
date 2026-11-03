import { defineNode, t } from "@flow-designer/model";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const userTaskDef = defineNode({
  meta: {
    name: t("bpmn.node.userTask.label"),
    typeName: BPMN_TYPE_NAMES.USER_TASK,
    category: BPMN_CATEGORIES.TASKS,
    icon: "👤",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 120, height: 40 },
    ports: [
      { group: "in", position: "top" },
      { group: "in", position: "left" },
      { group: "out", position: "bottom" },
      { group: "out", position: "right" },
    ],
  },
  schema: [
    { name: "name", type: "string", defaultValue: "人工节点" },
    { name: "assignee", type: "string", defaultValue: "" },
    { name: "description", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
    {
      target: "assignee",
      description: t("bpmn.property.assignee"),
      setter: BuiltinSetters.String,
    },
    {
      target: "description",
      description: t("bpmn.property.description"),
      setter: BuiltinSetters.TextArea,
    },
  ],
});
