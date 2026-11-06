import type { CommandRegistry } from "@flow-designer/core";
import { CleanupError, CANVAS_COMMANDS } from "@flow-designer/core";
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
  GraphPort,
  GraphEdit,
  GraphEdgeSnapshot,
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
  for (const port of prototype?.getPorts() ?? []) {
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
type EdgeOwnership = ReturnType<GenericRelation["mutateOwnedEdge"]>;

export function commitCanvasConnection(
  request: ConnectCanvasNodesRequest,
  allocated?: (ownership: EdgeOwnership) => void,
): string {
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
  let ownership: EdgeOwnership | undefined;
  try {
    relation(sourceNode).mutateOwnedEdge(
      edgeId,
      {
        id: edgeId,
        targetNodeId: target.nodeId,
        sourcePort: result.sourcePortId,
        targetPort: result.targetPortId,
        type,
        props,
        vertices: request.vertices,
      },
      (handle) => {
        ownership = handle;
        allocated?.(handle);
      },
    );
    if (!allocated) ownership?.release();
  } catch (error) {
    ownership?.rollback();
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
  return enqueue(request.document, () => createNode(request));
}

function createNode(
  request: CreateCanvasNodeRequest,
  positionKind: "center" | "topLeft" = "center",
  isActive: () => boolean = () => true,
): Promise<CreatedCanvasNode> {
  return request.document.transaction(t("workbench.canvas.connectNode"), async () => {
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
    const size = prototype.getInitialSize();
    const allocation: { node: ContentNode | null } = { node: null };
    try {
      const created = await document.getContent().addNode(
        {
          id,
          type: request.typeName,
          props: {
            ...structuredClone(request.props ?? {}),
            __position: {
              x: request.position.x - (positionKind === "center" ? size.width / 2 : 0),
              y: request.position.y - (positionKind === "center" ? size.height / 2 : 0),
            },
          },
        },
        (node) => {
          allocation.node = node;
        },
      );
      if (!isActive()) throw new Error("Canvas editing has been disposed");
      if (!created) throw new Error(t("workbench.canvas.addFailed", { name: prototype.getName() }));
      if (created !== allocation.node || document.getContent().getNode(id) !== created)
        throw new CanvasConnectionError("workbench.connection.endpointMissing");
      let edgeId: string | undefined;
      const source = request.source;
      if (source) {
        let reason: ConnectionRejectionReason = "workbench.connection.targetPortRequired";
        let ports: { source: string | null; target: string } | null = null;
        for (const port of prototype.getPorts()) {
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
  });
}

/** Register against the owning editor. */
export function registerCanvasCommands(registry: CommandRegistry): () => void {
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

export interface CanvasGraphEditRequest {
  document: Document;
  graph: GraphPort;
  edit: GraphEdit;
  /** Synchronous projection echo scope; must never span lifecycle awaits. */
  mutate?: (operation: () => void, movedNodeIds: readonly string[]) => void;
  isActive?: () => boolean;
}

/** Single application editing entry point for detached, finalized graph gestures. */
export function applyCanvasGraphEdit(request: CanvasGraphEditRequest): Promise<void> {
  const { document, graph, edit } = request;
  return enqueue(document, async () => {
    const assertActive = () => {
      if (document.isDisposed() || request.isActive?.() === false)
        throw new Error("Canvas editing has been disposed");
    };
    assertActive();
    const mutate = (operation: () => void, ids: readonly string[] = []) => {
      assertActive();
      if (request.mutate) request.mutate(operation, ids);
      else operation();
    };
    if (edit.type === "node-dropped") {
      graph.removeCell(edit.temporaryNodeId);
      if (!edit.nodeType) return;
      const created = await createNode(
        { document, graph, typeName: edit.nodeType, position: edit.position },
        "topLeft",
        () => !document.isDisposed() && request.isActive?.() !== false,
      );
      assertActive();
      graph.select([created.nodeId]);
      document.getSelection().setKeys([created.nodeId]);
      return;
    }
    try {
      await document.transaction(
        edit.type === "node-moved" ? "Move nodes" : "Edit connection",
        () => {
          if (edit.type === "node-moved") {
            const nodes = edit.nodes ?? [{ nodeId: edit.nodeId, position: edit.position }];
            const positions = nodes.flatMap((item) => {
              const node = document.getContent().getNode(item.nodeId);
              return node ? [{ node, before: node.getPosition(), after: item.position }] : [];
            });
            const handles: EdgeOwnership[] = [];
            try {
              mutate(
                () => {
                  for (const item of positions) item.node.setPosition(item.after.x, item.after.y);
                  for (const edge of edit.edges) {
                    const owner = findEdgeOwner(document, edge.edgeId);
                    const before = owner?.getEdgeById(edge.edgeId);
                    if (owner && before)
                      owner.mutateOwnedEdge(
                        edge.edgeId,
                        { ...before, ...edgePatch(edge) },
                        (handle) => {
                          handles.push(handle);
                        },
                      );
                  }
                },
                positions
                  .filter(
                    (item) => item.before.x !== item.after.x || item.before.y !== item.after.y,
                  )
                  .map((item) => item.node.getId()),
              );
              for (const handle of handles) handle.release();
            } catch (error) {
              const errors: unknown[] = [error];
              mutate(() => {
                for (const handle of handles.reverse()) {
                  try {
                    handle.rollback();
                  } catch (failure) {
                    errors.push(failure);
                  }
                }
                for (const item of positions) {
                  if (document.getContent().getNode(item.node.getId()) !== item.node) continue;
                  const current = item.node.getPosition();
                  if (current.x !== item.after.x || current.y !== item.after.y) continue;
                  try {
                    item.node.setPosition(item.before.x, item.before.y);
                  } catch (failure) {
                    errors.push(failure);
                  }
                }
              });
              if (errors.length > 1) throw new CleanupError(errors);
              throw error;
            }
          } else if (edit.type === "edge-vertices-edited") {
            let ownership: EdgeOwnership | undefined;
            try {
              mutate(() => {
                const owner = findEdgeOwner(document, edit.edgeId);
                const before = owner?.getEdgeById(edit.edgeId);
                if (owner && before)
                  owner.mutateOwnedEdge(
                    edit.edgeId,
                    { ...before, vertices: edit.vertices.map((point) => ({ ...point })) },
                    (handle) => {
                      ownership = handle;
                    },
                  );
              });
              ownership?.release();
            } catch (error) {
              mutate(() => {
                ownership?.rollback();
              });
              throw error;
            }
          } else {
            applyConnectionSnapshot(document, graph, edit.edge, mutate);
          }
        },
      );
    } catch (error) {
      if (!document.isDisposed() && request.isActive?.() !== false) {
        try {
          restoreEditedProjection(document, graph, edit);
        } catch (failure) {
          throw new CleanupError([error, failure]);
        }
      }
      throw error;
    }
    assertActive();
    if (edit.type === "edge-connected") graph.select([edit.edge.edgeId]);
  });
}

function findEdgeOwner(document: Document, edgeId: string): GenericRelation | undefined {
  return document
    .getContent()
    .getNodes()
    .map((node) => relation(node))
    .find((item) => item.getEdgeById(edgeId));
}
function edgePatch(edge: GraphEdgeSnapshot) {
  return {
    targetNodeId: edge.targetNodeId,
    sourcePort: edge.sourcePortId,
    targetPort: edge.targetPortId,
    vertices: edge.vertices.map((point) => ({ ...point })),
  };
}
function applyConnectionSnapshot(
  document: Document,
  graph: GraphPort,
  edge: GraphEdgeSnapshot,
  mutate: (operation: () => void) => void,
): void {
  const previous = findEdgeOwner(document, edge.edgeId);
  const existing = previous?.getEdgeById(edge.edgeId);
  const targetOwner = document.getContent().getNode(edge.sourceNodeId)?.getRelation() as
    GenericRelation | undefined;
  if (!targetOwner || !document.getContent().getNode(edge.targetNodeId))
    throw new CanvasConnectionError("workbench.connection.endpointMissing");
  const connection: ConnectCanvasNodesRequest = {
    document,
    graph,
    edgeId: edge.edgeId,
    edgeType: edge.edgeType,
    source: { nodeId: edge.sourceNodeId, portId: edge.sourcePortId ?? null },
    target: { nodeId: edge.targetNodeId, portId: edge.targetPortId ?? null },
    vertices: edge.vertices.map((point) => ({ ...point })),
  };
  const resolution = resolveCanvasPorts(connection);
  if (!resolution.valid)
    throw new CanvasConnectionError(resolution.reason ?? "workbench.connection.incompatible");
  const finalEdge = {
    ...edge,
    sourcePortId: resolution.sourcePortId,
    targetPortId: resolution.targetPortId,
  };
  const owned: { added?: EdgeOwnership; removed?: EdgeOwnership } = {};
  try {
    mutate(() => {
      if (existing && previous) {
        if (previous !== targetOwner)
          previous.mutateOwnedEdge(edge.edgeId, null, (handle) => {
            owned.removed = handle;
          });
        targetOwner.mutateOwnedEdge(
          edge.edgeId,
          { ...existing, ...edgePatch(finalEdge) },
          (handle) => {
            owned.added = handle;
          },
        );
      } else {
        commitCanvasConnection(
          {
            ...connection,
            source: { ...connection.source, portId: resolution.sourcePortId ?? null },
            target: { ...connection.target, portId: resolution.targetPortId ?? null },
          },
          (handle) => {
            owned.added = handle;
          },
        );
      }
      const created = targetOwner.getEdgeById(edge.edgeId);
      graph.updateEdge({
        id: edge.edgeId,
        type: created?.type,
        source: finalEdge.sourcePortId
          ? { cell: edge.sourceNodeId, port: finalEdge.sourcePortId }
          : edge.sourceNodeId,
        target: finalEdge.targetPortId
          ? { cell: edge.targetNodeId, port: finalEdge.targetPortId }
          : edge.targetNodeId,
        vertices: finalEdge.vertices.map((point) => ({ ...point })),
        data: created?.props,
        labels: [],
      });
    });
    owned.added?.release();
    owned.removed?.release();
  } catch (error) {
    mutate(() => {
      // If the destination has been replaced externally, do not resurrect another owner.
      const restored = owned.added?.rollback();
      if (restored !== false) owned.removed?.rollback();
      else owned.removed?.release();
    });
    throw error;
  }
}

/** Re-project only affected IDs from current model state, including external replacements. */
function restoreEditedProjection(
  document: Document,
  graph: GraphPort,
  edit: Exclude<GraphEdit, { type: "node-dropped" }>,
): void {
  if (edit.type === "node-moved") {
    for (const item of edit.nodes ?? [{ nodeId: edit.nodeId, position: edit.position }]) {
      const node = document.getContent().getNode(item.nodeId);
      if (node) graph.patchNode({ nodeId: item.nodeId, position: node.getPosition() });
    }
  }
  const edgeIds =
    edit.type === "node-moved"
      ? edit.edges.map((edge) => edge.edgeId)
      : [edit.type === "edge-connected" ? edit.edge.edgeId : edit.edgeId];
  for (const edgeId of new Set(edgeIds)) {
    const owner = findEdgeOwner(document, edgeId);
    const edge = owner?.getEdgeById(edgeId);
    if (owner && edge) {
      graph.updateEdge({
        id: edgeId,
        type: edge.type,
        source: edge.sourcePort
          ? { cell: owner.getNode().getId(), port: edge.sourcePort }
          : owner.getNode().getId(),
        target: edge.targetPort
          ? { cell: edge.targetNodeId, port: edge.targetPort }
          : edge.targetNodeId,
        vertices: edge.vertices,
        data: edge.props,
        labels: [],
      });
    } else {
      graph.removeCell(edgeId);
      if (graph.getSelection().includes(edgeId))
        graph.select(
          document
            .getSelection()
            .getKeys()
            .filter((id) => id !== edgeId),
        );
    }
  }
}
