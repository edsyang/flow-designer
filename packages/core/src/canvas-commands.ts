import type { Document } from "@flow-designer/model";
import type { GraphConnectionPort, ConnectionValidationResult } from "./graph-contracts";

export const CANVAS_COMMANDS = {
  createNode: "canvas.createNode",
  connectNodes: "canvas.connectNodes",
  evaluatePrototype: "canvas.evaluatePrototype",
} as const;

export interface CanvasCommandContext {
  document: Document;
  graph: GraphConnectionPort;
}
export interface CanvasConnectionSource {
  nodeId: string;
  portId: string | null;
}
export interface CanvasPrototypeRequest extends CanvasCommandContext {
  typeName: string;
  source: CanvasConnectionSource;
}
export interface CreateCanvasNodeRequest extends CanvasCommandContext {
  typeName: string;
  /** Center of the new node in graph coordinates. */
  position: { x: number; y: number };
  source?: CanvasConnectionSource;
  props?: Record<string, unknown>;
  edgeType?: string;
}
export interface CreatedCanvasNode {
  nodeId: string;
  edgeId?: string;
}
export interface ConnectCanvasNodesRequest extends CanvasCommandContext {
  source: CanvasConnectionSource;
  target: CanvasConnectionSource;
  edgeId?: string;
  edgeType?: string;
  props?: Record<string, unknown>;
  vertices?: Array<{ x: number; y: number }>;
}
export type CanvasPrototypeResult = ConnectionValidationResult;
