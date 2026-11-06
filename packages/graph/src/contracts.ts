import type { ComponentType, ReactElement } from "react";
import type { ContentNode, PortDefinition } from "@flow-designer/model";
import type {
  GraphPort,
  ConnectionValidator,
  ConnectionRejectionReason,
  PortRef,
  EdgeLabel,
} from "@flow-designer/core";

export interface GraphOptions {
  /** Enable X6 virtual rendering; disabled by default. */
  virtual?: boolean;
  /** Cull offscreen graph presentation at 300 or more nodes; enabled by default. */
  viewportCulling?: boolean;
  background?: string;
  grid?: boolean | GridConfig;
  snapline?: boolean;
  connecting?: {
    allowBlank?: boolean;
    /**
     * What happens when a connection drag ends over empty canvas.
     *
     * - `"choose-node"` (default): the editor drops the temporary edge and emits
     *   `connection:blank` so the workbench can offer a node picker, creating the
     *   node and the relation in one step.
     * - `"ignore"`: the X6 `allowBlank` behaviour applies (the edge is discarded
     *   unless `allowBlank` is `true`).
     */
    onBlankDrop?: "choose-node" | "ignore";
    allowMulti?: boolean;
    allowLoop?: boolean;
    highlight?: boolean;
    connectionValidator?: ConnectionValidator;
  };
  [extra: string]: unknown;
}

export interface GridConfig {
  size?: number;
  visible?: boolean;
  type?: "dot" | "fixedDot" | "mesh" | "doubleMesh";
}

export type GraphEvent =
  | "edge:routing:degraded"
  | "edge:routing:failed"
  | "node:click"
  | "node:dblclick"
  | "node:mouseenter"
  | "node:mouseleave"
  | "node:move"
  | "node:moved"
  | "node:added-by-stencil"
  | "edge:click"
  | "edge:dblclick"
  | "edge:mouseenter"
  | "edge:mouseleave"
  | "edge:connected"
  | "connection:blank"
  | "connection:rejected"
  | "edge:vertices:committed"
  | "blank:click"
  | "blank:dblclick"
  | "selection:changed"
  | "scale"
  | "interaction:change";

/** Payload of the `connection:blank` event. */
export interface BlankConnectionEvent {
  /** Source capability rejection shown as the picker's empty-state explanation. */
  reason?: ConnectionRejectionReason;
  /** Node the drag started from. */
  sourceCellId: string;
  /** Port the drag started from, when the source node exposes ports. */
  sourcePortId: string | null;
  /**
   * Temporary edge X6 drew for the drag. It stays visible until the caller
   * picks a node or dismisses the picker, then the caller removes it.
   */
  edgeId: string;
  /** Drop point in graph coordinates. */
  x: number;
  y: number;
}

export interface EdgeTypeConfig {
  component?: ComponentType<EdgeComponentProps>;
  defaultAttrs?: Record<string, unknown>;
  router?: string | { name: string; args?: Record<string, unknown> } | null;
  connector?: string | { name: string; args?: Record<string, unknown> };
  schema?: Array<{ name: string; type: string; defaultValue?: unknown }>;
  editor?: Array<{ target: string; description: string; setter: string }>;
}

export interface EdgeComponentProps {
  edge: unknown;
  data?: Record<string, unknown>;
}

export interface GraphData {
  nodes: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    data?: Record<string, unknown>;
    ports?: PortRef[];
  }>;
  edges: Array<{
    id: string;
    type?: string;
    source: string | PortRef;
    target: string | PortRef;
    vertices?: Array<{ x: number; y: number }>;
    labels?: EdgeLabel[];
    data?: Record<string, unknown>;
  }>;
}

export type GraphEventHandler = (...args: unknown[]) => void;
/** Renderer/native integration surface; core Editor and PluginContext expose only GraphPort. */
export interface GraphAdapterPort extends GraphPort {
  init(container: HTMLElement, options: GraphOptions): void;
  dispose(): void;
  registerNodeType(meta: NodeMeta, view: NodeView): void;
  registerEdgeType(name: string, config: EdgeTypeConfig): void;
  getEdgeTypeName(cellId: string): string | null;
  getEdgeTypeConfig(name: string): EdgeTypeConfig | null;
  setEdgeTypeName(cellId: string, type: string): void;
  getFirstPortOfGroup(nodeId: string, group: string): PortDefinition | null;
  getCellById(id: string): unknown;
  toJSON(): GraphData;
  fromJSON(data: GraphData): void;
  on(event: GraphEvent, handler: GraphEventHandler): void;
  off(event: GraphEvent, handler: GraphEventHandler): void;
  getX6Graph(): unknown;
  useX6Plugin(plugin: unknown): void;
  createStencil(container: HTMLElement, groups?: Array<{ name: string; title?: string }>): void;
  getStencilNodeGroups(): Array<{
    name: string;
    title: string;
    items: Array<{ type: string; name: string; icon: string; shape: string }>;
  }>;
  startNodeDrag(nodeType: string, event: MouseEvent): void;
}
/** Compatibility name for the concrete graph adapter, not a core application port. */
export type IGraphManager = GraphAdapterPort;

/** Renderer metadata belongs to the graph contribution, not the domain prototype. */
export interface NodeMeta {
  name: string;
  typeName: string;
  description?: string;
  icon?: string | ReactElement;
  category?: string;
  categoryTitle?: string;
}
export interface NodeComponentProps {
  node: ContentNode;
  selected: boolean;
  data: Record<string, unknown>;
}
export interface NodeView {
  type: "node" | "edge";
  quickAdd?: boolean;
  draggable?: boolean;
  deletable?: boolean;
  copyable?: boolean;
  component?: ComponentType<NodeComponentProps>;
  defaultSize?: { width: number; height: number };
  ports?: PortDefinition[];
  shape?: string;
}
