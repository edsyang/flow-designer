import { useFlowDesigner } from '../context';
import type { Props, ContentNode } from '@flow-designer/model';

export function useNodeProps(nodeId: string): Props<ContentNode> | null {
  const doc = useFlowDesigner().editor.getDocument();
  const node = doc.getContent().getNode(nodeId);
  return node ? node.getProps() : null;
}
