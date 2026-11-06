import type { PortDefinition } from "@flow-designer/model";

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

export type Unsubscribe = () => void;
export interface GraphPoint {
  readonly x: number;
  readonly y: number;
}

/** Detached persistent edit fields only; no Cell, Point class, DOM, attrs or routePoints.
 * Optional port IDs retain today's absent-port semantics (do not invent a port/default).
 * edgeType is the registered business type ID, never the X6 shape/router name.
 */
export interface GraphEdgeSnapshot {
  readonly edgeId: string;
  readonly edgeType?: string;
  readonly sourceNodeId: string;
  readonly sourcePortId?: string;
  readonly targetNodeId: string;
  readonly targetPortId?: string;
  readonly vertices: readonly GraphPoint[];
}

/** A finalized gesture: all moved nodes and affected edges commit in one transaction. */
export interface GraphNodeMoveEdit {
  readonly type: "node-moved";
  readonly nodeId: string;
  readonly position: GraphPoint;
  /** Group gesture members; absent means the single nodeId/position pair. */
  readonly nodes?: readonly { readonly nodeId: string; readonly position: GraphPoint }[];
  readonly edges: readonly GraphEdgeSnapshot[];
}
export interface GraphEdgeConnectEdit {
  readonly type: "edge-connected";
  readonly edge: GraphEdgeSnapshot;
  /** Copy X6 isNew when present; model lookup remains bridge authority for existing relation. */
  readonly isNew?: boolean;
}
export interface GraphEdgeVerticesEdit {
  readonly type: "edge-vertices-edited";
  readonly edgeId: string;
  readonly vertices: readonly GraphPoint[];
}
export interface GraphStencilDropEdit {
  readonly type: "node-dropped";
  /** Temporary projection clone, NOT a model-generated content node ID. */
  readonly temporaryNodeId: string;
  /** Existing __nodeType (prototype typeName), not translated display name. */
  readonly nodeType: string;
  readonly position: GraphPoint;
}
export type GraphEdit =
  GraphNodeMoveEdit | GraphEdgeConnectEdit | GraphEdgeVerticesEdit | GraphStencilDropEdit;

/** Projection-only updates needed by existing NodeBridge. No arbitrary X6 attrs/config.
 * Omitted fields are unchanged; portLabels update existing ports only.
 * Keep updateNodeData as its existing separate method; no extra size capability needed.
 * Adapter compares coordinates before setting them, preserving today's echo protection.
 */
export interface GraphNodePatch {
  readonly nodeId: string;
  readonly position?: GraphPoint;
  readonly label?: string;
  readonly portLabels?: readonly { readonly portId: string; readonly label: string }[];
}

export interface GraphConnectionRejection {
  readonly valid: false;
  readonly reason?: ConnectionRejectionReason;
  readonly sourceNode: string;
  readonly targetNode: string;
}

/** Typed application notifications, distinct from persistent edits.
 * Coordinates are explicitly named: blank pointer clientPosition is optional only when
 * original native event lacks finite client coordinates; graphPosition is local canvas.
 * UI may use localToClient for that existing fallback. No native Event escapes.
 */
export type GraphApplicationEvent =
  | { readonly type: "selection-changed"; readonly ids: readonly string[] }
  | { readonly type: "edge-clicked"; readonly edgeId: string }
  | { readonly type: "blank-clicked" }
  | {
      readonly type: "blank-double-clicked";
      readonly graphPosition?: GraphPoint;
      readonly clientPosition?: GraphPoint;
    }
  | {
      readonly type: "connection-blank";
      readonly sourceNodeId: string;
      readonly sourcePortId: string | null;
      readonly temporaryEdgeId: string;
      readonly graphPosition: GraphPoint;
      readonly reason?: ConnectionRejectionReason;
    }
  | ({ readonly type: "connection-rejected" } & GraphConnectionRejection)
  | {
      readonly type: "routing-degraded";
      readonly edgeIds: readonly string[];
      readonly reason: "workbench.connection.legacyRouteWarning";
    }
  | { readonly type: "interaction-changed"; readonly mode: "select" | "pan" }
  | { readonly type: "zoom-changed"; readonly zoom: number };

/** Core-visible schema/default queries must not return EdgeTypeConfig, which contains
 * React component, attrs, router and connector. Reuse existing schema field types.
 */
export interface GraphEdgeTypeMetadata {
  readonly schema?: readonly {
    readonly name: string;
    readonly type: string;
    readonly defaultValue?: unknown;
  }[];
}

/** The core sees editor application capabilities, never X6 cells or renderer options. */
export interface GraphProjectionPort {
  addNode(config: NodeConfig): string;
  addEdge(config: EdgeConfig): string;
  updateEdge(config: EdgeConfig): void;
  removeCell(id: string): void;
  resetCells(nodes: NodeConfig[], edges: EdgeConfig[]): void;
  batchUpdate<T>(operation: () => T): T;
  patchNode(patch: GraphNodePatch): void;
  updateNodeData(nodeId: string, data: Record<string, unknown>): void;
}
export interface GraphSelectionPort {
  select(ids: string[]): void;
  getSelection(): string[];
}
export interface GraphViewportPort {
  zoomTo(factor: number): void;
  getZoom(): number;
  centerContent(): void;
  zoomToFit(): void;
  resize(width: number, height: number): void;
  clientToLocal(x: number, y: number): GraphPoint;
  localToClient(x: number, y: number): GraphPoint;
}
export type InteractionMode = "select" | "pan";
export interface GraphInteractionPort {
  setInteractionMode(mode: InteractionMode): void;
  getInteractionMode(): InteractionMode;
}
export interface GraphConnectionPort {
  getNodePorts(nodeId: string): readonly PortDefinition[];
  getPortDefinition(nodeId: string, portId: string): PortDefinition | null;
  /** Registered business edge type ID; this does not expose renderer configuration. */
  getEdgeTypeName(cellId: string): string | null;
  getDefaultEdgeType(): string | null;
  getEdgeTypeMetadata(name: string): GraphEdgeTypeMetadata | null;
  checkConnection(context: ConnectionContext): boolean;
  evaluateConnection(
    context: ConnectionContext,
    options?: ConnectionCheckOptions,
  ): ConnectionValidationResult;
  resolveConnection(
    context: ConnectionContext,
    options?: ConnectionCheckOptions,
  ): ResolvedConnection;
}
export interface GraphSubscriptionsPort {
  subscribeEdits(listener: (edit: GraphEdit) => void): Unsubscribe;
  subscribeEvents(listener: (event: GraphApplicationEvent) => void): Unsubscribe;
  notifyConnectionRejected(rejection: GraphConnectionRejection): void;
}
export interface GraphPort
  extends
    GraphProjectionPort,
    GraphSelectionPort,
    GraphViewportPort,
    GraphInteractionPort,
    GraphConnectionPort,
    GraphSubscriptionsPort {}
