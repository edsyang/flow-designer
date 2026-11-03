import { BuiltinSetters } from "@flow-designer/setters/constants";
import { t } from "@flow-designer/model";
import type { ConnectionContext, EdgeTypeConfig } from "@flow-designer/model";
import { BPMN_TYPE_NAMES } from "./constants";

export const sequenceFlowConfig: EdgeTypeConfig = {
  defaultAttrs: {
    line: {
      stroke: "#4C6079",
      strokeWidth: 1,
      targetMarker: { name: "block", size: 8 },
    },
  },
  router: {
    name: "manhattan",
    args: {
      padding: 20,
      step: 16,
    },
  },
  connector: { name: "normal" },
  schema: [
    { name: "name", type: "string", defaultValue: "" },
    { name: "conditionExpression", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
    {
      target: "conditionExpression",
      description: t("bpmn.property.condition"),
      setter: BuiltinSetters.TextArea,
    },
  ],
};

export const SEQUENCE_FLOW_TYPE = BPMN_TYPE_NAMES.SEQUENCE_FLOW;

export function isValidBpmnConnection({ sourcePort, targetPort }: ConnectionContext): boolean {
  return sourcePort?.group === "out" && targetPort?.group === "in";
}
