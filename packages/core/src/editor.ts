import type { ISkeleton } from "@flow-designer/model";
import type { IGraphManager } from "@flow-designer/model";
import type { Document } from "@flow-designer/model";
import type { PluginManager } from "./plugins/plugin-manager";
import { EventEmitter } from "eventemitter3";
import { makeObservable, observable, action } from "mobx";

export class Editor extends EventEmitter {
  private skeleton!: ISkeleton;
  private document!: Document;
  private plugins!: PluginManager;
  private graphView = new GraphView();
  private graph: IGraphManager | null = null;
  private container: HTMLElement | null = null;

  constructor() {
    super();
    makeObservable<Editor, "graphView" | "graph">(this, {
      graphView: observable,
      graph: observable.ref,
      setGraph: action,
    });
  }

  setSkeleton(skeleton: ISkeleton) {
    this.skeleton = skeleton;
  }

  getSkeleton() {
    return this.skeleton;
  }

  setDocument(document: Document) {
    this.document = document;
  }

  getDocument() {
    return this.document;
  }

  setPlugins(plugins: PluginManager) {
    this.plugins = plugins;
  }

  getPlugins() {
    return this.plugins;
  }

  getGraphView() {
    return this.graphView;
  }

  setContainer(container: HTMLElement | null) {
    this.container = container;
  }

  getContainer(): HTMLElement | null {
    return this.container;
  }

  setGraph(graph: IGraphManager | null) {
    this.graph = graph;
  }

  getGraph(): IGraphManager | null {
    return this.graph;
  }
}

export class GraphView {
  private zoom: number = 1;
  private editable: boolean = true;

  constructor() {
    makeObservable<GraphView, "zoom" | "editable">(this, {
      zoom: observable,
      editable: observable,
      setZoom: action,
      setEditable: action,
    });
  }

  setZoom(zoom: number) {
    this.zoom = zoom;
  }

  getZoom() {
    return this.zoom;
  }

  setEditable(editable: boolean) {
    this.editable = editable;
  }

  getEditable() {
    return this.editable;
  }
}
