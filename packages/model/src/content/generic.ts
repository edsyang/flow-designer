import Content from "./index";
import type { ContentData } from "./index";
import type ContentNode from "./node";
import type { NodeData } from "./node";
import { GenericRelation } from "./relation";
import type { SerializedRelation, SerializedEdgeElement } from "../types";

export default class GenericContent extends Content<GenericRelation> {
  static readonly compatibleType = "*";
  static readonly compatibleVersion = "*";

  private pendingRelations: Map<string, SerializedRelation[]> = new Map();

  nodesFromData(
    data: ContentData,
    creator: (nodeData: NodeData) => ContentNode<GenericRelation>,
  ): Array<ContentNode<GenericRelation>> {
    if (!this.pendingRelations) {
      this.pendingRelations = new Map();
    }
    const allElements: any[] = data.elements || data.nodes || [];

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

    return nodeElements.map((serialized: any) => {
      const edges = relationsMap.get(serialized.id) || [];
      this.pendingRelations.set(serialized.id, edges);
      const nodeProps = serialized.position
        ? { ...serialized.props, __position: serialized.position }
        : serialized.props;
      const node = creator({
        id: serialized.id,
        type: serialized.typeName,
        props: nodeProps,
      });
      if (serialized.id && this.pendingRelations.has(serialized.id)) {
        const pendingEdges = this.pendingRelations.get(serialized.id)!;
        this.pendingRelations.delete(serialized.id);
        node.getRelation().setEdges(pendingEdges);
      }
      return node;
    });
  }

  getData(): ContentData {
    const nodeElements: any[] = [];
    const edgeElements: SerializedEdgeElement[] = [];

    for (const node of this.getNodes()) {
      const rawProps = node.getProps().getData();
      const { __position, ...props } =
        rawProps && typeof rawProps === "object" ? rawProps : { __position: undefined };
      nodeElements.push({
        id: node.getId(),
        typeName: node.getTypeName(),
        props,
        position: node.getPosition(),
      });

      for (const edge of node.getRelation().serialize()) {
        const edgeEl: SerializedEdgeElement = {
          id: edge.id,
          typeName: edge.type || "Edge",
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

  createRelation(node: ContentNode<GenericRelation>): GenericRelation {
    const edges = this.pendingRelations.get(node.getId()) || [];
    this.pendingRelations.delete(node.getId());
    return new GenericRelation(this, node, edges);
  }
}
