import { useFlowDesigner } from "../context";

export function useEditor() {
  return useFlowDesigner().editor;
}
