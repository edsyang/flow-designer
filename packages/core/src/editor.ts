import { Signal } from "@flow-designer/model";
import type { RegistrySet } from "@flow-designer/model";
import { CommandRegistry } from "./command";
import { NotificationCenter } from "./notifications";
import type { ShortcutPort } from "./shortcuts";
export interface EditorOptions {
  registries?: RegistrySet;
}
import type { GraphPort } from "./graph-contracts";
import type { Document } from "@flow-designer/model";
import type { PluginManager } from "./plugins/plugin-manager";
import { EventEmitter } from "eventemitter3";
import { makeObservable, observable, action } from "mobx";

export class Editor extends EventEmitter {
  private document: Document | null = null;
  private plugins!: PluginManager;
  private graphView = new GraphView();
  private graph: GraphPort | null = null;
  private container: HTMLElement | null = null;
  readonly commands = new CommandRegistry();
  readonly notifications = new NotificationCenter();
  readonly events = new Signal();
  private shortcutBinding: { port: ShortcutPort } | null = null;
  private disposed = false;

  constructor(private options: EditorOptions = {}) {
    super();
    makeObservable<Editor, "graphView" | "graph">(this, {
      graphView: observable,
      graph: observable.ref,
      setGraph: action,
    });
  }

  getRegistries(): RegistrySet {
    const registries = this.document?.getRegistries() ?? this.options.registries;
    if (!registries)
      throw new Error("Editor registries require an explicit registry set or document");
    return registries;
  }
  attachShortcuts(port: ShortcutPort): () => void {
    if (this.disposed) throw new Error("Editor has been disposed");
    if (this.shortcutBinding) throw new Error("Shortcuts are already attached to this editor");
    const binding = { port };
    this.shortcutBinding = binding;
    return () => {
      if (this.shortcutBinding === binding) this.shortcutBinding = null;
    };
  }
  get shortcuts(): ShortcutPort {
    if (!this.shortcutBinding) throw new Error("No shortcuts are attached to this editor");
    return this.shortcutBinding.port;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.commands.dispose();
    this.notifications.dispose();
    this.events.removeAllListeners();
    this.shortcutBinding = null;
    this.removeAllListeners();
  }
  setDocument(document: Document) {
    if (this.disposed) throw new Error("Editor has been disposed");
    if (this.options.registries && document.getRegistries() !== this.options.registries)
      throw new Error("Editor and document must use the same registries");
    this.document = document;
  }

  hasDocument(): boolean {
    return this.document !== null;
  }

  getDocument(): Document {
    if (!this.document) throw new Error("No document is attached to this editor");
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

  setGraph(graph: GraphPort | null) {
    this.graph = graph;
  }

  getGraph(): GraphPort | null {
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
