import type { NodeMeta, NodeView, PortDefinition } from "@flow-designer/model";
import type { EdgeTypeConfig } from "./contracts";
/** Definitions survive graph disposal so the manager can initialize another viewport. */
export class GraphTypeRegistry {
  private nodeTypes = new Map<string, { meta: NodeMeta; view: NodeView }>();
  private edgeTypes = new Map<string, EdgeTypeConfig>();
  private portsByType = new Map<string, PortDefinition[]>();
  get nodes(): ReadonlyMap<string, { meta: NodeMeta; view: NodeView }> {
    return this.nodeTypes;
  }
  get edges(): ReadonlyMap<string, EdgeTypeConfig> {
    return this.edgeTypes;
  }
  get ports(): ReadonlyMap<string, PortDefinition[]> {
    return this.portsByType;
  }
  registerNodeType(meta: NodeMeta, view: NodeView): void {
    for (const [registeredName, entry] of this.nodeTypes) {
      if (entry.meta.typeName === meta.typeName && registeredName !== meta.name) {
        this.nodeTypes.delete(registeredName);
        this.portsByType.delete(registeredName);
      }
    }
    this.nodeTypes.set(meta.name, { meta, view });
    if (view.ports?.length) {
      this.portsByType.set(meta.name, view.ports);
    }
  }
  registerEdgeType(name: string, config: EdgeTypeConfig): void {
    this.edgeTypes.set(name, config);
  }
}
