import type { EdgeTypeConfig } from "@flow-designer/model";

export const relationConfig: EdgeTypeConfig = {
  defaultAttrs: {
    line: {
      stroke: "#555",
      strokeWidth: 1.5,
      sourceMarker: null,
      targetMarker: null,
    },
  },
  router: null,
  connector: { name: "port-curve" },
  schema: [{ name: "name", type: "string", defaultValue: "Relation" }],
  editor: [],
};

export const RELATION_TYPE = "Relation";

export function getRelationEdgeType(): {
  name: string;
  config: EdgeTypeConfig;
} {
  return { name: RELATION_TYPE, config: relationConfig };
}
