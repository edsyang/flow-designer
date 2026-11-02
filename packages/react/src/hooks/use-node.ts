import { useFlowDesigner } from '../context';
import type { ContentNode } from '@flow-designer/model';

export function useNode(nodeId: string): ContentNode | null {
  const doc = useFlowDesigner().editor.getDocument();
  return doc.getContent().getNode(nodeId) || null;
}
