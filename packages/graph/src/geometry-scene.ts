import type { RoutingObstacle } from "./orthogonal-routing";
import {
  planRoute,
  type GeometrySnapshot,
  type RoutePlan,
  type RouteRequest,
  type RouteEndpoint,
} from "./route-plan";
/** One immutable scene version shared by admission, pointer previews and native render. */
export class GeometryScene {
  private mutableBoxes = new Map<string, RoutingObstacle>();
  get boxes(): ReadonlyMap<string, RoutingObstacle> {
    return this.mutableBoxes;
  }
  private revision = 0;
  private snapshotValue: GeometrySnapshot | null = null;
  private solverSnapshot: GeometrySnapshot | null = null;
  private plans = new Map<string, RoutePlan>();
  private renderedPlans = new Map<string, RoutePlan>();
  recordRendered(edgeId: string, plan: RoutePlan): void {
    this.renderedPlans.set(edgeId, plan);
  }
  getRendered(edgeId: string): RoutePlan | undefined {
    return this.renderedPlans.get(edgeId);
  }
  forgetEdge(edgeId: string): void {
    this.renderedPlans.delete(edgeId);
  }
  private endpoints = new Map<string, RouteEndpoint>();
  readonly metrics = { snapshotBuilds: 0, planHits: 0, planMisses: 0, endpointHits: 0 };
  invalidate(): void {
    this.revision += 1;
    this.snapshotValue = null;
    this.solverSnapshot = null;
    this.plans.clear();
    this.endpoints.clear();
  }
  update(id: string, box: RoutingObstacle): void {
    const old = this.boxes.get(id);
    if (
      old &&
      old.x === box.x &&
      old.y === box.y &&
      old.width === box.width &&
      old.height === box.height
    )
      return;
    this.mutableBoxes.set(id, Object.freeze({ ...box }));
    this.invalidate();
  }
  remove(id: string): void {
    if (this.mutableBoxes.delete(id)) this.invalidate();
  }
  snapshot(): GeometrySnapshot {
    if (!this.snapshotValue) {
      this.metrics.snapshotBuilds++;
      const obstacles = [...this.boxes.values()];
      const nodeIds = new Map([...this.boxes].map(([id, box]) => [box, id]));
      // Keep the solver array private and read-only: frozen arrays make V8 obstacle scans slow.
      // Both views share frozen boxes; only the public view needs a frozen array.
      this.solverSnapshot = { revision: this.revision, obstacles, nodeIds };
      this.snapshotValue = Object.freeze({
        revision: this.revision,
        obstacles: Object.freeze([...obstacles]),
        nodeIds,
      });
    }
    return this.snapshotValue;
  }
  endpoint(key: string, read: () => RouteEndpoint | null): RouteEndpoint | null {
    const cached = this.endpoints.get(key);
    if (cached) {
      this.metrics.endpointHits++;
      return cached;
    }
    const value = read();
    if (!value) return null;
    const snapshot = Object.freeze({ ...value, point: Object.freeze({ ...value.point }) });
    if (this.endpoints.size >= 4096) {
      const oldest = this.endpoints.keys().next().value;
      if (oldest !== undefined) this.endpoints.delete(oldest);
    }
    this.endpoints.set(key, snapshot);
    return snapshot;
  }
  plan(request: RouteRequest): RoutePlan {
    // Port selection policies remain explicit; identical solver inputs can reuse geometry safely.
    const solver = request.policy === "legacy-corridor" ? "legacy-corridor" : "strict";
    const key = JSON.stringify([
      this.revision,
      solver,
      request.mode,
      request.source,
      request.target,
      request.vertices,
      request.budget,
    ]);
    const cached = this.plans.get(key);
    if (cached) {
      this.metrics.planHits++;
      return cached;
    }
    this.metrics.planMisses++;
    const snapshot = this.snapshot();
    const result = planRoute(this.solverSnapshot ?? snapshot, request);
    if (this.plans.size >= 512) {
      const oldest = this.plans.keys().next().value;
      if (oldest !== undefined) this.plans.delete(oldest);
    }
    this.plans.set(key, result);
    return result;
  }
  dispose(): void {
    this.mutableBoxes.clear();
    this.renderedPlans.clear();
    this.invalidate();
  }
}
