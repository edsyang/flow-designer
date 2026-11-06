import type { EdgeTypeConfig } from "@flow-designer/graph";

export const dataLinkConfig: EdgeTypeConfig = {
  defaultAttrs: {
    line: {
      stroke: "#a1a1a1",
      strokeWidth: 2,
      sourceMarker: null,
      targetMarker: null,
    },
  },
  router: null,
  connector: { name: "port-curve" },
  schema: [{ name: "name", type: "string", defaultValue: "Data Link" }],
  editor: [],
};

export const DATA_LINK_TYPE = "DataLink";

export function getDataLinkEdgeType(): {
  name: string;
  config: EdgeTypeConfig;
} {
  return { name: DATA_LINK_TYPE, config: dataLinkConfig };
}
