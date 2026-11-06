import type { CommandRegistry } from "@flow-designer/core";
import { commandRegistry, CANVAS_COMMANDS } from "@flow-designer/core";
import { canUsePort } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import type { ContentNode, Document, GenericRelation, PortDefinition } from "@flow-designer/model";
import type {
  CanvasPrototypeRequest,
  CanvasPrototypeResult,
  ConnectCanvasNodesRequest,
  CreateCanvasNodeRequest,
  CreatedCanvasNode,
  ConnectionRejectionReason,
  ConnectionContext,
  ResolvedConnection,
} from "@flow-designer/core";
import { edgeDefaultProps } from "./edge-properties";

export class CanvasConnectionError extends Error {
  constructor(readonly reason: ConnectionRejectionReason) {
    super(t(reason));
  }
}
let sequence = 0;
const queues = new WeakMap<Document, Promise<unknown>>();
function enqueue<T>(document: Document, operation: () => Promise<T>): Promise<T> {
  const run = () => {
    if (document.isDisposed()) throw new Error("Document has been destroyed");
    return operation();
  };
  const result = (queues.get(document) ?? Promise.resolve()).then(run, run);
  queues.set(
    document,
    result.catch(() => undefined),
  );
  return result;
}
function portId(port: PortDefinition): string {
  return port.id ?? `${port.group}-${port.position}`;
}
function relation(node: ContentNode): GenericRelation {
  return node.getRelation() as GenericRelation;
}
function freshEdgeId(document: Document): string {
  let id: string;
  do {
    id = `edge-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  } while (
    document
      .getContent()
      .getNodes()
      .some((node) => relation(node).getEdgeById(id))
  );
  return id;
}

export function evaluateCanvasPrototype(request: CanvasPrototypeRequest): CanvasPrototypeResult {
  const prototype = request.document
    .getRegistries()
    .prototypes.getPrototypeByType(request.typeName);
  const sourcePort = request.source.portId
    ? request.graph.getPortDefinition(request.source.nodeId, request.source.portId)
    : null;
  let result: CanvasPrototypeResult = {
    valid: false,
    reason: "workbench.connection.targetPortRequired",
  };
  for (const port of prototype?.getView().ports ?? []) {
    if (!canUsePort(port, "target")) continue;
    result = request.graph.evaluateConnection(
      { sourceNode: request.source.nodeId, sourcePort, targetNode: "", targetPort: port },
      { phase: "candidate" },
    );
    if (result.valid) return result;
  }
  return result;
}

function resolveCanvasPorts(request: ConnectCanvasNodesRequest): ResolvedConnection {
  const { graph, source, target } = request;
  const context: ConnectionContext = {
    sourceNode: source.nodeId,
    sourcePort: source.portId ? graph.getPortDefinition(source.nodeId, source.portId) : null,
    targetNode: target.nodeId,
    targetPort: target.portId ? graph.getPortDefinition(target.nodeId, target.portId) : null,
  };
  const options = {
    phase: "commit" as const,
    ...(request.edgeId ? { edgeId: request.edgeId } : {}),
  };
  const specified = graph.evaluateConnection(context, options);
  if (specified.valid)
    return {
      ...specified,
      sourcePortId: source.portId ?? undefined,
      targetPortId: target.portId ?? undefined,
    };
  // Capability, semantic and structural rejections must never initiate route fallback.
  if (specified.reason !== "workbench.connection.routeUnavailable") return specified;
  const resolved = graph.resolveConnection(context, options);
  if (!resolved.valid) return resolved;
  const sourcePortId = resolved.sourcePortId ?? source.portId ?? undefined;
  const targetPortId = resolved.targetPortId ?? target.portId ?? undefined;
  const verified = graph.evaluateConnection(
    {
      sourceNode: source.nodeId,
      sourcePort: sourcePortId ? graph.getPortDefinition(source.nodeId, sourcePortId) : null,
      targetNode: target.nodeId,
      targetPort: targetPortId ? graph.getPortDefinition(target.nodeId, targetPortId) : null,
    },
    options,
  );
  return { ...verified, sourcePortId, targetPortId };
}

/** Validate actual endpoints immediately before mutation. The caller owns its transaction. */
export function commitCanvasConnection(request: ConnectCanvasNodesRequest): string {
  const { document, graph, source, target } = request;
  const sourceNode = document.getContent().getNode(source.nodeId);
  const targetNode = document.getContent().getNode(target.nodeId);
  if (!sourceNode || !targetNode)
    throw new CanvasConnectionError("workbench.connection.endpointMissing");
  const result = resolveCanvasPorts(request);
  if (!result.valid)
    throw new CanvasConnectionError(result.reason ?? "workbench.connection.incompatible");
  const edgeId = request.edgeId ?? freshEdgeId(document);
  if (
    document
      .getContent()
      .getNodes()
      .some((node) => relation(node).getEdgeById(edgeId))
  )
    throw new Error(`Edge already exists: ${edgeId}`);
  const type = request.edgeType ?? graph.getDefaultEdgeType() ?? undefined;
  const props = edgeDefaultProps(type ? graph.getEdgeTypeMetadata(type) : null, request.props);
  try {
    relation(sourceNode).addEdge({
      id: edgeId,
      targetNodeId: target.nodeId,
      sourcePort: result.sourcePortId,
      targetPort: result.targetPortId,
      type,
      props,
      vertices: request.vertices,
    });
  } catch (error) {
    relation(sourceNode).removeEdgeById(edgeId);
    throw error;
  }
  return edgeId;
}
export function connectCanvasNodes(request: ConnectCanvasNodesRequest): Promise<string> {
  return enqueue(request.document, () =>
    request.document.transaction("Create connection", () => commitCanvasConnection(request)),
  );
}
export function createCanvasNode(request: CreateCanvasNodeRequest): Promise<CreatedCanvasNode> {
  return enqueue(request.document, () =>
    request.document.transaction(t("workbench.canvas.connectNode"), async () => {
      const { document } = request;
      const prototype = request.document
        .getRegistries()
        .prototypes.getPrototypeByType(request.typeName);
      if (!prototype) throw new Error(t("workbench.canvas.addFailed", { name: request.typeName }));
      if (request.source) {
        const candidate = evaluateCanvasPrototype({ ...request, source: request.source });
        if (!candidate.valid)
          throw new Error(t(candidate.reason ?? "workbench.connection.incompatible"));
      }
      const id = document.getContent().generateNodeId();
      const size = prototype.getView().defaultSize ?? { width: 140, height: 40 };
      const allocation: { node: ContentNode | null } = { node: null };
      try {
        const created = await document.getContent().addNode(
          {
            id,
            type: request.typeName,
            props: {
              ...structuredClone(request.props ?? {}),
              __position: {
                x: request.position.x - size.width / 2,
                y: request.position.y - size.height / 2,
              },
            },
          },
          (node) => {
            allocation.node = node;
          },
        );
        if (!created)
          throw new Error(t("workbench.canvas.addFailed", { name: prototype.getName() }));
        if (created !== allocation.node || document.getContent().getNode(id) !== created)
          throw new CanvasConnectionError("workbench.connection.endpointMissing");
        let edgeId: string | undefined;
        const source = request.source;
        if (source) {
          let reason: ConnectionRejectionReason = "workbench.connection.targetPortRequired";
          let ports: { source: string | null; target: string } | null = null;
          for (const port of prototype.getView().ports ?? []) {
            if (!canUsePort(port, "target")) continue;
            const result = resolveCanvasPorts({
              ...request,
              source,
              target: { nodeId: created.getId(), portId: portId(port) },
            });
            reason = result.reason ?? "workbench.connection.incompatible";
            if (result.valid) {
              ports = {
                source: result.sourcePortId ?? source.portId,
                target: result.targetPortId ?? portId(port),
              };
              break;
            }
          }
          if (!ports) throw new CanvasConnectionError(reason);
          edgeId = commitCanvasConnection({
            ...request,
            source: { nodeId: source.nodeId, portId: ports.source },
            target: { nodeId: created.getId(), portId: ports.target },
          });
        }
        return { nodeId: created.getId(), ...(edgeId ? { edgeId } : {}) };
      } catch (error) {
        if (allocation.node) document.getContent().rollbackAddedNode(allocation.node);
        throw error;
      }
    }),
  );
}

/** Register against the owning editor; the optional legacy bus is for direct consumers only. */
export function registerCanvasCommands(registry: CommandRegistry = commandRegistry): () => void {
  const entries = [
    [CANVAS_COMMANDS.createNode, createCanvasNode],
    [CANVAS_COMMANDS.connectNodes, connectCanvasNodes],
    [CANVAS_COMMANDS.evaluatePrototype, evaluateCanvasPrototype],
  ] as const;
  const cleanups = entries.map(([name, command]) => registry.register(name, command));
  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}
