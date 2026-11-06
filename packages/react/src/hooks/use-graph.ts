import type { GraphPort } from "@flow-designer/core";

import { useFlowDesigner } from "../context";

export function useGraph(): GraphPort | null {
  const { editor } = useFlowDesigner();
  return editor.getGraph();
}
