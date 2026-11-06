import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const processGlobalDef = defineNode({
  meta: {
    name: t("bpmn.node.processProperties"),
    typeName: BPMN_TYPE_NAMES.PROCESS_GLOBAL,
    category: BPMN_CATEGORIES.GLOBAL,
    icon: "⚙",
  },
  view: {
    type: "node",
    draggable: false,
    deletable: false,
  },
  schema: [
    { name: "processName", type: "string", defaultValue: "" },
    { name: "processId", type: "string", defaultValue: "" },
    { name: "description", type: "string", defaultValue: "" },
    { name: "isExecutable", type: "boolean", defaultValue: true },
  ],
  editor: [
    {
      target: "processName",
      description: t("bpmn.property.processName"),
      setter: BuiltinSetters.String,
    },
    {
      target: "processId",
      description: t("bpmn.property.processId"),
      setter: BuiltinSetters.String,
    },
    {
      target: "description",
      description: t("bpmn.property.processDescription"),
      setter: BuiltinSetters.TextArea,
    },
    {
      target: "isExecutable",
      description: t("bpmn.property.executable"),
      setter: BuiltinSetters.Boolean,
    },
  ],
});
