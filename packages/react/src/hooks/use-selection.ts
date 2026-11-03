import { useFlowDesigner } from "../context";

export function useSelection() {
  const doc = useFlowDesigner().editor.getDocument();
  const selection = doc.getSelection();

  return {
    keys: selection.getKeys(),
    setKeys: (keys: string[]) => {
      selection.setKeys(keys);
    },
    clear: () => {
      selection.setKeys([]);
    },
  };
}
