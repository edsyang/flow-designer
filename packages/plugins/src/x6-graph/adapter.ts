import type { IPluginManager } from "@flow-designer/core";
import type { GraphAdapterPort } from "@flow-designer/graph";

export interface X6GraphPluginExports {
  graphManager: GraphAdapterPort;
}

function isGraphAdapter(value: unknown): value is GraphAdapterPort {
  return (
    typeof value === "object" &&
    value !== null &&
    "getEdgeTypeName" in value &&
    typeof value.getEdgeTypeName === "function" &&
    "getEdgeTypeConfig" in value &&
    typeof value.getEdgeTypeConfig === "function" &&
    "getStencilNodeGroups" in value &&
    typeof value.getStencilNodeGroups === "function" &&
    "startNodeDrag" in value &&
    typeof value.startNodeDrag === "function" &&
    "subscribeEvents" in value &&
    typeof value.subscribeEvents === "function"
  );
}

/** Query the owned plugin export only while initialized; never cast a core port. */
export function getGraphAdapter(plugins: Pick<IPluginManager, "get">): GraphAdapterPort | null {
  const plugin = plugins.get("plugin-x6-graph");
  if (!plugin?.isInited() || plugin.disabled) return null;
  const exported: unknown = plugin.toProxy();
  if (typeof exported !== "object" || exported === null) return null;
  const adapter: unknown = Reflect.get(exported, "graphManager");
  return isGraphAdapter(adapter) ? adapter : null;
}
