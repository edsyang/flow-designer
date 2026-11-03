import { Content } from "@flow-designer/model";
import type {
  ContentNode,
  NodeData,
  SerializedEdgeElement,
  SerializedRelation,
} from "@flow-designer/model";
import { ProcessRelation } from "./process-relation";
import type { IProcessContentData } from "./types";

export class ProcessContent extends Content<ProcessRelation> {
  static readonly compatibleType: string = "process";
  static readonly compatibleVersion: string = "~1.0.0";

  private pendingRelations: Map<string, SerializedRelation[]> = new Map();
  private serialIdCounter = 0;

  override applyTimelinePointData(data: IProcessContentData): void {
    super.applyTimelinePointData(data);
    this.getNodes().forEach((node) => {
      node.getRelation().resetFlowins();
    });
    this.getNodes().forEach((node) => {
      node.getRelation().didInit();
    });
  }

  nodesFromData(
    data: IProcessContentData,
    creator: (nodeData: NodeData) => ContentNode<ProcessRelation>,
  ): Array<ContentNode<ProcessRelation>> {
    if (!this.pendingRelations) {
      this.pendingRelations = new Map();
    }

    const allElements: any[] = data.elements || [];

    const nodeElements = allElements.filter((el: any) => !el.sourceRef);
    const edgeElements: SerializedEdgeElement[] = allElements.filter((el: any) => el.sourceRef);

    const relationsMap = new Map<string, SerializedRelation[]>();
    for (const edge of edgeElements) {
      const sourceId = edge.sourceRef;
      if (!relationsMap.has(sourceId)) {
        relationsMap.set(sourceId, []);
      }
      relationsMap.get(sourceId)!.push({
        id: edge.id,
        targetNodeId: edge.targetRef,
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
        type: edge.typeName,
        props: edge.props,
        vertices: edge.vertices,
      });
    }

    return nodeElements.map((el: any) => {
      const edges = relationsMap.get(el.id);
      if (edges) {
        this.pendingRelations.set(el.id, edges);
      }
      const nodeProps = el.position ? { ...el.props, __position: el.position } : el.props;
      return creator({
        id: el.id,
        type: el.typeName || el.type,
        props: nodeProps,
      });
    });
  }

  getData(): IProcessContentData {
    const nodeElements: any[] = [];
    const edgeElements: SerializedEdgeElement[] = [];

    for (const node of this.getNodes()) {
      const props = node.getProps().getData();
      if (props && typeof props === "object") {
        delete props.__position;
      }
      nodeElements.push({
        id: node.getId(),
        typeName: node.getTypeName(),
        props,
        position: node.getPosition(),
      });

      for (const edge of node.getRelation().serialize()) {
        const edgeEl: SerializedEdgeElement = {
          id: edge.id,
          typeName: edge.type || "SequenceFlow",
          sourceRef: node.getId(),
          targetRef: edge.targetNodeId,
        };
        if (edge.sourcePort) edgeEl.sourcePort = edge.sourcePort;
        if (edge.targetPort) edgeEl.targetPort = edge.targetPort;
        if (edge.props && Object.keys(edge.props).length > 0) edgeEl.props = edge.props;
        if (edge.vertices && edge.vertices.length > 0) edgeEl.vertices = edge.vertices;
        edgeElements.push(edgeEl);
      }
    }

    return {
      elements: [...nodeElements, ...edgeElements],
    };
  }

  createRelation(node: ContentNode<ProcessRelation>): ProcessRelation {
    const edges = this.pendingRelations.get(node.getId()) || [];
    this.pendingRelations.delete(node.getId());
    return new ProcessRelation(this, node, edges);
  }

  protected override onNodeTimelineRestore(node: ContentNode<ProcessRelation>): void {
    const edges = this.pendingRelations.get(node.getId()) || [];
    this.pendingRelations.delete(node.getId());
    node.getRelation().setEdges(edges);
  }

  getSerialId(namespace: string, value?: string | null, forceGenerator: boolean = false): string {
    const sidHeap = this.getNodes()
      .map((node) => node.getProps().getPropData("sid"))
      .filter((sid) => sid != null);

    if (value != null) {
      if (sidHeap.indexOf(value) > -1) {
        if (!forceGenerator) {
          return value;
        }
      } else {
        return value;
      }
    }

    let result: string;
    do {
      this.serialIdCounter++;
      result = `${namespace}-${this.serialIdCounter}`;
    } while (sidHeap.indexOf(result) > -1);

    return result;
  }

  getNodeBySerialId(serialId: string): ContentNode<ProcessRelation> | null {
    if (!serialId) return null;
    return this.getNodes().find((node) => node.getProps().getPropData("sid") === serialId) || null;
  }
}
