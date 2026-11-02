import type { ContentData } from '@flow-designer/model';

export interface SerializedFlowElement {
  id: string;
  typeName: string;
  props?: Record<string, unknown>;
  position?: { x: number; y: number };
  sourceRef?: string;
  targetRef?: string;
  sourcePort?: string;
  targetPort?: string;
  vertices?: Array<{ x: number; y: number }>;
}

export interface IProcessContentData extends ContentData {
  elements?: SerializedFlowElement[];
}
