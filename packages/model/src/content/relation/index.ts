import { EventEmitter } from "eventemitter3";
import type Content from "../index";
import type ContentNode from "../node";
import type { NodeData } from "../node";
import type { ChangeKeys } from "../../props/prop";
import type { SerializedRelation } from "../../types";

export default class Relation {
  protected emitter: EventEmitter = new EventEmitter();

  constructor(
    protected content: Content<any>,
    protected node: ContentNode<any>,
  ) {}

  getContent(): Content<any> {
    return this.content;
  }

  getDocument() {
    return this.getContent().getDocument();
  }

  getNode(): ContentNode<any> {
    return this.node;
  }

  patchData(data: NodeData): NodeData {
    return data;
  }

  didInit(_isAdd: boolean = false): void {
    return;
  }

  didAdd(): void {
    return;
  }

  didChange(_changing: ChangeKeys): void {
    return;
  }

  didPurge(): void {
    this.emitter.removeAllListeners();
  }

  serialize(): SerializedRelation[] {
    return [];
  }

  onChange(fn: () => void): () => void {
    this.emitter.on("change", fn);
    return () => {
      this.emitter.removeListener("change", fn);
    };
  }

  protected emitChange(): void {
    this.emitter.emit("change");
  }
}

export class GenericRelation extends Relation {
  private edges: SerializedRelation[];

  constructor(content: Content<any>, node: ContentNode<any>, edges: SerializedRelation[] = []) {
    super(content, node);
    this.edges = structuredClone(edges);
  }

  addEdge(edge: SerializedRelation): void {
    this.edges = [...this.edges.filter((item) => item.id !== edge.id), structuredClone(edge)];
    this.getDocument().timelineLog("Add edge");
    this.emitChange();
  }

  removeEdge(targetNodeId: string): void {
    if (!this.edges.some((edge) => edge.targetNodeId === targetNodeId)) return;
    this.edges = this.edges.filter((e) => e.targetNodeId !== targetNodeId);
    this.getDocument().timelineLog("Remove edge");
    this.emitChange();
  }

  removeEdgeById(edgeId: string): void {
    if (!this.edges.some((edge) => edge.id === edgeId)) return;
    this.edges = this.edges.filter((e) => e.id !== edgeId);
    this.getDocument().timelineLog("Remove edge");
    this.emitChange();
  }

  getEdgeById(edgeId: string): SerializedRelation | null {
    const edge = this.edges.find((e) => e.id === edgeId);
    return edge ? structuredClone(edge) : null;
  }

  updateEdgeProps(edgeId: string, props: Record<string, unknown>): void {
    const edge = this.getEdgeById(edgeId);
    if (edge) this.updateEdge(edgeId, { props: { ...edge.props, ...props } });
  }

  updateEdge(edgeId: string, patch: Partial<SerializedRelation>): void {
    const edge = this.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    this.setEdges(
      this.edges.map((item) => (item.id === edgeId ? { ...item, ...patch, id: edgeId } : item)),
    );
    this.getDocument().timelineLog("Update edge");
  }

  setEdges(edges: SerializedRelation[]): void {
    if (JSON.stringify(this.edges) !== JSON.stringify(edges)) {
      this.edges = structuredClone(edges);
      this.emitChange();
    }
  }

  getEdges(): SerializedRelation[] {
    return structuredClone(this.edges);
  }

  override serialize(): SerializedRelation[] {
    return this.getEdges();
  }

  override didPurge(): void {
    for (const node of this.content.getNodes()) {
      const relation = node.getRelation();
      if (relation instanceof GenericRelation && relation !== this)
        relation.removeEdge(this.node.getId());
    }
    super.didPurge();
  }
}

export enum TreeRelationSignal {
  CHILDREN_CHANGE = "treerelation.childrenchange",
}

export class TreeRelation extends Relation {
  private parentNode: ContentNode<TreeRelation> | null = null;
  private children: Array<ContentNode<TreeRelation>> = [];

  constructor(
    protected override content: Content<TreeRelation>,
    protected override node: ContentNode<TreeRelation>,
  ) {
    super(content, node);
  }

  override getNode(): ContentNode<TreeRelation> {
    return this.node;
  }

  override getContent(): Content<TreeRelation> {
    return this.content;
  }

  addChild(node: ContentNode<TreeRelation>, index: number | null = null): void {
    if (index === null || index > this.children.length) {
      index = this.children.length;
    } else if (index < 0) {
      index = this.children.length + (index % this.children.length);
    }
    this.children.splice(index, 0, node);
    this.getDocument().sendSignal(TreeRelationSignal.CHILDREN_CHANGE, this);
    this.emitter.emit("childrenchange");
    node.getRelation().setParent(this.node);
  }

  setParent(node: ContentNode<TreeRelation> | null): void {
    if (this.parentNode === node) {
      return;
    }
    if (this.parentNode) {
      this.parentNode.getRelation().removeChild(this.node);
    }
    this.parentNode = node;
  }

  getParent() {
    return this.parentNode;
  }

  getChildren() {
    return this.children;
  }

  getChild(index: number): ContentNode<TreeRelation> | null {
    return this.children[index] || null;
  }

  indexOf(node: ContentNode<TreeRelation>): number {
    return this.children.indexOf(node);
  }

  removeChild(node: ContentNode<TreeRelation>): void {
    const i = this.children.indexOf(node);
    if (i > -1) {
      this.children.splice(i, 1);
      this.getDocument().sendSignal(TreeRelationSignal.CHILDREN_CHANGE, this);
      this.emitter.emit("childrenchange");
    }
  }

  getLastChild() {
    const l = this.children.length;
    if (l < 1) {
      return null;
    }
    return this.children[l - 1];
  }

  getFirstChild() {
    return this.children[0] || null;
  }

  getPrevious(): ContentNode<TreeRelation> | null {
    if (!this.parentNode) {
      return null;
    }
    const pRelation = this.parentNode.getRelation();
    const i = pRelation.indexOf(this.node);
    if (i > 1) {
      return pRelation.getChild(i - 1);
    }
    return null;
  }

  getNext(): ContentNode<TreeRelation> | null {
    if (!this.parentNode) {
      return null;
    }
    const pRelation = this.parentNode.getRelation();
    const i = pRelation.indexOf(this.node);
    if (i > -1) {
      return pRelation.getChild(i + 1);
    }
    return null;
  }

  override patchData(data: NodeData): NodeData {
    data.children = this.getChildren().map((node) => node.getData());
    return data;
  }

  onChildrenChange(fn: () => void): () => void {
    this.emitter.on("childrenchange", fn);
    return () => {
      this.emitter.removeListener("childrenchange", fn);
    };
  }
}
