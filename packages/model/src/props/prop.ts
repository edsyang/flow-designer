import {
  DataType,
  testType,
  hasOwn,
  setData,
  cloneDeep,
  splitPath,
  getKey,
  uniqueId,
} from "../utils";

export interface PropConfig {
  name: string;
  defaultValue?: any;
  initial?: (value: any, defaultValue: any, ctx: any) => any;
  [config: string]: any;
}

export interface PropMaps<T> {
  [propName: string]: T;
}

export interface Capturing {
  modified: boolean;
  release(): void;
}

export interface ChangeEvent {
  targetKey: string;
}

export type ChangeKeys = Set<string>;

export default class Prop {
  private changing: ChangeKeys | null = null;
  private uid: string = uniqueId("prop");
  private type: DataType;
  private maps: PropMaps<Prop> = {};
  private items: Prop[] = [];
  private entries: string[] = [];
  private stashEntries: string[] = [];
  private revision: number = 0;
  private inited: boolean = false;
  private capturing: Capturing | null = null;
  private parent: Prop | null;
  private key: string | null = null;
  private rawData: any = null;

  constructor(
    parent: Prop | null,
    key: string | null = null,
    rawData: any = null,
    cloned: boolean = false,
  ) {
    this.parent = parent;
    this.key = key;
    this.rawData = rawData;
    if (!cloned) {
      this.rawData = cloneDeep(rawData);
    }
    this.type = testType(this.rawData);
    if (this.isStash()) {
      this.revision = -1;
    }
  }

  getId(): string {
    return this.uid;
  }

  getParent(): Prop | null {
    return this.parent;
  }

  getType(): DataType {
    return this.type;
  }

  getKey(): string {
    return this.key || "";
  }

  getRevision(): number {
    return this.revision;
  }

  getProp(path: string, force: boolean = false): Prop | null {
    const pathArray = splitPath(path);

    if (!pathArray) {
      return null;
    }

    const [_, up, upPath, entry, nestPath] = pathArray;

    if (up && this.parent) {
      return this.parent.getProp(upPath!, force);
    }

    this.init();

    if (entry && !hasOwn(this.maps, entry) && force) {
      this.stashEntries.push(entry);
      this.maps[entry] = new Prop(this, entry);
    }

    const prop = entry ? this.maps[entry] : this.parent;

    if (!prop || !nestPath) {
      return prop ?? null;
    }

    return prop.getProp(nestPath, force);
  }

  getItems(): Prop[] {
    this.init();
    return this.items;
  }

  sort(fn: (a: Prop, b: Prop) => number): void {
    if (this.type === DataType.List) {
      const oEntries = this.entries;
      this.items.sort(fn);
      this.entries = this.items.map((item) => item.getKey());
      if (this.entries.join(",") !== oEntries.join(",")) {
        this.releaseChange();
      }
    }
  }

  getData(): any {
    if (!this.inited) {
      return cloneDeep(this.rawData);
    }

    if (this.type === DataType.Map) {
      const maps: any = {};
      this.items.forEach((item) => {
        maps[item.getKey()] = item.getData();
      });
      return maps;
    }

    if (this.type === DataType.List) {
      return this.items.map((item) => item.getData());
    }

    return this.rawData;
  }

  setData(data: any, merge: boolean = false, cloned: boolean = false): boolean {
    if (!cloned) {
      data = cloneDeep(data);
    }

    const type = testType(data);
    let modified: boolean = false;

    if (type !== this.type) {
      modified = true;
    }

    const capturing = this.captureChange();
    if (!this.inited) {
      const ret = setData(this.rawData, data, merge, true);
      this.rawData = ret.data;
      if (ret.modified) {
        modified = true;
      }
    } else if (type === DataType.Scalar || type === DataType.Null) {
      if (this.entries.length > 0) {
        this.entries.forEach((key) => { this.stashKey(key); });
        this.entries = [];
      }
      this.items = [];

      if (type === DataType.Null) {
        this.rawData = null;
      } else {
        if (this.type === type && this.rawData !== data) {
          modified = true;
        }
        this.rawData = data;
      }
    } else if (type === DataType.Map) {
      const oEntries = this.entries.slice(0);
      const nEntries = Object.keys(data);
      this.items = nEntries.map((key: string): Prop => {
        if (this.maps[key]) {
          if (this.maps[key].setData(data[key], merge, true)) {
            modified = true;
          }
        } else {
          this.maps[key] = new Prop(this, key, data[key], true);
        }
        const i = oEntries.indexOf(key);
        if (i > -1) {
          oEntries.splice(i, 1);
        } else {
          modified = true;
        }
        return this.maps[key];
      });

      if (merge) {
        this.entries = nEntries.concat(oEntries);
        this.items = this.items.concat(oEntries.map((key): Prop => this.maps[key]!));
      } else {
        this.entries = nEntries;
        if (oEntries.length > 0) {
          oEntries.forEach((key) => { this.stashKey(key); });
          modified = true;
        }
      }
    } else if (type === DataType.List) {
      const oEntries = this.entries.slice(0);
      const entries: string[] = [];
      this.items = (data as any[]).map((itemData: any, index: number): Prop => {
        const key = getKey(itemData, index);
        if (hasOwn(this.maps, key)) {
          if (this.maps[key]!.setData(itemData, merge, true)) {
            modified = true;
          }
        } else {
          this.maps[key] = new Prop(this, key, itemData, true);
        }
        entries.push(key);
        const i = oEntries.indexOf(key);
        if (i > -1) {
          oEntries.splice(i, 1);
          if (this.entries[index] !== key) {
            modified = true;
          }
        } else {
          modified = true;
        }
        return this.maps[key]!;
      });

      this.entries = entries;
      if (oEntries.length > 0) {
        modified = true;
        oEntries.forEach((key) => { this.stashKey(key); });
      }
    }

    this.type = type;

    if (modified) {
      capturing.modified = true;
    }
    capturing.release();

    return modified || this.isStash();
  }

