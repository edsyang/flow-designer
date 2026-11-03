import type { IArea, PaneConfig } from "@flow-designer/model";
import { makeAutoObservable, observable, action } from "mobx";

export class Area implements IArea {
  private didMountCallbacks: Array<(container: HTMLElement) => void | (() => void)> = [];
  private items: PaneConfig[] = [];
  private visible = true;

  constructor() {
    makeAutoObservable<Area, "didMountCallbacks">(this, { didMountCallbacks: observable.shallow });
  }

  hooks = {
    didMount: (cb: (container: HTMLElement) => void | (() => void)) => {
      this.didMountCallbacks.push(cb);
      return action(() => {
        this.didMountCallbacks = this.didMountCallbacks.filter((callback) => callback !== cb);
      });
    },
  };

  getDidMountCallbacks() {
    return [...this.didMountCallbacks];
  }

  getItems() {
    return this.items;
  }

  add(config: PaneConfig) {
    this.items.push(config);
  }

  remove(key: string) {
    this.items = this.items.filter((item) => item.key !== key);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  getVisible() {
    return this.visible;
  }
}
