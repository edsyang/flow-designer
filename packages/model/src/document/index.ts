import { EventEmitter } from "eventemitter3";
import { defaultRegistries } from "../registries";
import type { RegistrySet } from "../registries/registry-set";
import Signal from "../signals";
import Props from "../props";
import type { PropsData } from "../props";
import type Content from "../content";
import Settings from "../settings/index";
import type { SettingConfig } from "../settings/setting";
import { hasOwn } from "../utils/index";
import type { ChangeKeys } from "../props/prop";
import Selection from "./selection";
import Timeline from "./timeline";

export interface DocumentOptions {
  registries?: RegistrySet;
  signals?: Signal;
}

export interface DocumentData {
  id: string;
  documentType: string;
  documentVersion: string;
  props?: PropsData;
  [contentField: string]: any;
}

export enum DocumentSignal {
  PROPS_UPDATE = "document.propsupdate",
}

export type AspectFn = (...args: any[]) => any;

export interface AspectsMap {
  [type: string]: AspectFn[];
}

function invoke(hooks: AspectFn[], args: any[]): Promise<any> {
  let errorData: Error | null = null;
  let runData: any = null;

  const i: any = {};
  const ret = new Promise((resolve, reject) => {
    i.resolve = resolve;
    i.reject = reject;
  });

  const fail = (e?: any) => {
    if (e) {
      errorData = e instanceof Error ? e : new Error(e);
    }
    i.reject(errorData || new Error("Unknown"));
  };

  const done = () => {
    if (errorData !== null) {
      fail();
    } else {
      i.resolve(runData);
    }
  };

  const setData = (data: any) => {
    if (data !== null && (runData == null || data.constructor === runData.constructor)) {
      runData = data;
    }
  };

  const next = (data: any) => {
    if (data instanceof Error) {
      errorData = data;
    }

    if (errorData !== null || data === false) {
      fail();
      return;
    }

    setData(data);

    const hook = hooks.shift();
    if (!hook) {
      done();
      return;
    }

    let res;
    try {
      res = hook.apply(null, [...args, runData]);
    } catch (e) {
      fail(e);
      return;
    }

    if (res && res.then) {
      res.then(next, fail);
    } else {
      next(res);
    }
  };

  setTimeout(next, 1);

  return ret;
}

export default class Document {
  private id: string;
  private documentType: string;
  private documentVersion: string;
  private props: Props<Document>;
  private settings: Settings<Document>;
  private content: Content;
  private selection: Selection;
  private timeline: Timeline;
  private aspects: AspectsMap = {};
  private disableTimelineLogging: boolean = false;
  private registries: RegistrySet;
  private signals: Signal;
  private ownsRegistries: boolean;
  private ownsSignals: boolean;
  private disposed = false;

  constructor(
    data: DocumentData,
    settingsConfig?: Array<SettingConfig<Document>>,
    options: DocumentOptions = {},
  ) {
    this.ownsRegistries = !options.registries;
    this.ownsSignals = !options.signals;
    this.registries = options.registries ?? defaultRegistries.fork();
    this.signals = options.signals ?? new Signal();
    const { id, documentType, documentVersion, props, ...contents } = data;

    this.id = id;
    this.documentType = documentType;
    this.documentVersion = documentVersion;

    const ContentModel = this.registries.contentTypes.getSuitableContentType(
      documentType,
      documentVersion,
    );
    if (!ContentModel) {
      throw new Error("Cannot find suitable content model");
    }

    this.props = new Props(this, props);
    this.props.onChange((changing: ChangeKeys) => {
      if (!this.disableTimelineLogging) {
        const withDesc = `Modify document props ${Array.from(changing)}`;
        this.timelineLog(withDesc);
      }
      this.sendSignal(DocumentSignal.PROPS_UPDATE, this.props);
    });
    this.content = new ContentModel(this, contents);
    this.selection = new Selection(this);
    this.settings = new Settings(this.props, settingsConfig || []);
    this.timeline = new Timeline(
      () => this.getData(),
      (pointData: DocumentData) => {
        this.applyTimelinePointData(pointData);
      },
    );
  }

  getRegistries(): RegistrySet {
    return this.registries;
  }
  getSignals(): Signal {
    return this.signals;
  }
  isDisposed(): boolean {
    return this.disposed;
  }

  getId() {
    return this.id;
  }

  getProps(): Props<Document> {
    return this.props;
  }

  getContent(): Content {
    return this.content;
  }

  getSelection(): Selection {
    return this.selection;
  }

  getSettings(): Settings<Document> {
    return this.settings;
  }

  getTimeline(): Timeline {
    return this.timeline;
  }

  timelineLog(desc: string): void {
    this.timeline.log(desc);
  }

