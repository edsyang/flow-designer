import { selectRoutePlan, type RoutePlan, type RoutePolicy } from "./route-plan";
import { DEFAULT_ROUTER } from "./graph-defaults";
import { DEFAULT_PORT_ITEMS } from "./shapes";
import type { Graph } from "@antv/x6";
import { type Cell, type Edge, type Node as X6Node } from "@antv/x6";
import { canUsePort } from "@flow-designer/model";
import type { PortDefinition } from "@flow-designer/model";
import type {
  ConnectionContext,
  ConnectionCheckOptions,
  ConnectionValidationResult,
  ConnectionRejectedEvent,
  ResolvedConnection,
} from "@flow-designer/core";
import type { GraphOptions, EdgeTypeConfig } from "./contracts";
import { normalizeOrthogonalVertices } from "./edge-geometry";
import { strictOrthogonalFallback, geometrySceneFor } from "./edge-routing";
const DIR_VECTORS: Record<string, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  bottom: { x: 0, y: 1 },
  top: { x: 0, y: -1 },
};

/** Coordinates connection policy and routing projection without owning model history. */
export class ConnectionCoordinator {
  connectionRules = { allowLoop: false, allowMulti: true };
  connectionValidator: NonNullable<GraphOptions["connecting"]>["connectionValidator"];
  private rejectedAttempts = new WeakMap<Edge, ConnectionRejectedEvent>();
  constructor(
    private currentGraph: () => Graph | null,
    private nodeTypeByCellId: ReadonlyMap<string, string>,
    private portsByType: ReadonlyMap<string, PortDefinition[]>,
    private edgeTypeByCellId: ReadonlyMap<string, string>,
    private edgeTypes: ReadonlyMap<string, EdgeTypeConfig>,
  ) {}
  private get graph(): Graph | null {
    return this.currentGraph();
  }
  private assertGraph(): Graph {
    const graph = this.graph;
    if (!graph) throw new Error("GraphManager has not been initialized. Call init() first.");
    return graph;
  }
  autoSwitchEdgePorts(
    edge: any,
    preserveSource = false,
    preserveTarget = false,
    directionalOnly = false,
  ): void {
    const sourceCell = edge.getSourceCell() as X6Node | null;
    const targetCell = edge.getTargetCell() as X6Node | null;
    if (!sourceCell || !targetCell) return;
    if (directionalOnly) {
      this.selectDirectionalPorts(edge, true);
      return;
    }
    const sBBox = sourceCell.getBBox();
    const tBBox = targetCell.getBBox();
    const sc = { x: sBBox.x + sBBox.width / 2, y: sBBox.y + sBBox.height / 2 };
    const tc = { x: tBBox.x + tBBox.width / 2, y: tBBox.y + tBBox.height / 2 };
    const dx = tc.x - sc.x;
    const dy = tc.y - sc.y;

    const sourceType = this.nodeTypeByCellId.get(sourceCell.id);
    const targetType = this.nodeTypeByCellId.get(targetCell.id);
    const sourcePorts = sourceType ? this.portsByType.get(sourceType) : undefined;
    const targetPorts = targetType ? this.portsByType.get(targetType) : undefined;

    let sourceDir: string | null = null;
    if (sourcePorts) {
      const outPorts = sourcePorts.filter((p) => canUsePort(p, "source"));
      const best = this.pickBestPort(outPorts, dx, dy);
      if (best) {
        sourceDir = preserveSource ? this.getPortDirectionFromDef(edge, "source") : best.position;
        const portId = best.id ?? `${best.group}-${best.position}`;
        if (!preserveSource && edge.getSourcePortId() !== portId) {
          edge.setSource({ cell: sourceCell.id, port: portId });
        }
      }
    }
    if (targetPorts) {
      const inPorts = targetPorts.filter((p) => canUsePort(p, "target"));
      let tdx = -dx;
      let tdy = -dy;
      if (sourceDir) {
        const opposite: Record<string, string> = {
          bottom: "top",
          top: "bottom",
          right: "left",
          left: "right",
        };
        const preferred = opposite[sourceDir];
        if (preferred) {
          const v = DIR_VECTORS[preferred];
          if (v) {
            tdx = v.x;
            tdy = v.y;
          }
        }
      }
      const best = this.pickBestPort(inPorts, tdx, tdy);
      if (best) {
        const portId = best.id ?? `${best.group}-${best.position}`;
        if (!preserveTarget && edge.getTargetPortId() !== portId) {
          edge.setTarget({ cell: targetCell.id, port: portId });
        }
      }
    }
  }