  getPropData(path: string): any {
    const prop = this.getProp(path);
    if (!prop) {
      return null;
    }
    return prop.getData();
  }

  setPropData(path: string, data: any): boolean {
    const prop = this.getProp(path, true);
    if (prop) {
      return prop.setData(data);
    }
    return false;
  }

  mergeData(data: any): boolean {
    return this.setData(data, true);
  }

  captureChange(): Capturing {
    if (this.capturing) {
      return this.capturing;
    }

    const capturing: Capturing = {
      modified: false,
      release: () => {
        this.capturing = null;
        if (capturing.modified || this.isStash()) {
          this.releaseChange();
        }
      },
    };
    this.capturing = capturing;

    return capturing;
  }

  releaseChange(e: ChangeEvent | null = null): false | ChangeKeys {
    if (e && this.isStashKey(e.targetKey)) {
      this.applyStash(e.targetKey);
    }
    if (!this.changing) {
      this.changing = new Set<string>();
    }
    if (e) {
      this.changing.add(e.targetKey);
    }
    if (this.capturing) {
      this.capturing.modified = true;
      return false;
    }
    this.revision += 1;
    if (this.parent) {
      this.parent.releaseChange({ targetKey: this.getKey() });
    }
    const changing = this.changing;
    this.changing = null;
    return changing;
  }

  isStash(): boolean {
    if (!this.parent) {
      return false;
    }

    return this.parent.isStashKey(this.getKey());
  }

  isStashKey(key: string): boolean {
    return this.stashEntries.indexOf(key) > -1;
  }

  isExists(): boolean {
    if (this.parent && !this.parent.isExists()) {
      return false;
    }
    return !this.isStash();
  }

  push(data: any, cloned: boolean = false): string {
    if (!cloned) {
      data = cloneDeep(data);
    }

    let key: string;
    if (this.type === DataType.List) {
      if (this.inited) {
        key = getKey(data, this.items.length);
        this.maps[key] = new Prop(this, key, data, true);
        this.entries.push(key);
        this.items.push(this.maps[key]!);
      } else {
        key = getKey(data, this.rawData.length);
        (this.rawData as any[]).push(data);
      }
    } else {
      key = getKey(data, 0);
      this.type = DataType.List;
      if (this.inited) {
        if (this.entries.length > 0) {
          this.entries.forEach((k) => { this.stashKey(k); });
        }
        this.maps[key] = new Prop(this, key, data, true);
        this.entries = [key];
        this.items = [this.maps[key]!];
      } else {
        this.rawData = [data];
      }
    }
    this.releaseChange();

    return key;
  }

  remove(): void {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  removeChild(child: Prop): void {
    let i = this.items.indexOf(child);
    if (i > -1) {
      const key = child.getKey();
      this.stashKey(key);
      this.items.splice(i, 1);
      i = this.entries.indexOf(key);
      if (i > -1) {
        this.entries.splice(i, 1);
      }
      this.releaseChange();
    }
  }

  private init(): void {
    if (this.inited) {
      return;
    }

    this.inited = true;
    if (this.type === DataType.Map) {
      this.entries = Object.keys(this.rawData);
      this.items = this.entries.map((key) => {
        this.maps[key] = new Prop(this, key, this.rawData[key], true);
        return this.maps[key];
      });
      return;
    }

    if (this.type === DataType.List) {
      this.entries = [];
      this.items = this.rawData.map((itemData: any, index: number) => {
        const key: string = getKey(itemData, index);
        this.maps[key] = new Prop(this, key, itemData, true);
        this.entries.push(key);
        return this.maps[key];
      });
      return;
    }
  }

  private stashKey(key: string): void {
    if (this.stashEntries.indexOf(key) < 0 && hasOwn(this.maps, key)) {
      this.stashEntries.push(key);
    }
  }

  private applyStash(key: string): void {
    if (hasOwn(this.maps, key)) {
      const i = this.stashEntries.indexOf(key);
      if (i < 0) {
        return;
      }
      this.stashEntries.splice(i, 1);
      this.entries.push(key);
      this.items.push(this.maps[key]!);

      if (this.type === DataType.Scalar || this.type === DataType.Null) {
        this.type = DataType.Map;
      }
    }
  }
}
