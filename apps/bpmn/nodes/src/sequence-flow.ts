import { BuiltinSetters } from "@flow-designer/setters/constants";
import { canUsePort, t } from "@flow-designer/model";
import type { ConnectionContext, EdgeTypeConfig } from "@flow-designer/model";
import { BPMN_TYPE_NAMES } from "./constants";

export const sequenceFlowConfig: EdgeTypeConfig = {
  defaultAttrs: {
    line: {
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
  connector: { name: "normal", args: { adaptiveTargetMarkerSize: 8 } },
  schema: [
    { name: "name", type: "string", defaultValue: t("bpmn.node.sequenceFlow") },
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
  return canUsePort(sourcePort, "source") && canUsePort(targetPort, "target");
}
