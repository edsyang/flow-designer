export interface SerializedNode {
  id: string;
  typeName: string;
  props: Record<string, unknown>;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface SerializedEdgeElement {
  id: string;
  typeName: string;
  sourceRef: string;
  targetRef: string;
  sourcePort?: string;
  targetPort?: string;
  props?: Record<string, unknown>;
  vertices?: Array<{ x: number; y: number }>;
}

export interface SerializedRelation {
  id: string;
  targetNodeId: string;
  sourcePort?: string;
  targetPort?: string;
  type?: string;
  props?: Record<string, unknown>;
  vertices?: Array<{ x: number; y: number }>;
}

export interface ContentTransformer<TExternal = unknown> {
  format: string;
  contentType: string;
  transformIn(external: TExternal): any;
  transformOut(data: any): TExternal;
}

// --- Type aliases ---

export type NodeCreator = (
  typeName: string,
  id: string,
  props: Record<string, unknown>,
) => any;

export type Command = (...params: unknown[]) => void | Promise<void>;

export type PropsChangeFn = (changing: unknown) => void;
