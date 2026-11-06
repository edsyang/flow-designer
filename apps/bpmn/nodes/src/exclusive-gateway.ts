import { defineNode, t } from "@flow-designer/model";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const exclusiveGatewayDef = defineNode({
  meta: {
    name: t("bpmn.node.exclusiveGateway"),
    typeName: BPMN_TYPE_NAMES.EXCLUSIVE_GATEWAY,
    category: BPMN_CATEGORIES.GATEWAYS,
    icon: "◇",
  },
  view: {
    type: "node",
    shape: "fd-diamond",
    defaultSize: { width: 90, height: 58 },
    ports: [
      { group: "in", position: "top", connectionDirection: "both" },
      { group: "in", position: "left", connectionDirection: "both" },
      { group: "out", position: "bottom", connectionDirection: "both" },
      { group: "out", position: "right", connectionDirection: "both" },
    ],
  },
  schema: [
    {
      name: "name",
      type: "string",
      defaultValue: t("bpmn.node.exclusiveGateway"),
    },
    { name: "defaultFlow", type: "string", defaultValue: "" },
  ],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
    {
      target: "defaultFlow",
      description: t("bpmn.property.defaultFlow"),
      setter: BuiltinSetters.String,
    },
  ],
});
