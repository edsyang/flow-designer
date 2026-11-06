import type { ISkeleton } from "@flow-designer/skeleton";

import { useFlowDesigner } from "../context";

export function useSkeleton(): ISkeleton {
  return useFlowDesigner().skeleton;
}
