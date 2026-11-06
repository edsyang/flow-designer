import { EventEmitter } from "eventemitter3";
import type Prototype from "../prototype";
import Props from "../props";
import type { PropsData } from "../props";
import Settings from "../settings";
import { hasOwn } from "../utils";
import type Content from "./index";
import type Relation from "./relation/index";
import type { ChangeKeys } from "../props/prop";

export interface NodeData {
  id?: string;
  type: string;
  props?: PropsData;
  [key: string]: any;
}

export enum NodeSignal {
  PROPS_UPDATE = "node.propsupdate",
}

export default class ContentNode<T extends Relation = Relation> {
  private emitter: EventEmitter = new EventEmitter();
  private props: Props<ContentNode<T>>;
  private prototype: Prototype;
  private uid: string;
  private settings!: Settings<ContentNode<T>>;
  private relation: T;
  private purged: boolean = false;
  private disableTimelineLogging: boolean = false;

  constructor(
    private content: Content<T>,
    nodeData: NodeData,
  ) {
    const prototypeRegistry = content.getDocument().getRegistries().prototypes;
    let prototype = prototypeRegistry.getPrototypeByType(nodeData.type);
    if (!prototype) {
      prototype = prototypeRegistry.getPrototypeByType("Unknown")!;
    }
    this.prototype = prototype;

    const propsData: PropsData = nodeData.props || {};
    prototype.getProps().forEach((config) => {
      if (config.initial) {
        propsData[config.name] = config.initial(propsData[config.name], config.defaultValue, this);
      } else if (!hasOwn(propsData, config.name)) {
        propsData[config.name] = config.defaultValue;
      }
    });

    this.props = new Props(this, propsData);
    this.props.onChange((changing: ChangeKeys) => {
      if (!this.disableTimelineLogging) {
        const withDesc = `Modify #${this.getId()} props ${Array.from(changing)}`;
        this.getDocument().timelineLog(withDesc);
      }
      this.getDocument().sendSignal(NodeSignal.PROPS_UPDATE, changing, this.props, this);
      this.relation.didChange(changing);
      this.prototype.propsDidChange(changing, this.props, this);
    });

    let uid = nodeData.id;
    if (!uid) {
      uid = content.generateNodeId();
    }
    this.uid = uid;
    this.relation = content.registerNode(uid, this);
  }

  applyTimelinePointData(nodeData: NodeData): void {
    this.disableTimelineLogging = true;
    // Position is part of props (__position); relation restoration remains the content owner's job.
    if (JSON.stringify(this.props.getData()) !== JSON.stringify(nodeData.props ?? {})) {
      this.props.setData(nodeData.props);
    }
    this.disableTimelineLogging = false;
  }

  getId(): string {
    return this.uid;
  }

  getTypeName(): string {
    return this.prototype.getTypeName();
  }

  getProps(): Props<ContentNode<T>> {
    return this.props;
  }

  getPrototype(): Prototype {
    return this.prototype;
  }

  getContent(): Content<T> {
    return this.content;
  }

  getDocument() {
    return this.getContent().getDocument();
  }

  getRelation(): T {
    return this.relation;
  }

  getSettings(fresh = false): Settings<ContentNode<T>> {
    if (fresh ? true : !this.settings) {
      this.settings = new Settings(this.getProps(), this.prototype.getSettings());
    }

    return this.settings;
  }

  getData(): NodeData {
    const propsData = this.props.getData();
    return this.relation.patchData({
      type: this.getTypeName(),
      name: (propsData && propsData.name && propsData.name.rawValue) || "",
      props: propsData,
      id: this.getId(),
    });
  }

  select(): void {
    this.getContent().getDocument().getSelection().setKeys([this.getId()]);
  }

  remove(sideEffects?: () => void) {
    return this.content.removeNode(this, sideEffects);
  }

  async copy() {
    const propsData = this.getProps().getData();
    const newContentNode = await this.content.addNode({
      type: this.getTypeName(),
      props: propsData,
    });

    return newContentNode;
  }

  didInit(isAdd: boolean = false): void {
    this.relation.didInit(isAdd);
    this.prototype.nodeDidInit(this, isAdd);
  }

  didPurge(): void {
    if (this.purged) {
      return;
    }
    this.purged = true;
    this.emitter.removeAllListeners();
    this.relation.didPurge();
    this.props.didPurge();
    this.prototype.nodeDidPurge(this);
    if (this.settings) {
      this.settings.didPurge();
    }
  }

  didAdd(): void {
    this.didInit(true);
    this.relation.didAdd();
    this.prototype.nodeDidAdd(this);
  }

  onPropsChange(fn: (changing: ChangeKeys) => void): () => void {
    return this.props.onChange(fn);
  }

  onPropsSyncChange(fn: (changing: ChangeKeys) => void): () => void {
    return this.props.onSyncChange(fn);
  }

  getPosition(): { x: number; y: number } {
    const pos = this.props.getPropData("__position");
    return pos || { x: 0, y: 0 };
  }

  setPosition(x: number, y: number): void {
    this.props.setPropData("__position", { x, y });
  }
}
