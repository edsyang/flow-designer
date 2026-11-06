import type { IArea, PaneConfig, AreaMountCallback } from "./contracts";

import { makeAutoObservable, observable, action } from "mobx";

export class Area implements IArea {
  private didMountCallbacks: AreaMountCallback[] = [];
  private items: PaneConfig[] = [];
  private visible = true;

  constructor() {
    makeAutoObservable<Area, "didMountCallbacks">(this, { didMountCallbacks: observable.shallow });
  }

  hooks = {
    didMount: (cb: AreaMountCallback) => {
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
