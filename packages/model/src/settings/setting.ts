import { EventEmitter } from "eventemitter3";
import type Props from "../props";
import type Prop from "../props/prop";
import Formatter from "./formatter";
import type { FormatterConfig } from "./formatter";
import { hasOwn, uniqueId } from "../utils";

export enum SettingType {
  Item = "item",
  Group = "group",
}

export interface SettingConfig<T> {
  key?: string;
  type?: SettingType;
  target?: string | string[];
  formatter?: FormatterConfig<T>;
  items?: Array<SettingConfig<T>>;
}

export interface Target {
  path: string;
  prop: Prop;
  data: any;
  revision: number;
}

export default class Setting<T> {
  private uid: string = uniqueId("setting");
  private emitter: EventEmitter = new EventEmitter();
  private internalValue: any;
  private targets!: Target[];
  private type!: SettingType;
  private items!: Array<Setting<T>>;
  private formatter!: Formatter<T>;
  private config: SettingConfig<T>;

  constructor(
    private props: Props<T>,
    private scope: Prop,
    config: SettingConfig<T>,
  ) {
    this.config = config;
    const { type, target, items } = config;

    this.type = type || (items && items.length > 0 ? SettingType.Group : SettingType.Item);

    if (this.isGroup()) {
      this.items = (items || []).map((itemConfig) => new Setting(props, scope, itemConfig));
    } else if (target) {
      const targets = Array.isArray(target) ? target : [target];
      let targetsData: any = {};

      this.targets = targets.map<Target>((path: string): Target => {
        const prop = scope.getProp(path, true)!;
        const data = prop.getData();
        const revision = prop.getRevision();
        targetsData[path] = data;
        return { path, prop, data, revision };
      });

      if (this.targets.length < 2) {
        targetsData = this.targets[0]!.data;
      }

      this.formatter = new Formatter<T>(this, config);
      this.internalValue = this.formatter.formatIn(targetsData);
    }
  }

  getKey(): string | undefined {
    return this.config.key;
  }

  isGroup(): boolean {
    return this.type === SettingType.Group;
  }

  getId(): string {
    return this.uid;
  }

  getOwner(): T {
    return this.props.getOwner();
  }

  getProps(): Props<T> {
    return this.props;
  }

  getScope(): Prop {
    return this.scope;
  }

  getItems(): Array<Setting<T>> {
    return this.items;
  }

  getTargets(): Target[] {
    return this.targets;
  }

  getValue(): any {
    return this.internalValue;
  }

  setValue(value: any): void {
    let modified = false;
    this.internalValue = value;
    const externalData = this.formatter.formatOut(value);
    if (this.targets.length > 1) {
      this.targets.forEach((target) => {
        const path = target.path;
        if (hasOwn(externalData, path)) {
          if (target.prop.setData(externalData[path])) {
            target.revision = target.prop.getRevision();
            modified = true;
          }
        }
      });
    } else {
      const target = this.targets[0]!;
      if (target.prop.setData(externalData)) {
        target.revision = target.prop.getRevision();
        modified = true;
      }
    }

    if (modified) {
      this.emitter.emit("valuechange");
    }
  }

  isStash(): boolean {
    return this.targets.some((target) => target.prop.isStash());
  }

  getHotValue(): any {
    return this.getValue();
  }

  setHotValue(value: any): void {
    this.setValue(value);
  }

  update(): void {
    if (this.isGroup()) {
      this.items.forEach((item) => {
        item.update();
      });
    } else {
      this.updateTargets();
    }
  }

  didPurge(): void {
    this.emitter.removeAllListeners();
    if (this.isGroup()) {
      this.items.forEach((item) => {
        item.didPurge();
      });
      this.items = [];
    }
  }

  onValueChange(fn: () => void): () => void {
    this.emitter.on("valuechange", fn);
    return () => {
      this.emitter.removeListener("valuechange", fn);
    };
  }

  private updateTargets(): boolean {
    let updated = false;
    let targetsData: any = {};

    this.targets.forEach((target) => {
      const revision = target.prop.getRevision();
      if (revision > target.revision) {
        target.data = target.prop.getData();
        target.revision = revision;
        updated = true;
      }
      targetsData[target.path] = target.data;
    });

    if (!updated) {
      return false;
    }

    if (this.targets.length < 2) {
      targetsData = this.targets[0]!.data;
    }

    this.internalValue = this.formatter.formatIn(targetsData);

    this.emitter.emit("valuechange");
    return true;
  }
}
