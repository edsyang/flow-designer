import type { IPluginManager } from "@flow-designer/core";
import { useFlowDesigner } from "../context";

export function usePlugins(): IPluginManager {
  return useFlowDesigner().editor.getPlugins();
}
