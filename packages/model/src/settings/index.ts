import { EventEmitter } from "eventemitter3";
import type Props from "../props";
import type Prop from "../props/prop";
import Setting from "./setting";
import type { SettingConfig } from "./setting";

export default class Settings<T> {
  private emitter: EventEmitter = new EventEmitter();
  private items: Array<Setting<T>>;
  private willDetach: () => void;
  private filter: ((setting: Setting<T>) => boolean) | null;

  constructor(
    private props: Props<T>,
    settingsConfig: Array<SettingConfig<T>>,
    scope?: Prop,
  ) {
    if (!scope) {
      scope = props;
    }

    this.items = settingsConfig.map((config): Setting<T> => new Setting(props, scope, config));
    this.filter = null;
    let revision = scope.getRevision();
    this.willDetach = props.onChange(() => {
      if (scope === this.props || revision !== scope.getRevision()) {
        revision = scope.getRevision();
        this.items.forEach((item) => {
          item.update();
          item.updateBehavior();
        });
        this.emitter.emit("scopechange");
      }
    });
  }

  getProps(): Props<T> {
    return this.props;
  }

  getItems() {
    return this.filter ? this.items.filter(this.filter) : this.items;
  }

  setFilter(filter: ((setting: Setting<T>) => boolean) | null) {
    this.filter = filter;
  }

  didPurge(): void {
    if (this.willDetach) {
      this.willDetach();
    }
    this.emitter.removeAllListeners();
    this.items.forEach((item) => {
      item.didPurge();
    });
    this.items = [];
  }

  onScopeChange(fn: () => void): () => void {
    this.emitter.on("scopechange", fn);
    return () => {
      this.emitter.removeListener("scopechange", fn);
    };
  }
}
