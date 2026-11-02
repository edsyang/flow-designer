import { EventEmitter } from 'eventemitter3';
import Props from '../props';
import Prop from '../props/prop';
import Formatter from './formatter';
import type { FormatterConfig } from './formatter';
import { hasOwn, uniqueId } from '../utils';
import Document from '../document';
import ContentNode from '../content/node';
import Changeable from './changeable';
import type { ChangeableConfig } from './changeable';

export type SetterComponentType = React.ComponentType<any>;

export type SetterType<T = any> = string | {
  type: string;
  props?: object;
  formatter?: FormatterConfig<T>;
  [key: string]: any;
} | SetterComponentType | React.ReactElement<any>;

export type Tip = { type: string; content: any; } | React.ReactNode;

export enum DisplayType {
  None = 'none',
  Block = 'block',
  Plain = 'plain',
  Inline = 'inline',
  Accordion = 'accordion',
  Popup = 'popup',
  Caption = 'caption',
  Entry = 'entry',
  Tab = 'tab',
}

export enum SettingType {
  Item = 'item',
  Group = 'group',
}

export type ReturnBoolean<T> = (ctx: Setting<T>, value?: any) => boolean | boolean;

export interface BehaviorsConfig<T> {
  [behavior: string]: ReturnBoolean<T>;
}

export interface SettingConfig<T> {
  type?: SettingType;
  target?: string | string[];
  description?: string;
  tip?: Tip;
  display?: DisplayType;
  tab?: string;
  className?: string;
  formatter?: FormatterConfig<T>;
  setter?: SetterType<T>;
  items?: Array<SettingConfig<T>>;
  behaviors?: BehaviorsConfig<T>;
  setterChangeableProps?: Array<ChangeableConfig<T>>;
}

export interface Target {
  path: string;
  prop: Prop;
  data: any;
  revision: number;
}

export type ChangeableProps<T> = Array<Changeable<T>>;

export interface Behavior {
  readonly value: boolean;
  update(): boolean;
  setValue(flag: boolean): void;
}

export interface Behaviors {
  [key: string]: Behavior;
}

export interface BehaviorValues {
  [behavior: string]: boolean;
}

function createBehavior<T>(
  context: Setting<T>,
  config: ReturnBoolean<T> | null = null,
  defaultValue: boolean = false,
): Behavior {
  let ivalue = defaultValue;
  let isettedValue: boolean | null = null;
  const behavior = {
    get value(): boolean {
      if (isettedValue != null) {
        return isettedValue;
      }
      return ivalue;
    },
    update: () => false,
    setValue(flag: boolean): void {
      isettedValue = flag;
    },
  };
  if (typeof config === 'function') {
    behavior.update = () => {
      const value = config(context, context.getValue());
      if (behavior.value !== value) {
        ivalue = value;
        return true;
      }
      return false;
    };
    behavior.update();
  } else if (config != null) {
    ivalue = Boolean(config);
  }

  return behavior;
}

export default class Setting<T> {
  private uid: string = uniqueId('setting');
  private emitter: EventEmitter = new EventEmitter();
  private internalValue: any;
  private targets!: Target[];
  private type!: SettingType;
  private items!: Array<Setting<T>>;
  private description!: string;
  private tip: Tip | null = null;
  private tab: string | undefined;
  private className?: string;
  private display!: DisplayType;
  private setter: SetterType<T> | null = null;
  private setterChangeableProps!: ChangeableProps<T>;
  private formatter!: Formatter<T>;
  private behaviors: Behaviors = {};

  constructor(private props: Props<T>, private scope: Prop, config: SettingConfig<T>) {
    const {
      type, target, description, tab, className,
      tip, display, setter, setterChangeableProps,
      items, behaviors = {},
    } = config;

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

      this.setter = setter || null;

      if (setterChangeableProps) {
        this.setterChangeableProps = setterChangeableProps.map((cnf) => {
          return new Changeable<T>(this, cnf);
        });
      }
    }
    this.description = description || '';
    this.tip = tip ?? null;
    this.tab = tab;
    this.className = className;
    this.display = display || DisplayType.Block;
    Object.keys(behaviors).forEach((key) => {
      this.behaviors[key] = createBehavior(this, behaviors[key], false);
    });
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

  getDescription(): string {
    return this.description;
  }

  getClassName() {
    return this.className;
  }

  getDisplay(): DisplayType {
    return this.display;
  }

  getTip(): Tip | null {
    return this.tip;
  }

  getTargets(): Target[] {
    return this.targets;
  }

  getSetter(): SetterType<T> | null {
    return this.setter;
  }

  getSetterChangeableProps(): ChangeableProps<T> {
    return this.setterChangeableProps;
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
      this.emitter.emit('valuechange');
    }
  }

  isStash(): boolean {
    return this.targets.some((target) => target.prop.isStash());
  }

  getHotValue(): any {
    return this.getValue();
  }

  setHotValue(value: any): void {
    return this.setValue(value);
  }

  getBehaviorValue(key: string): boolean {
    return this.getBehavior(key).value;
  }

  getBehavior(key: string): Behavior {
    if (!hasOwn(this.behaviors, key)) {
      this.behaviors[key] = createBehavior(this);
    }
    return this.behaviors[key]!;
  }

  getBehaviors(): BehaviorValues {
    const values: BehaviorValues = {};
    Object.keys(this.behaviors).forEach((key) => {
      values[key] = this.getBehaviorValue(key);
    });
    return values;
  }

  setBehavior(key: string, flag: boolean): void {
    this.getBehavior(key).setValue(flag);
    this.emitter.emit('behaviorchange');
  }

  toggleCollapsed(): void {
    this.setBehavior('collapsed', !this.getBehaviorValue('collapsed'));
  }

  update(): void {
    if (this.isGroup()) {
      this.items.forEach((item) => item.update());
    } else {
      this.updateTargets();
    }
  }

  updateBehavior(): void {
    let modified = false;
    Object.keys(this.behaviors).forEach((key) => {
      if (this.behaviors[key]!.update()) {
        modified = true;
      }
    });

    if (modified) {
      this.emitter.emit('behaviorchange');
    }
  }

  didPurge(): void {
    this.emitter.removeAllListeners();
    if (this.isGroup()) {
      this.items.forEach((item) => item.didPurge());
      this.items = [];
    }
  }

  onValueChange(fn: () => void): () => void {
    this.emitter.on('valuechange', fn);
    return () => {
      this.emitter.removeListener('valuechange', fn);
    };
  }

  onBehaviorChange(fn: () => void): () => void {
    this.emitter.on('behaviorchange', fn);
    return () => {
      this.emitter.removeListener('behaviorchange', fn);
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

    this.emitter.emit('valuechange');
    return true;
  }
}
