import type { SerializedNode, SerializedEdgeElement } from '@flow-designer/model';

export interface ComfyUINodeInput {
  [key: string]: unknown | [string, number];
}

export interface ComfyUINodeDef {
  class_type: string;
  inputs: ComfyUINodeInput;
  _meta?: {
    position?: { x: number; y: number };
  };
}

export type ComfyUIWorkflow = Record<string, ComfyUINodeDef>;

export interface TransformerDocumentData {
  type: string;
  version: string;
  elements: Array<SerializedNode | SerializedEdgeElement>;
}
