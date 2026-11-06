import type { ComponentType } from "react";
import type { NodeMeta, NodeView, PortDefinition } from "./prototype";

// --- Cross-package interfaces (defined in model, implemented by skeleton/graph) ---

export interface IGraphManager {
  init(container: HTMLElement, options: GraphOptions): void;
  dispose(): void;
  registerNodeType(meta: NodeMeta, view: NodeView): void;
  registerEdgeType(name: string, config: EdgeTypeConfig): void;
  addNode(config: NodeConfig): string;
  addEdge(config: EdgeConfig): string;
  removeCell(id: string): void;
  resetCells(nodes: NodeConfig[], edges: EdgeConfig[]): void;
  getCellById(id: string): unknown;
  updateNodeData(nodeId: string, data: Record<string, unknown>): void;
  zoomTo(factor: number): void;
  getZoom(): number;
  centerContent(): void;
  zoomToFit(): void;
  resize(width: number, height: number): void;
  select(ids: string[]): void;
  getSelection(): string[];
  setInteractionMode(mode: InteractionMode): void;
  getInteractionMode(): InteractionMode;
  clientToLocal(x: number, y: number): { x: number; y: number };
  localToClient(x: number, y: number): { x: number; y: number };
  on(event: GraphEvent, handler: GraphEventHandler): void;
  off(event: GraphEvent, handler: GraphEventHandler): void;
  getPortDefinition(nodeId: string, portId: string): PortDefinition | null;
  getEdgeTypeName(cellId: string): string | null;
  /** First registered edge type, used when creating connections without an explicit type. */
  getDefaultEdgeType(): string | null;
  getEdgeTypeConfig(name: string): EdgeTypeConfig | null;
  /** Boolean commit-phase validation for real endpoints; use evaluateConnection for reasons or candidates. */
  checkConnection(context: ConnectionContext): boolean;
  evaluateConnection(
    context: ConnectionContext,
    options?: ConnectionCheckOptions,
  ): ConnectionValidationResult;
  resolveConnection(
    context: ConnectionContext,
    options?: ConnectionCheckOptions,
  ): ResolvedConnection;
  toJSON(): GraphData;
  fromJSON(data: GraphData): void;
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

// --- Cross-package types ---

export type InteractionMode = "select" | "pan";

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

export type ConnectionRejectionReason =
  | "workbench.connection.sourcePortRequired"
  | "workbench.connection.targetPortRequired"
  | "workbench.connection.sourceCannotConnect"
  | "workbench.connection.targetCannotReceive"
  | "workbench.connection.endpointMissing"
  | "workbench.connection.loopNotAllowed"
  | "workbench.connection.duplicateNotAllowed"
  | "workbench.connection.incompatible"
  | "workbench.connection.routeUnavailable";

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: ConnectionRejectionReason;
  /** Candidate metadata passed structural checks; the actual target must still be validated at commit. */
  deferred?: boolean;
}
export interface ResolvedConnection extends ConnectionValidationResult {
  sourcePortId?: string;
  targetPortId?: string;
}
export interface ConnectionCheckOptions {
  phase?: "candidate" | "commit";
  /** Existing edge excluded from duplicate checks while reconnecting it. */
  edgeId?: string;
}
export interface ConnectionRejectedEvent extends ConnectionValidationResult {
  sourceNode: string;
  targetNode: string;
}

export type ConnectionValidator = ((context: ConnectionContext) => boolean) & {
  /** Optional prototype-only policy; never receives fabricated node IDs. */
  validatePorts?: (ports: Pick<ConnectionContext, "sourcePort" | "targetPort">) => boolean;
};

export interface ConnectionContext {
  sourceNode: string;
  sourcePort: PortDefinition | null;
  targetNode: string;
  targetPort: PortDefinition | null;
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

export interface NodeConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  data?: Record<string, unknown>;
}

export interface EdgeConfig {
  id: string;
  type?: string;
  source: string | PortRef;
  target: string | PortRef;
  vertices?: Array<{ x: number; y: number }>;
  labels?: EdgeLabel[];
  data?: Record<string, unknown>;
}

export interface PortRef {
  cell: string;
  port: string;
}

export type EdgeLabel = string | { text: string; attrs?: Record<string, unknown> };

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