  tryAlternativeDirectionalPorts(edge: Edge): boolean {
    return this.selectDirectionalPorts(edge, false);
  }

  selectDirectionalPorts(edge: Edge, geometryFirst: boolean): boolean {
    const source = edge.getSourceCell();
    const target = edge.getTargetCell();
    if (!source?.isNode() || !target?.isNode()) return false;
    const sc = source.getBBox().getCenter(),
      tc = target.getBBox().getCenter();
    const dx = tc.x - sc.x,
      dy = tc.y - sc.y;
    const choices = (node: X6Node, portId: string | undefined, terminal: "source" | "target") => {
      const current = portId ? this.getPortDefinition(node.id, portId) : null;
      if (!current || current.id || current.label || current.dataType)
        return portId ? [portId] : [];
      const type = this.nodeTypeByCellId.get(node.id);
      const definitions = type ? this.portsByType.get(type) : undefined;
      return [
        ...new Set([
          ...(portId ? [portId] : []),
          ...(definitions ?? [])
            .filter((p) => !p.id && !p.label && !p.dataType && canUsePort(p, terminal))
            .map((p) => `${p.group}-${p.position}`),
        ]),
      ];
    };
    const score = (node: X6Node, id: string, sign: number) => {
      const port = this.getPortDefinition(node.id, id);
      const v = port ? DIR_VECTORS[port.position] : null;
      return v ? (v.x * dx + v.y * dy) * sign : 0;
    };
    const pairs = choices(source, edge.getSourcePortId(), "source").flatMap((sp) =>
      choices(target, edge.getTargetPortId(), "target").map((tp) => ({
        sp,
        tp,
        current: sp === edge.getSourcePortId() && tp === edge.getTargetPortId(),
        score: score(source, sp, 1) + score(target, tp, -1),
      })),
    );
    pairs.sort(
      (a, b) => (geometryFirst ? 0 : Number(b.current) - Number(a.current)) || b.score - a.score,
    );
    const sourceId = source.id,
      targetId = target.id;
    const admitted = function* (this: ConnectionCoordinator) {
      for (const { sp, tp } of pairs) {
        const context: ConnectionContext = {
          sourceNode: sourceId,
          targetNode: targetId,
          sourcePort: this.getPortDefinition(sourceId, sp),
          targetPort: this.getPortDefinition(targetId, tp),
        };
        if (
          (!this.connectionValidator || this.connectionValidator(context)) &&
          this.hasShortConnectionRoute(context, edge.id)
        ) {
          const plan = this.connectionRoutePlan(
            context,
            edge.id,
            [],
            geometryFirst ? "move-geometry" : "move-current",
          );
          if (plan) yield { plan, sourcePriority: 0 };
        }
      }
    };
    const winner = selectRoutePlan(admitted.call(this), "ordered-first-valid");
    if (!winner) return false;
    const sp = winner.source.portId,
      tp = winner.target.portId;
    if (sp && edge.getSourcePortId() !== sp) edge.setSource({ cell: source.id, port: sp });
    if (tp && edge.getTargetPortId() !== tp) edge.setTarget({ cell: target.id, port: tp });
    this.updateRouterDirections(edge);
    this.updateConnectorDirections(edge);
    return true;
  }