  transaction<T>(title: string, operation: () => T | Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("Document has been destroyed"));
    return this.timeline.transaction(title, operation);
  }

  applyTimelinePointData(data: DocumentData): void {
    const {
      id: _id,
      documentType: _documentType,
      documentVersion: _documentVersion,
      props,
      ...contents
    } = data;
    this.disableTimelineLogging = true;
    try {
      this.props.setData(props);
      this.content.applyTimelinePointData(contents);
    } finally {
      this.disableTimelineLogging = false;
    }
  }

  getData(): DocumentData {
    return {
      id: this.id,
      documentType: this.documentType,
      documentVersion: this.documentVersion,
      props: this.props.getData(),
      ...this.content.getData(),
    };
  }

  onStateChange(fn: (state: number) => void): () => void {
    return this.getTimeline().onStateChange(fn);
  }

  isModified(): boolean {
    return this.getTimeline().isModified();
  }

  save(): DocumentData {
    const data = this.getData();
    this.timeline.savePoint();
    return data;
  }

  load(data: DocumentData): void {
    this.timeline.apply(data);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.timeline.pause();
    this.content.destroy();
    this.props.didPurge();
    this.selection.destroy();
    this.settings.didPurge();
    this.timeline.destroy();
    this.aspects = {};
    if (this.ownsSignals) this.signals.removeAllListeners();
    if (this.ownsRegistries) this.registries.dispose();
  }

  sendSignal(type: string, ...args: any[]): void {
    if (!this.disposed) this.signals.sendSignal(type, this, ...args);
  }

  aspect(type: string, fn: AspectFn): void {
    if (!hasOwn(this.aspects, type)) {
      this.aspects[type] = [];
    }
    this.aspects[type]!.push(fn);
  }

  invoke(type: string, ...args: any[]): Promise<any> {
    const list = this.aspects[type] || [];
    return invoke(list.slice(), args);
  }
}

// --- DocumentCollection ---

export interface DocumentCollectionData {
  documents: DocumentData[];
}

export enum DocumentCollectionSignal {
  DOC_ADD = "documentcollection.docadd",
  DOC_REMOVE = "documentcollection.docremove",
  CURRENT_CHANGE = "documentcollection.currentchange",
}

export class DocumentCollection {
  private emitter: EventEmitter = new EventEmitter();
  private items: Document[] = [];
  private current: Document | null = null;
  private signals: Signal;
  private registries: RegistrySet;
  private ownsRegistries: boolean;
  private ownsSignals: boolean;
  private disposed = false;

  constructor(
    data: DocumentCollectionData,
    private settingsConfig?: Array<SettingConfig<Document>>,
    private options: DocumentOptions = {},
  ) {
    this.items = [];
    this.registries = options.registries ?? defaultRegistries.fork();
    this.ownsRegistries = !options.registries;
    this.signals = options.signals ?? new Signal();
    this.ownsSignals = !options.signals;
  }

  getRegistries(): RegistrySet {
    return this.registries;
  }

  getSignals(): Signal {
    return this.signals;
  }

  createDocument(data: DocumentData): Document {
    if (this.disposed) throw new Error("Document collection has been destroyed");
    return new Document(data, this.settingsConfig, { registries: this.registries });
  }

  addDocument(doc: DocumentData | Document, index: number | null = null): Document {
    if (this.disposed) throw new Error("Document collection has been destroyed");
    if (!(doc instanceof Document)) {
      doc = this.createDocument(doc);
    }

    if (index === null || index > this.items.length) {
      index = this.items.length;
    } else if (index < 0) {
      index = 0;
    }

    this.items.splice(index, 0, doc);

    this.signals.sendSignal(DocumentCollectionSignal.DOC_ADD, this, doc);

    if (!this.current) {
      this.setCurrent(doc);
    }

    return doc;
  }

  removeDocument(doc: Document): void {
    const i = this.items.indexOf(doc);
    if (i > -1) {
      this.items.splice(i, 1);
      this.signals.sendSignal(DocumentCollectionSignal.DOC_REMOVE, this, doc);
      if (this.current === doc) {
        this.setCurrent(this.getDocument(0));
      }
    }
  }

  getDocument(index: number): Document | null {
    return this.items[index] || null;
  }

  getItems(): Document[] {
    return this.items;
  }

  getCurrent(): Document | null {
    return this.current;
  }

  setCurrent(doc: Document | null): void {
    if (this.current === doc) {
      return;
    }
    const orig = this.current;
    this.current = doc;
    this.signals.sendSignal(DocumentCollectionSignal.CURRENT_CHANGE, this, doc, orig);
    this.emitter.emit("currentchange");
  }

  onItemsChange(fn: () => void): () => void {
    this.emitter.on("itemschange", fn);
    return () => {
      this.emitter.removeListener("itemschange", fn);
    };
  }

  onCurrentChange(fn: () => void): () => void {
    this.emitter.on("currentchange", fn);
    return () => {
      this.emitter.removeListener("currentchange", fn);
    };
  }

  /** Collection listeners/registries are owned here; externally retained documents remain caller-owned. */
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.emitter.removeAllListeners();
    if (this.ownsSignals) this.signals.removeAllListeners();
    if (this.ownsRegistries) this.registries.dispose();
    this.items = [];
    this.current = null;
  }

  getData(): DocumentCollectionData {
    return {
      documents: this.items.map((doc) => doc.getData()),
    };
  }
}
