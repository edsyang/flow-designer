import type { IGraphManager } from '@flow-designer/model';
import { useFlowDesigner } from '../context';

export function useGraph(): IGraphManager | null {
  const { editor } = useFlowDesigner();
  return editor.getGraph();
}
