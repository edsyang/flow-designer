import { defineNode, t } from "@flow-designer/model";
import { BuiltinSetters } from "@flow-designer/setters/constants";
import { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

export const parallelGatewayDef = defineNode({
  meta: {
    name: t("bpmn.node.parallelGateway"),
    typeName: BPMN_TYPE_NAMES.PARALLEL_GATEWAY,
    category: BPMN_CATEGORIES.GATEWAYS,
    icon: "⊕",
  },
  view: {
    type: "node",
    shape: "fd-diamond",
    defaultSize: { width: 90, height: 58 },
    ports: [
      { group: "in", position: "top" },
      { group: "in", position: "left" },
      { group: "out", position: "bottom" },
      { group: "out", position: "right" },
    ],
  },
  schema: [{ name: "name", type: "string", defaultValue: "并行网关" }],
  editor: [
    {
      target: "name",
      description: t("bpmn.property.name"),
      setter: BuiltinSetters.String,
    },
  ],
});
