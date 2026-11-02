import type { ComponentType, ReactElement } from 'react';
import type { NodeMeta, NodeView, PortDefinition } from './prototype';

// --- Cross-package interfaces (defined in model, implemented by skeleton/graph) ---

export interface ISkeleton {
  header: IArea;
  sidebar: IArea;
  inspector: IArea;
  canvasToolbar: IArea;
  canvas: IArea;
  add(config: PaneConfig): void;
  remove(key: string): void;
}

export interface IArea {
  add(config: PaneConfig): void;
  remove(key: string): void;
  setVisible(visible: boolean): void;
  getVisible(): boolean;
  getItems(): PaneConfig[];
  getDidMountCallbacks(): Array<(container: HTMLElement) => void | (() => void)>;
  hooks: { didMount(cb: (container: HTMLElement) => void | (() => void)): () => void };
}

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
  getEdgeTypeConfig(name: string): EdgeTypeConfig | null;
  toJSON(): GraphData;
  fromJSON(data: GraphData): void;
  getX6Graph(): unknown;
  useX6Plugin(plugin: unknown): void;
  createStencil(container: HTMLElement, groups?: Array<{ name: string; title?: string }>): void;
  getStencilNodeGroups(): Array<{ name: string; title: string; items: Array<{ type: string; name: string; icon: string; shape: string }> }>;
  startNodeDrag(nodeType: string, event: MouseEvent): void;
}

// --- Cross-package types ---

export interface PaneConfig {
  key: string;
  area: 'canvasToolbar' | 'header' | 'canvas' | 'inspector' | 'sidebar';
  align?: 'left' | 'right' | 'center';
  content: string | ReactElement | ComponentType<any>;
  contentProps?: Record<string, unknown>;
}

export type InteractionMode = 'select' | 'pan';

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
  type?: 'dot' | 'fixedDot' | 'mesh' | 'doubleMesh';
}

export type ConnectionValidator = (context: ConnectionContext) => boolean;

export interface ConnectionContext {
  sourceNode: string;
  sourcePort: PortDefinition | null;
  targetNode: string;
  targetPort: PortDefinition | null;
}

export type GraphEvent =
  | 'edge:routing:failed'
  | 'node:click' | 'node:dblclick' | 'node:mouseenter' | 'node:mouseleave'
  | 'node:move' | 'node:moved'
  | 'node:added-by-stencil'
  | 'edge:click' | 'edge:dblclick' | 'edge:mouseenter' | 'edge:mouseleave'
  | 'edge:connected' | 'edge:vertices:committed'
  | 'blank:click' | 'blank:dblclick'
  | 'selection:changed'
  | 'scale' | 'interaction:change';

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
