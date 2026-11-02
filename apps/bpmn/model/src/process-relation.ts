import { GenericRelation, Content, ContentNode } from '@flow-designer/model';
import type { SerializedRelation } from '@flow-designer/model';

export class ProcessRelation extends GenericRelation {
  private flowins: string[] = [];
  private defaultFlowoutId: string | null = null;

  override addEdge(edge: SerializedRelation): void {
    if (this.getEdgeById(edge.id)) this.removeEdgeById(edge.id);
    super.addEdge(edge);
    const targetNode = this.getContent().getNode(edge.targetNodeId);
    if (targetNode) {
      (targetNode.getRelation() as ProcessRelation).addFlowin(this.getNode().getId());
    }
  }

  override removeEdge(targetNodeId: string): void {
    const removedEdges = this.getEdges().filter(e => e.targetNodeId === targetNodeId);
    super.removeEdge(targetNodeId);
    const targetNode = this.getContent().getNode(targetNodeId);
    if (targetNode) {
      (targetNode.getRelation() as ProcessRelation).removeFlowin(this.getNode().getId());
    }
    for (const edge of removedEdges) {
      if (edge.id === this.defaultFlowoutId) {
        this.defaultFlowoutId = null;
      }
    }
  }

  getFlowouts(): SerializedRelation[] {
    return this.getEdges();
  }

  getFlowins(): string[] {
    return [...this.flowins];
  }

  override removeEdgeById(edgeId: string): void {
    const edge = this.getEdgeById(edgeId);
    if (!edge) return;
    super.removeEdgeById(edgeId);
    if (!this.getEdges().some(item => item.targetNodeId === edge.targetNodeId)) {
      const target = this.getContent().getNode(edge.targetNodeId);
      (target?.getRelation() as ProcessRelation | undefined)?.removeFlowin(this.getNode().getId());
    }
    if (this.defaultFlowoutId === edgeId) this.defaultFlowoutId = null;
  }

  override setEdges(edges: SerializedRelation[]): void {
    const previous = this.getEdges();
    super.setEdges(edges);
    for (const edge of previous) {
      if (!edges.some(item => item.targetNodeId === edge.targetNodeId)) {
        const target = this.getContent().getNode(edge.targetNodeId);
        (target?.getRelation() as ProcessRelation | undefined)?.removeFlowin(this.getNode().getId());
      }
    }
    this.didInit();
  }

  resetFlowins(): void { this.flowins = []; }

  addFlowin(sourceNodeId: string): void {
    if (this.flowins.indexOf(sourceNodeId) < 0) {
      this.flowins.push(sourceNodeId);
      this.emitFlowinChange();
    }
  }

  removeFlowin(sourceNodeId: string): void {
    const i = this.flowins.indexOf(sourceNodeId);
    if (i > -1) {
      this.flowins.splice(i, 1);
      this.emitFlowinChange();
    }
  }

  getDefaultFlowout(): string | null {
    return this.defaultFlowoutId;
  }

  setDefaultFlowout(edgeId: string | null): void {
    this.defaultFlowoutId = edgeId;
  }

  onFlowoutChange(fn: () => void): () => void {
    return this.onChange(fn);
  }

  onFlowinChange(fn: () => void): () => void {
    (this as any).emitter.on('flowinchange', fn);
    return () => {
      (this as any).emitter.removeListener('flowinchange', fn);
    };
  }

  private emitFlowinChange(): void {
    (this as any).emitter.emit('flowinchange');
  }

  override didInit(isAdd: boolean = false): void {
    const edges = this.getEdges();
    for (const edge of edges) {
      const targetNode = this.getContent().getNode(edge.targetNodeId);
      if (targetNode) {
        (targetNode.getRelation() as ProcessRelation).addFlowin(this.getNode().getId());
      }
    }
  }

  override didPurge(): void {
    super.didPurge();
    const edges = this.getEdges();
    for (const edge of edges) {
      const targetNode = this.getContent().getNode(edge.targetNodeId);
      if (targetNode) {
        (targetNode.getRelation() as ProcessRelation).removeFlowin(this.getNode().getId());
      }
    }
    this.flowins = [];
  }
}
