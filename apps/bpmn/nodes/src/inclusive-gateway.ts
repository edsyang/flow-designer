import { defineNode } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const inclusiveGatewayDef = defineNode({
  meta: {
    name: t("bpmn.node.inclusiveGateway"),
    typeName: BPMN_TYPE_NAMES.INCLUSIVE_GATEWAY,
    category: BPMN_CATEGORIES.GATEWAYS,
    icon: "◎",
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
    { name: "name", type: "string", defaultValue: "包容网关" },
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
