import { useFlowDesigner } from "../context";

export function useDocument() {
  return useFlowDesigner().editor.getDocument();
}
