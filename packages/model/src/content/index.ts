import { makeObservable, observable, runInAction } from "mobx";
import { EventEmitter } from "eventemitter3";
import type Document from "../document";
import { hasOwn } from "../utils/index";
import ContentNode from "./node";
import type { NodeData } from "./node";
import type Relation from "./relation";

export interface ContentData {
  [contentField: string]: any;
}

export interface ContentType {
  readonly compatibleType: string;
  readonly compatibleVersion: string;
  new (owner: Document, data: ContentData): Content;
}

export enum ContentSignal {
  ADD_NODE = "content.addnode",
  REMOVE_NODE = "content.removenode",
}

export enum ContentAop {
  NODE_ADDING = "contentaop.nodeadding",
  NODE_REMOVING = "contentaop.noderemoving",
}

interface ContentNodeMap<T extends Relation> {
  [uid: string]: ContentNode<T> | null;
}

function isContentNode<T extends Relation>(_node: any): _node is ContentNode<T> {
  return true;
}

export default abstract class Content<T extends Relation = Relation> {
  protected emitter: EventEmitter = new EventEmitter();
  protected nodes: Array<ContentNode<T>> = [];
  protected nodesMap: ContentNodeMap<T> = {};
  private uidBase: number = Date.now();
  private destroyed = false;

  constructor(
    private owner: Document,
    data: ContentData,
  ) {
    makeObservable<Content<T>, "nodes" | "nodesMap">(this, {
      nodes: observable,
      nodesMap: observable,
    });
    this.nodes = this.nodesFromData(
      data,
      (nodeData: NodeData) => new ContentNode<T>(this, nodeData),
    );
    this.nodes.forEach((node) => {
      node.didInit();
    });
  }

  getDocument(): Document {
    return this.owner;
  }

  generateNodeId(): string {
    let id: string;
    do {
      id = `node-${(this.uidBase++).toString(36).toLowerCase()}`;
    } while (hasOwn(this.nodesMap, id));
    return id;
  }

  registerNode(id: string, node: ContentNode<T>): T {
    runInAction(() => {
      this.nodesMap[id] = node;
    });
    return this.createRelation(node);
  }

  getNode(id: string): ContentNode<T> | null {
    return this.nodesMap[id] ?? null;
  }

  onContentChange(fn: () => void): () => void {
    this.emitter.on("contentchange", fn);
    return () => {
      this.emitter.removeListener("contentchange", fn);
    };
  }

  getNodes(): Array<ContentNode<T>> {
    return this.nodes;
  }

  addNode(
    nodeData: NodeData,
    // Capture the allocated object before async hooks or insertion can fail.
    // This observer is for retaining identity, not mutating document state.
    onAllocated?: (node: ContentNode<T>) => void,
  ): Promise<ContentNode<T> | null> {
    if (this.destroyed) return Promise.reject(new Error("Content has been destroyed"));
    const node = new ContentNode<T>(this, nodeData);
    try {
      onAllocated?.(node);
    } catch (error) {
      runInAction(() => {
        if (this.nodesMap[node.getId()] === node) this.nodesMap[node.getId()] = null;
      });
      node.didPurge();
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    const doc = this.getDocument();
    return doc.invoke(ContentAop.NODE_ADDING, node, this).then(
      () => {
        if (this.destroyed) {
          node.didPurge();
          return null;
        }
        runInAction(() => {
          this.nodes.push(node);
        });
        node.didAdd();
        doc.sendSignal(ContentSignal.ADD_NODE, node, this);
        doc.timelineLog(`Add ContentNode ${node.getTypeName()} #${node.getId()}`);
        return node;
      },
      () => {
        runInAction(() => {
          if (this.nodesMap[node.getId()] === node) this.nodesMap[node.getId()] = null;
        });
        node.didPurge();
        return null;
      },
    );
  }

  removeNode(node: ContentNode<T> | string, sideEffects?: () => void) {
    if (typeof node === "string") {
      node = this.nodesMap[node]!;
    }

    if (node) {
      const doc = this.getDocument();
      return doc.invoke(ContentAop.NODE_REMOVING, node, this).then(
        () => {
          if (isContentNode<T>(node)) {
            if (sideEffects) {
              sideEffects();
            }
            const i = this.nodes.indexOf(node);
            if (i > -1) {
              runInAction(() => {
                this.nodesMap[node.getId()] = null;
                this.nodes.splice(i, 1);
              });
              doc.sendSignal(ContentSignal.REMOVE_NODE, node, this);
              node.didPurge();
              doc.timelineLog(`Remove ContentNode ${node.getTypeName()} #${node.getId()}`);
              return true;
            }
          }
        },
        (_e: unknown) => {
          return false;
        },
      );
    }
  }

  /** Compensate a command-owned addition; user deletion vetoes do not apply to rollback. */
  rollbackAddedNode(node: ContentNode<T>): boolean {
    const index = this.nodes.indexOf(node);
    if (index < 0 || this.nodesMap[node.getId()] !== node) return false;
    runInAction(() => {
      this.nodesMap[node.getId()] = null;
      this.nodes.splice(index, 1);
    });
    const doc = this.getDocument();
    try {
      doc.sendSignal(ContentSignal.REMOVE_NODE, node, this);
    } finally {
      node.didPurge();
      doc.timelineLog(`Roll back added ContentNode #${node.getId()}`);
    }
    return true;
  }

  applyTimelinePointData(data: ContentData): void {
    const originNodes = new Set(this.nodes);
    const addedNodes: Array<ContentNode<T>> = [];
    const nextNodes = this.nodesFromData(data, (nodeData: NodeData): ContentNode<T> => {
      let node: ContentNode<T> | null;
      if (nodeData.id) {
        node = this.getNode(nodeData.id);
        if (node) {
          node.applyTimelinePointData(nodeData);
          this.onNodeTimelineRestore(node);
          originNodes.delete(node);
          return node;
        }
      }
      node = new ContentNode(this, nodeData);
      addedNodes.push(node);
      return node;
    });
    runInAction(() => {
      this.nodes = nextNodes;
    });

    const doc = this.getDocument();

    addedNodes.forEach((node) => {
      node.didAdd();
      doc.sendSignal(ContentSignal.ADD_NODE, node, this);
    });

    if (originNodes.size > 0) {
      originNodes.forEach((node) => {
        runInAction(() => {
          this.nodesMap[node.getId()] = null;
        });
        doc.sendSignal(ContentSignal.REMOVE_NODE, node, this);
        node.didPurge();
      });
    }
  }

  protected onNodeTimelineRestore(_node: ContentNode<T>): void {
    // Subclass hook: restore relation data for existing nodes during timeline navigation
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const nodes = this.nodes.slice();
    // Detach the graph before purging nodes: teardown must not act like N user deletions.
    runInAction(() => {
      this.nodes = [];
      this.nodesMap = {};
    });
    nodes.forEach((node) => {
      node.didPurge();
    });
    this.emitter.removeAllListeners();
  }

  abstract nodesFromData(
    data: ContentData,
    creator: (nodeData: NodeData) => ContentNode<T>,
  ): Array<ContentNode<T>>;
  abstract getData(): ContentData;
  abstract createRelation(node: ContentNode<T>): T;
}
