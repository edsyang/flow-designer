import type { ISkeleton } from "@flow-designer/model";
import { useFlowDesigner } from "../context";

export function useSkeleton(): ISkeleton {
  return useFlowDesigner().skeleton;
}
