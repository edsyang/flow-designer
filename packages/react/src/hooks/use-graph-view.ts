import { useFlowDesigner } from '../context';

export function useGraphView() {
  const graphView = useFlowDesigner().editor.getGraphView();
  return {
    zoom: graphView.getZoom(),
    editable: graphView.getEditable(),
    setZoom: (z: number) => graphView.setZoom(z),
    setEditable: (e: boolean) => graphView.setEditable(e),
  };
}
