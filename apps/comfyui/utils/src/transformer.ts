import type { SerializedNode, SerializedEdgeElement } from '@flow-designer/model';
import type { ComfyUIWorkflow, TransformerDocumentData } from './types';

let idCounter = 0;

function generateId(): string {
  return `comfyui_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export const comfyuiTransformer = {
  format: 'comfyui-api',
  contentType: 'comfyui',

  transformIn(external: ComfyUIWorkflow): TransformerDocumentData {
    const nodes: SerializedNode[] = [];
    const edges: SerializedEdgeElement[] = [];
    const nodeIdMap = new Map<string, string>();

    for (const [comfyId, nodeDef] of Object.entries(external)) {
      const shellId = generateId();
      nodeIdMap.set(comfyId, shellId);

      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(nodeDef.inputs)) {
        if (!Array.isArray(value)) {
          props[key] = value;
        }
      }

      nodes.push({
        id: shellId,
        typeName: nodeDef.class_type,
        props,
        position: nodeDef._meta?.position ?? { x: 0, y: 0 },
      });
    }

    for (const [comfyId, nodeDef] of Object.entries(external)) {
      const targetShellId = nodeIdMap.get(comfyId)!;

      for (const [inputName, value] of Object.entries(nodeDef.inputs)) {
        if (Array.isArray(value)) {
          const [sourceComfyId, sourceSlot] = value;
          const sourceShellId = nodeIdMap.get(String(sourceComfyId))!;
          edges.push({
            id: generateId(),
            typeName: 'Edge',
            sourceRef: sourceShellId,
            targetRef: targetShellId,
            sourcePort: `output_${sourceSlot}`,
            targetPort: inputName,
          });
        }
      }
    }

    return { type: 'comfyui', version: '1.0.0', elements: [...nodes, ...edges] };
  },

  transformOut(data: TransformerDocumentData): ComfyUIWorkflow {
    const result: ComfyUIWorkflow = {};
    const shellIdToComfyId = new Map<string, string>();

    const nodeElements = data.elements.filter((el): el is SerializedNode => !('sourceRef' in el));
    const edgeElements = data.elements.filter((el): el is SerializedEdgeElement => 'sourceRef' in el);

    nodeElements.forEach((node, index) => {
      shellIdToComfyId.set(node.id, String(index + 1));
    });

    for (const node of nodeElements) {
      const comfyId = shellIdToComfyId.get(node.id)!;
      result[comfyId] = {
        class_type: node.typeName,
        inputs: { ...node.props },
        _meta: { position: node.position },
      };
    }

    for (const edge of edgeElements) {
      const targetComfyId = shellIdToComfyId.get(edge.targetRef)!;
      const sourceComfyId = shellIdToComfyId.get(edge.sourceRef)!;
      const slotIndex = parseInt(edge.sourcePort?.replace('output_', '') ?? '0');
      const inputName = edge.targetPort ?? 'default';
      if (result[targetComfyId]) {
        result[targetComfyId].inputs[inputName] = [sourceComfyId, slotIndex];
      }
    }

    return result;
  },
};