  pickBestPort(ports: PortDefinition[], dx: number, dy: number): PortDefinition | null {
    if (!ports.length) return null;
    const dirVectors: Record<string, { x: number; y: number }> = {
      top: { x: 0, y: -1 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    let best: PortDefinition | null = null;
    let bestScore = -Infinity;
    for (const port of ports) {
      const v = dirVectors[port.position];
      if (!v) continue;
      const score = ndx * v.x + ndy * v.y;
      if (score > bestScore) {
        bestScore = score;
        best = port;
      }
    }
    return best;
  }

  updateRouterDirections(edge: any): void {
    const sourcePortId: string | null = edge.getSourcePortId?.() ?? null;
    const targetPortId: string | null = edge.getTargetPortId?.() ?? null;
    const sourceDir =
      this.getPortDirectionFromDef(edge, "source") ?? this.getPortDirection(sourcePortId);
    const targetDir =
      this.getPortDirectionFromDef(edge, "target") ?? this.getPortDirection(targetPortId);

    const edgeType = this.edgeTypeByCellId.get(edge.id);
    const typeConfig = edgeType ? this.edgeTypes.get(edgeType) : undefined;
    if (typeConfig?.router === null) {
      edge.removeRouter();
      return;
    }
    const baseRouter = typeConfig?.router ?? DEFAULT_ROUTER;
    const routerName = typeof baseRouter === "string" ? baseRouter : baseRouter.name;
    const baseArgs = typeof baseRouter === "string" ? {} : (baseRouter.args ?? {});

    if (routerName === "manhattan" || routerName === "orth") {
      const args: Record<string, unknown> = {
        ...baseArgs,
        perpendicular: false,
        fallbackRouter: strictOrthogonalFallback,
      };
      if (sourceDir) {
        args.startDirections = [sourceDir];
      }
      if (targetDir) {
        args.endDirections = [targetDir];
      }
      edge.setRouter({ name: "flow-orthogonal", args });
    } else if (routerName === "er") {
      const isHorizontal =
        sourceDir === "left" ||
        sourceDir === "right" ||
        targetDir === "left" ||
        targetDir === "right";
      edge.setRouter({
        name: "er",
        args: {
          ...baseArgs,
          direction: isHorizontal ? "H" : "V",
        },
      });
    } else {
      edge.setRouter({
        name: routerName,
        args: {
          ...baseArgs,
          startDirections: sourceDir ? [sourceDir] : ["top", "right", "bottom", "left"],
          endDirections: targetDir ? [targetDir] : ["top", "right", "bottom", "left"],
        },
      });
    }
  }

  getPortDirection(portId: string | null): string | null {
    if (!portId) return null;
    const parts = portId.split("-");
    const direction = parts[parts.length - 1];
    if (direction && ["top", "right", "bottom", "left"].includes(direction)) {
      return direction;
    }
    return null;
  }

  getPortDirectionFromDef(edge: any, which: "source" | "target"): string | null {
    const cell = which === "source" ? edge.getSourceCell() : edge.getTargetCell();
    const portId = which === "source" ? edge.getSourcePortId?.() : edge.getTargetPortId?.();
    if (!cell || !portId) return null;
    const nodeType = this.nodeTypeByCellId.get(cell.id);
    if (!nodeType) return null;
    const ports = this.portsByType.get(nodeType);
    if (!ports) return null;
    const portDef = ports.find((p) => p.id === portId || `${p.group}-${p.position}` === portId);
    return portDef?.position ?? null;
  }

  updateConnectorDirections(edge: any): void {
    const edgeType = this.edgeTypeByCellId.get(edge.id);
    const typeConfig = edgeType ? this.edgeTypes.get(edgeType) : undefined;
    if (!typeConfig?.connector) return;
    const connector = typeConfig.connector;
    const name = typeof connector === "string" ? connector : connector.name;
    if (name !== "port-curve") {
      edge.setConnector(
        name === "normal" && edge.getRouter()?.name === "flow-orthogonal"
          ? { name: "flow-normal", args: typeof connector === "string" ? {} : connector.args }
          : connector,
      );
      return;
    }

    const srcDir =
      this.getPortDirectionFromDef(edge, "source") ??
      this.getPortDirection(edge.getSourcePortId?.());
    const tgtDir =
      this.getPortDirectionFromDef(edge, "target") ??
      this.getPortDirection(edge.getTargetPortId?.());

    edge.setConnector({
      name: "port-curve",
      args: {
        ...(typeof connector === "string" ? {} : connector.args),
        sourceDir: srcDir,
        targetDir: tgtDir,
      },
    });
  }

  enforceOrthogonalVertices(edge: any): void {
    const source = edge.getSourcePoint();
    const target = edge.getTargetPoint();
    if (!source || !target) return;
    const sourceDir =
      this.getPortDirectionFromDef(edge, "source") ??
      this.getPortDirection(edge.getSourcePortId?.() ?? null);
    const targetDir =
      this.getPortDirectionFromDef(edge, "target") ??
      this.getPortDirection(edge.getTargetPortId?.() ?? null);
    edge.setVertices(
      normalizeOrthogonalVertices(edge.getVertices() ?? [], source, target, sourceDir, targetDir),
      { silent: true },
    );
  }

  checkConnection(context: ConnectionContext): boolean {
    return this.evaluateConnection(context).valid;
  }

  evaluateConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ConnectionValidationResult {
    return this.evaluateConnectionRules(context, options, true);
  }

  resolveConnection(
    context: ConnectionContext,
    options: ConnectionCheckOptions = {},
  ): ResolvedConnection {
    const initial = this.evaluateConnection(context, options);
    const id = (port: PortDefinition | null) =>
      port ? (port.id ?? `${port.group}-${port.position}`) : undefined;
    const result = (candidate: ConnectionContext): ResolvedConnection => ({
      valid: true,
      sourcePortId: id(candidate.sourcePort),
      targetPortId: id(candidate.targetPort),
    });
    if (initial.valid) return { ...initial, ...result(context) };
    if (options.phase === "candidate" || initial.reason !== "workbench.connection.routeUnavailable")
      return initial;
    const choices = (
      nodeId: string,
      current: PortDefinition | null,
      terminal: "source" | "target",
    ) => {
      if (!current || current.id || current.label || current.dataType)
        return current ? [current] : [];
      const type = this.nodeTypeByCellId.get(nodeId);
      const definitions = type ? this.portsByType.get(type) : undefined;
      return [
        current,
        ...(definitions ?? []).filter(
          (p) =>
            id(p) !== id(current) && !p.id && !p.label && !p.dataType && canUsePort(p, terminal),
        ),
      ];
    };
    const candidates: Array<{ plan: RoutePlan; sourcePriority: number }> = [];
    for (const sourcePort of choices(context.sourceNode, context.sourcePort, "source"))
      for (const targetPort of choices(context.targetNode, context.targetPort, "target")) {
        const candidate = { ...context, sourcePort, targetPort };
        if (!this.evaluateConnection(candidate, options).valid) continue;
        const plan = this.connectionRoutePlan(
          candidate,
          options.edgeId,
          [],
          "drop-source-priority",
        );
        if (!plan) continue;
        candidates.push({
          plan,
          sourcePriority: id(sourcePort) === id(context.sourcePort) ? 0 : 1,
        });
      }
    const best = selectRoutePlan(candidates, "source-priority-cost");
    return best
      ? { valid: true, sourcePortId: best.source.portId, targetPortId: best.target.portId }
      : initial;
  }

  evaluateConnectionRules(
    context: ConnectionContext,
    options: ConnectionCheckOptions,
    checkRoute: boolean,
  ): ConnectionValidationResult {
    const reject = (
      reason: NonNullable<ConnectionValidationResult["reason"]>,
    ): ConnectionValidationResult => ({ valid: false, reason });
    if (!context.sourcePort) return reject("workbench.connection.sourcePortRequired");
    if (!canUsePort(context.sourcePort, "source"))
      return reject("workbench.connection.sourceCannotConnect");
    if (!context.targetPort) return reject("workbench.connection.targetPortRequired");
    if (!canUsePort(context.targetPort, "target"))
      return reject("workbench.connection.targetCannotReceive");
    // A prototype is not an instance. Never pass an empty target ID to an instance validator.
    if (options.phase === "candidate") {
      if (
        this.connectionValidator?.validatePorts &&
        !this.connectionValidator.validatePorts(context)
      )
        return reject("workbench.connection.incompatible");
      return { valid: true, deferred: true };
    }
    const graph = this.graph;
    const sourceCell = graph?.getCellById(context.sourceNode) as Cell | null | undefined;
    const targetCell = graph?.getCellById(context.targetNode) as Cell | null | undefined;
    if (!graph || !sourceCell?.isNode() || !targetCell?.isNode())
      return reject("workbench.connection.endpointMissing");
    const sourcePortId =
      context.sourcePort.id ?? `${context.sourcePort.group}-${context.sourcePort.position}`;
    const targetPortId =
      context.targetPort.id ?? `${context.targetPort.group}-${context.targetPort.position}`;
    if (!sourceCell.hasPort(sourcePortId)) return reject("workbench.connection.sourcePortRequired");
    if (!targetCell.hasPort(targetPortId)) return reject("workbench.connection.targetPortRequired");
    if (!this.connectionRules.allowLoop && context.sourceNode === context.targetNode)
      return reject("workbench.connection.loopNotAllowed");
    if (
      !this.connectionRules.allowMulti &&
      graph
        .getEdges()
        .some(
          (edge) =>
            edge.id !== options.edgeId &&
            edge.getSourceCellId() === context.sourceNode &&
            edge.getTargetCellId() === context.targetNode,
        )
    )
      return reject("workbench.connection.duplicateNotAllowed");
    if (this.connectionValidator && !this.connectionValidator(context))
      return reject("workbench.connection.incompatible");
    if (checkRoute && !this.hasShortConnectionRoute(context, options.edgeId))
      return reject("workbench.connection.routeUnavailable");
    return { valid: true };
  }

  hasShortConnectionRoute(
    context: ConnectionContext,
    edgeId?: string,
    vertices: Array<{ x: number; y: number }> = [],
    score?: { value: number },
  ): boolean {
    this.assertGraph();
    const type = (edgeId ? this.edgeTypeByCellId.get(edgeId) : null) ?? this.getDefaultEdgeType();
    if (!type) return true;
    const plan = this.connectionRoutePlan(context, edgeId, vertices);
    if (score) score.value = plan?.cost ?? Infinity;
    return plan?.status === "valid";
  }

  connectionRoutePlan(
    context: ConnectionContext,
    edgeId?: string,
    vertices: Array<{ x: number; y: number }> = [],
    policy: RoutePolicy = "explicit",
  ): RoutePlan | null {
    const graph = this.assertGraph();
    const type = (edgeId ? this.edgeTypeByCellId.get(edgeId) : null) ?? this.getDefaultEdgeType();
    const curved = !!type && this.edgeTypes.get(type)?.router === null;
    const scene = geometrySceneFor(graph);
    const endpoint = (id: string, port: PortDefinition | null) => {
      if (!port) return null;
      const portId = port.id ?? `${port.group}-${port.position}`;
      return scene.endpoint(JSON.stringify([id, portId, port.position]), () => {
        const node = graph.getCellById(id) as Cell | null | undefined;
        if (!node?.isNode()) return null;
        const actual = node.getPort(portId);
        if (!actual?.group) return null;
        const local = node.getPortsPosition(actual.group)[portId]?.position;
        if (!local) return null;
        const origin = node.position();
        return {
          nodeId: id,
          portId,
          point: { x: origin.x + local.x, y: origin.y + local.y },
          side: port.position,
        };
      });
    };
    const source = endpoint(context.sourceNode, context.sourcePort),
      target = endpoint(context.targetNode, context.targetPort);
    if (!source || !target) return null;

    return scene.plan({ source, target, mode: curved ? "curve" : "orthogonal", vertices, policy });
  }

  connectionContext(edge: Edge): ConnectionContext {
    const sourceNode = edge.getSourceCellId();
    const targetNode = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();
    return {
      sourceNode,
      targetNode,
      sourcePort: sourcePortId ? this.getPortDefinition(sourceNode, sourcePortId) : null,
      targetPort: targetPortId ? this.getPortDefinition(targetNode, targetPortId) : null,
    };
  }

  reportConnectionRejection(
    edge: Edge,
    result: ConnectionValidationResult,
    context: Pick<ConnectionContext, "sourceNode" | "targetNode"> = this.connectionContext(edge),
  ): false {
    this.rejectedAttempts.delete(edge);
    void this.graph?.trigger("connection:rejected", {
      ...result,
      sourceNode: context.sourceNode,
      targetNode: context.targetNode,
    } satisfies ConnectionRejectedEvent);
    return false;
  }

  validateDroppedConnection(
    edge: Edge,
    terminal: "source" | "target",
    previous: Edge.TerminalData,
  ): boolean {
    const context = this.connectionContext(edge);
    if (context.sourceNode && context.targetNode) {
      const result = this.resolveConnection(context, { edgeId: edge.id });
      if (!result.valid) return this.reportConnectionRejection(edge, result, context);
      if (result.sourcePortId && result.sourcePortId !== edge.getSourcePortId())
        edge.setSource({ cell: context.sourceNode, port: result.sourcePortId });
      if (result.targetPortId && result.targetPortId !== edge.getTargetPortId())
        edge.setTarget({ cell: context.targetNode, port: result.targetPortId });
      this.updateRouterDirections(edge);
      this.updateConnectorDirections(edge);
      return true;
    }
    // Detaching a saved relation must revert its old terminal, never leave graph/model split.
    if (typeof previous === "object" && "cell" in previous && previous.cell)
      return this.reportConnectionRejection(edge, {
        valid: false,
        reason: "workbench.connection.endpointMissing",
      });
    if (terminal === "source" || !context.sourceNode)
      return this.reportConnectionRejection(edge, {
        valid: false,
        reason: "workbench.connection.sourcePortRequired",
      });
    const point = edge.getTargetPoint();
    const rejected = this.rejectedAttempts.get(edge);
    const rejectedNode = rejected?.targetNode ? this.graph?.getCellById(rejected.targetNode) : null;
    if (
      rejected &&
      rejectedNode?.isNode() &&
      rejectedNode.getBBox().inflate(12).containsPoint(point)
    )
      return this.reportConnectionRejection(edge, rejected, rejected);
    // Dropping on a body without a usable port is not a blank-canvas create gesture.
    const hit = this.graph?.getNodes().find((node) => node.getBBox().containsPoint(point));
    if (hit)
      return this.reportConnectionRejection(
        edge,
        { valid: false, reason: "workbench.connection.targetPortRequired" },
        { ...context, targetNode: hit.id },
      );
    return true;
  }

  validateConnection(args: {
    edge?: Edge | null;
    sourceCell?: Cell | null;
    targetCell?: Cell | null;
    sourcePort?: string | null;
    targetPort?: string | null;
  }): boolean {
    // A new blank drop stays reachable even for an incoming-only source so the
    // picker can explain why no target is offered. No persistent relation is made.
    if (!args.targetCell) return true;
    const sourceNode = args.sourceCell?.id ?? "";
    const targetNode = args.targetCell.id;
    const context: ConnectionContext = {
      sourceNode,
      targetNode,
      sourcePort: args.sourcePort ? this.getPortDefinition(sourceNode, args.sourcePort) : null,
      targetPort: args.targetPort ? this.getPortDefinition(targetNode, args.targetPort) : null,
    };
    const result = this.evaluateConnectionRules(context, { edgeId: args.edge?.id }, false);
    if (args.edge) {
      if (result.valid) this.rejectedAttempts.delete(args.edge);
      else this.rejectedAttempts.set(args.edge, { ...result, sourceNode, targetNode });
    }
    return result.valid;
  }
  getPortDefinition(nodeId: string, portId: string): PortDefinition | null {
    const typeName = this.nodeTypeByCellId.get(nodeId);
    if (!typeName) return null;
    const ports = this.portsByType.get(typeName);
    if (!ports) {
      const node = this.graph?.getCellById(nodeId);
      const fallback = DEFAULT_PORT_ITEMS.find((port) => port.id === portId);
      if (node?.isNode() && fallback && node.hasPort(portId))
        return {
          id: portId,
          group: fallback.group,
          position: portId as PortDefinition["position"],
        };
      return null;
    }
    const byId = ports.find((port) => (port.id ?? `${port.group}-${port.position}`) === portId);
    if (byId) return byId;
    return ports.find((port) => port.position === portId) ?? null;
  }
  getDefaultEdgeType(): string | null {
    const first = this.edgeTypes.keys().next();
    return first.done ? null : first.value;
  }
}
